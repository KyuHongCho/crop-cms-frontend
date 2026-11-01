import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useEffect } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "../App";
import type { components } from "../api/schema";
import { AuthProvider } from "../auth/AuthContext";
import { setToken } from "../auth/token";
import { server } from "../test/server";
import LoginPage from "./LoginPage";

const API = `${window.location.origin}/api`;

const DESCRIPTION = "Ask crop-growing questions and read answers with the source documents alongside them.";
const HINT =
  "Trying the demo? The email and password came with the application message. Paste them rather than typing: repeated wrong attempts lock a login for a while.";

function mockLogin() {
  server.use(
    http.post(`${API}/members/login`, () =>
      HttpResponse.json({ access_token: "tok-1", token_type: "bearer" } satisfies components["schemas"]["TokenResponse"]),
    ),
  );
}

async function logIn() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Password"), "pw-123456");
  await user.click(screen.getByRole("button", { name: "Log in" }));
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

it("shows the login error with an aria-hidden icon beside the text", async () => {
  server.use(
    http.post(`${window.location.origin}/api/members/login`, () =>
      HttpResponse.json({ detail: "Incorrect email or password" }, { status: 401 }),
    ),
  );
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Password"), "pw-123456");
  await user.click(screen.getByRole("button", { name: "Log in" }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Incorrect email or password");
  expect(alert.querySelector("svg[aria-hidden]")).not.toBeNull();
});

it.each([
  ["/login", "Log in · Crop CMS"],
  ["/signup", "Sign up · Crop CMS"],
])("%s sets the document title", (path, title) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
  expect(document.title).toBe(title);
});

describe("what the login page says", () => {
  function renderLogin() {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );
  }

  it("shows the one-line description and the demo hint as plain muted text", () => {
    renderLogin();
    for (const text of [DESCRIPTION, HINT]) {
      const p = screen.getByText(text);
      expect(p.tagName).toBe("P");
      expect(p).toHaveClass("text-muted-foreground");
      expect(p).not.toHaveAttribute("role");
      expect(p.querySelector("svg")).toBeNull();
    }
  });

  it("has no @ in the hint, so no email address is written into it", () => {
    renderLogin();
    expect(HINT).not.toContain("@");
    expect(screen.getByText(HINT).textContent).not.toContain("@");
  });

  it("keeps the sign-up link, and shows no expiry notice on a fresh visit", () => {
    renderLogin();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
    expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
  });
});

describe("where login goes", () => {
  // Every pathname the router held, so a hop back through /login shows even though the final page is /chat.
  function Recorder({ visited }: { visited: string[] }) {
    const location = useLocation();
    useEffect(() => {
      visited.push(location.pathname);
    }, [location, visited]);
    return null;
  }

  async function loginFrom(state: unknown) {
    const visited: string[] = [];
    mockLogin();
    render(
      <MemoryRouter initialEntries={[{ pathname: "/login", state }]}>
        <AuthProvider>
          <Recorder visited={visited} />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    await logIn();
    const final = (await screen.findByTestId("where")).textContent;
    return { final, afterLogin: visited.slice(1) };
  }

  it("honours a path inside the app", async () => {
    const { final, afterLogin } = await loginFrom({ from: "/library/basil/watering-needs" });
    expect(final).toBe("/library/basil/watering-needs");
    expect(afterLogin).toEqual(["/library/basil/watering-needs"]);
  });

  it.each([
    ["a protocol-relative address", "//evil.example"],
    ["a backslash address", "/\\evil.example"],
    ["a tab inside a protocol-relative address", "/\t/evil.example"],
    ["a carriage return inside a protocol-relative address", "/\r/evil.example"],
    ["a line feed inside a protocol-relative address", "/\n/evil.example"],
    ["the login page itself", "/login"],
    ["the login page with a trailing slash", "/login/"],
    ["the signup page", "/signup"],
    ["the signup page with a trailing slash", "/signup/"],
    ["a path without a leading slash", "library"],
    ["an absolute address", "https://evil.example/chat"],
    ["a value that is not a string", 42],
  ])("goes straight to /chat for %s", async (_name, from) => {
    const { final, afterLogin } = await loginFrom({ from });
    expect(final).toBe("/chat");
    expect(afterLogin).toEqual(["/chat"]);
  });

  it.each([
    ["no router state", undefined],
    ["state without a from", {}],
  ])("goes straight to /chat for %s", async (_name, state) => {
    const { final, afterLogin } = await loginFrom(state);
    expect(final).toBe("/chat");
    expect(afterLogin).toEqual(["/chat"]);
  });

  it("returns an expired session to the page it was on", async () => {
    setToken("stale");
    server.use(
      http.get(`${API}/members/me`, ({ request }) =>
        request.headers.get("authorization") === "Bearer stale"
          ? HttpResponse.json({ detail: "Not authenticated" }, { status: 401 })
          : HttpResponse.json({
              id: 1,
              email: "ada@example.com",
              display_name: "Ada",
              tokens_used_today: 0,
              tokens_budget_daily: 5000,
              budget_window_start: "2026-10-07",
              role: "member",
            } satisfies components["schemas"]["MemberResponse"]),
      ),
      http.get(`${API}/crops`, () => HttpResponse.json([])),
      http.get(`${API}/items`, () => HttpResponse.json([])),
    );
    mockLogin();
    render(
      <MemoryRouter initialEntries={["/library"]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
    await logIn();
    expect(await screen.findByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
  });
});
