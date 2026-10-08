import { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { MemberProvider, useMember } from "./MemberContext";
import { setToken } from "./token";
import { server } from "../test/server";

const API = `${window.location.origin}/api`;

type Handles = { login: () => Promise<void>; refresh: () => Promise<void> };

function Probe({ onHandles }: { onHandles: (h: Handles) => void }) {
  const { login } = useAuth();
  const { member, refresh } = useMember();
  useEffect(() => {
    onHandles({ login: () => login("bea@example.com", "pw-123456"), refresh });
  }, [onHandles, login, refresh]);
  return <p>member:{member?.display_name ?? "none"}</p>;
}

function setup(gates: { Ada?: Promise<void>; Bea?: Promise<void>; AdaRefresh?: Promise<void> }) {
  let adaCalls = 0;
  server.use(
    http.post(`${API}/members/login`, () => HttpResponse.json({ access_token: "tok-B", token_type: "bearer" })),
    http.get(`${API}/members/me`, async ({ request }) => {
      const bea = request.headers.get("authorization") === "Bearer tok-B";
      if (bea) {
        await gates.Bea;
      } else {
        adaCalls += 1;
        await (adaCalls === 1 ? gates.Ada : gates.AdaRefresh);
      }
      return HttpResponse.json({
        id: bea ? 2 : 1,
        email: "x@example.com",
        display_name: bea ? "Bea" : "Ada",
        tokens_used_today: 0,
        tokens_budget_daily: 5000,
        budget_window_start: "2026-10-07",
        role: "member",
      });
    }),
  );
  setToken("tok-A");
  const handles = {} as Handles;
  render(
    <MemoryRouter>
      <AuthProvider>
        <MemberProvider>
          <Probe onHandles={(h) => Object.assign(handles, h)} />
        </MemberProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  return handles;
}

describe("MemberProvider keyed by token", () => {
  it("never shows the previous member while the new token's profile is loading", async () => {
    let release!: () => void;
    const handles = setup({ Bea: new Promise<void>((r) => (release = r)) });
    await screen.findByText("member:Ada");
    await act(async () => {
      await handles.login();
    });
    expect(screen.getByText("member:none")).toBeInTheDocument();
    release();
    expect(await screen.findByText("member:Bea")).toBeInTheDocument();
  });

  it("drops a refresh that was started for the replaced token", async () => {
    let release!: () => void;
    const handles = setup({ AdaRefresh: new Promise<void>((r) => (release = r)) });
    await screen.findByText("member:Ada");
    const oldRefresh = handles.refresh;
    let pending!: Promise<void>;
    act(() => {
      pending = oldRefresh();
    });
    await act(async () => {
      await handles.login();
    });
    await screen.findByText("member:Bea");
    release();
    await act(async () => {
      await pending;
    });
    expect(screen.getByText("member:Bea")).toBeInTheDocument();
  });
});
