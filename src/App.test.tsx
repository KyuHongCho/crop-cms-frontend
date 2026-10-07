import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "./App";
import type { components } from "./api/schema";
import { AuthProvider } from "./auth/AuthContext";
import { getToken, setToken } from "./auth/token";
import { server } from "./test/server";

const API = `${window.location.origin}/api`;

const member: components["schemas"]["MemberResponse"] = {
  id: 1,
  email: "ada@example.com",
  display_name: "Ada",
  tokens_used_today: 120,
  tokens_budget_daily: 5000,
  budget_window_start: "2026-10-07",
  role: "member",
};
const token: components["schemas"]["TokenResponse"] = { access_token: "tok-1", token_type: "bearer" };

function renderApp(path = "/chat") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function logIn(email = "ada@example.com", password = "pw-123456") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Log in" }));
  return user;
}

describe("login and session", () => {
  it("redirects to /login without a token", () => {
    renderApp("/chat");
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("logs in with a JSON body and shows who you are and the budget", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/members/login`, async ({ request }) => {
        expect(request.headers.get("content-type")).toContain("application/json");
        body = await request.json();
        return HttpResponse.json(token);
      }),
      http.get(`${API}/members/me`, ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer tok-1");
        return HttpResponse.json(member);
      }),
    );
    renderApp("/login");
    await logIn();
    expect(await screen.findByText(/Signed in as Ada/)).toBeInTheDocument();
    expect(screen.getByText(/120 \/ 5000/)).toBeInTheDocument();
    expect(body).toEqual({ email: "ada@example.com", password: "pw-123456" });
    expect(getToken()).toBe("tok-1");
  });

  it("shows the wrong-password message and stores nothing", async () => {
    server.use(
      http.post(`${API}/members/login`, () =>
        HttpResponse.json({ detail: "Incorrect email or password" }, { status: 401 }),
      ),
    );
    renderApp("/login");
    await logIn();
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
    expect(getToken()).toBeNull();
    expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
  });

  it("shows the server message on a login 422", async () => {
    server.use(
      http.post(`${API}/members/login`, () =>
        HttpResponse.json({ detail: [{ msg: "value is not a valid email" }] }, { status: 422 }),
      ),
    );
    renderApp("/login");
    await logIn("nope", "x");
    expect(await screen.findByRole("alert")).toHaveTextContent("value is not a valid email");
  });

  describe("login throttle 429", () => {
    function throttled(headers?: Record<string, string>) {
      const bodies: unknown[] = [];
      server.use(
        http.post(`${API}/members/login`, async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json({ detail: "Too many failed attempts" }, { status: 429, headers });
        }),
      );
      return bodies;
    }

    it("shows the reset time in minutes from Retry-After", async () => {
      const bodies = throttled({ "Retry-After": "300" });
      renderApp("/login");
      await logIn();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /^Too many failed attempts\. Try again in about 5 minutes\.$/,
      );
      expect(bodies).toEqual([{ email: "ada@example.com", password: "pw-123456" }]);
    });

    it("says less than a minute for a short Retry-After", async () => {
      const bodies = throttled({ "Retry-After": "30" });
      renderApp("/login");
      await logIn();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /^Too many failed attempts\. Try again in less than a minute\.$/,
      );
      expect(bodies).toHaveLength(1);
    });

    it("falls back to try-again-later without a Retry-After header", async () => {
      const bodies = throttled();
      renderApp("/login");
      await logIn();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /^Too many failed attempts\. Try again later\.$/,
      );
      expect(bodies).toHaveLength(1);
    });

    it("stores no token and does not claim the session expired", async () => {
      throttled({ "Retry-After": "300" });
      renderApp("/login");
      await logIn();
      await screen.findByRole("alert");
      expect(getToken()).toBeNull();
      expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
    });

    it("re-enables the submit button so the user can retry", async () => {
      const bodies = throttled({ "Retry-After": "300" });
      renderApp("/login");
      await logIn();
      await screen.findByRole("alert");
      expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
      expect(bodies).toHaveLength(1);
    });
  });

  it("keeps the session on reload (token already in sessionStorage)", async () => {
    setToken("tok-1");
    server.use(http.get(`${API}/members/me`, () => HttpResponse.json(member)));
    renderApp("/chat");
    expect(await screen.findByText(/Signed in as Ada/)).toBeInTheDocument();
  });

  it("logout clears the token and returns to login", async () => {
    setToken("tok-1");
    server.use(http.get(`${API}/members/me`, () => HttpResponse.json(member)));
    renderApp("/chat");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Log out" }));
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(getToken()).toBeNull();
    expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
  });

  it("a 401 on an authenticated call clears the session and says it expired", async () => {
    setToken("stale");
    server.use(
      http.get(`${API}/members/me`, () =>
        HttpResponse.json({ detail: "Not authenticated" }, { status: 401 }),
      ),
    );
    renderApp("/chat");
    expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
    await waitFor(() => expect(getToken()).toBeNull());
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });
});
