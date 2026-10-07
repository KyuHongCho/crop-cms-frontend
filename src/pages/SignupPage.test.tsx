import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, onTestFinished } from "vitest";
import { AppRoutes } from "../App";
import type { components } from "../api/schema";
import { AuthProvider } from "../auth/AuthContext";
import { getToken, setToken } from "../auth/token";
import { server } from "../test/server";

const API = `${window.location.origin}/api`;
const CODE = "x".repeat(20);

const member: components["schemas"]["MemberResponse"] = {
  id: 2,
  email: "new@example.com",
  display_name: "Newbie",
  tokens_used_today: 0,
  tokens_budget_daily: 5000,
  budget_window_start: "2026-10-07",
  role: "member",
};
const token: components["schemas"]["TokenResponse"] = { access_token: "tok-2", token_type: "bearer" };

function renderApp(path = "/signup") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

type Form = { email?: string; password?: string; name?: string; code?: string };

async function fill({ email = "new@example.com", password = "pw-123456", name = "", code = CODE }: Form = {}) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  // fireEvent-free bulk entry: long values via paste keep the tests fast
  await user.click(screen.getByLabelText("Password"));
  await user.paste(password);
  if (name) {
    await user.click(screen.getByLabelText(/Display name/));
    await user.paste(name);
  }
  await user.click(screen.getByLabelText("Invite code"));
  await user.paste(code);
  await user.click(screen.getByRole("button", { name: "Sign up" }));
  return user;
}

function trackNetwork() {
  const calls: string[] = [];
  const onStart = ({ request }: { request: Request }) => calls.push(request.url);
  server.events.on("request:start", onStart);
  onTestFinished(() => server.events.removeListener("request:start", onStart));
  return calls;
}

describe("S2 signup", () => {
  it("signs up, logs in with the same credentials and lands on the protected page", async () => {
    let signupBody: unknown;
    let loginBody: unknown;
    server.use(
      http.post(`${API}/members/signup`, async ({ request }) => {
        signupBody = await request.json();
        return HttpResponse.json(member, { status: 201 });
      }),
      http.post(`${API}/members/login`, async ({ request }) => {
        loginBody = await request.json();
        return HttpResponse.json(token);
      }),
      http.get(`${API}/members/me`, () => HttpResponse.json(member)),
    );
    renderApp();
    await fill({ name: "Newbie" });
    expect(await screen.findByText(/Signed in as Newbie/)).toBeInTheDocument();
    expect(signupBody).toEqual({ email: "new@example.com", password: "pw-123456", display_name: "Newbie", invite_code: CODE });
    expect(loginBody).toEqual({ email: "new@example.com", password: "pw-123456" });
    expect(getToken()).toBe("tok-2");
  });

  it("omits display_name from the body when it is empty", async () => {
    let signupBody: Record<string, unknown> = {};
    server.use(
      http.post(`${API}/members/signup`, async ({ request }) => {
        signupBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(member, { status: 201 });
      }),
      http.post(`${API}/members/login`, () => HttpResponse.json(token)),
      http.get(`${API}/members/me`, () => HttpResponse.json(member)),
    );
    renderApp();
    await fill();
    await screen.findByText(/Signed in as/);
    expect(signupBody).not.toHaveProperty("display_name");
  });

  it.each([
    ["an invalid invite", "Invalid or expired invite"],
    ["a duplicate email", "Email already registered"],
  ])("shows the server's 400 detail for %s as given", async (_name, detail) => {
    server.use(http.post(`${API}/members/signup`, () => HttpResponse.json({ detail }, { status: 400 })));
    renderApp();
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
    expect(getToken()).toBeNull();
  });

  it("shows a server 422 list", async () => {
    server.use(
      http.post(`${API}/members/signup`, () =>
        HttpResponse.json({ detail: [{ msg: "String should match pattern" }, { msg: "too short" }] }, { status: 422 }),
      ),
    );
    renderApp();
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("String should match pattern; too short");
  });

  it("points to /login when signup worked but the follow-up login failed", async () => {
    server.use(
      http.post(`${API}/members/signup`, () => HttpResponse.json(member, { status: 201 })),
      http.post(`${API}/members/login`, () => HttpResponse.json({ detail: "boom" }, { status: 503 })),
    );
    renderApp();
    await fill();
    expect(await screen.findByText(/Your account was created/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Go to log in" });
    expect(link).toHaveAttribute("href", "/login");
    expect(getToken()).toBeNull();
  });

  it.each<[string, Form, RegExp]>([
    ["a 7-char password", { password: "a".repeat(7) }, /Password must be 8 to 128/],
    ["a 129-char password", { password: "a".repeat(129) }, /Password must be 8 to 128/],
    ["a 19-char invite code", { code: "x".repeat(19) }, /Invite code must be at least 20/],
    ["a 65-char display name", { name: "n".repeat(65) }, /Display name must be at most 64/],
  ])("blocks submit for %s without touching the network", async (_name, form, message) => {
    const calls = trackNetwork();
    renderApp();
    await fill(form);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(calls).toEqual([]);
  });

  it("accepts the boundary values (8/128 password, 64 name, 20 code)", async () => {
    server.use(
      http.post(`${API}/members/signup`, () => HttpResponse.json({ detail: "Invalid or expired invite" }, { status: 400 })),
    );
    renderApp();
    await fill({ password: "a".repeat(128), name: "n".repeat(64) });
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or expired invite");
  });

  it("does not add an email rule beyond the server's (a@b is sent)", async () => {
    let signupBody: Record<string, unknown> = {};
    server.use(
      http.post(`${API}/members/signup`, async ({ request }) => {
        signupBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ detail: "Invalid or expired invite" }, { status: 400 });
      }),
    );
    renderApp();
    await fill({ email: "a@b" });
    await screen.findByRole("alert");
    expect(signupBody.email).toBe("a@b");
  });

  it("counts code points, not UTF-16 units: 128-emoji password and 64-emoji name pass, 129 and 65 are blocked", async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(`${API}/members/signup`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ detail: "Invalid or expired invite" }, { status: 400 });
      }),
    );
    renderApp();
    await fill({ password: "😀".repeat(128), name: "😀".repeat(64) });
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or expired invite");
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ password: "😀".repeat(128), display_name: "😀".repeat(64) });
    cleanup();

    renderApp();
    await fill({ password: "😀".repeat(129) });
    expect(await screen.findByRole("alert")).toHaveTextContent(/Password must be 8 to 128/);
    cleanup();

    renderApp();
    await fill({ name: "😀".repeat(65) });
    expect(await screen.findByRole("alert")).toHaveTextContent(/Display name must be at most 64/);
    expect(bodies).toHaveLength(1);
  });

  it("never trims the password: spaces count toward length and reach signup and login unchanged", async () => {
    const bodies: Record<string, Record<string, unknown>> = {};
    server.use(
      http.post(`${API}/members/signup`, async ({ request }) => {
        bodies.signup = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(member, { status: 201 });
      }),
      http.post(`${API}/members/login`, async ({ request }) => {
        bodies.login = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(token);
      }),
      http.get(`${API}/members/me`, () => HttpResponse.json(member)),
    );
    renderApp();
    await fill({ password: "  abcdef  " });
    await screen.findByText(/Signed in as/);
    expect(bodies.signup.password).toBe("  abcdef  ");
    expect(bodies.login.password).toBe("  abcdef  ");
  });

  it("accepts a 7-character password padded with a space to 8", async () => {
    let sent: Record<string, unknown> = {};
    server.use(
      http.post(`${API}/members/signup`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ detail: "Invalid or expired invite" }, { status: 400 });
      }),
    );
    renderApp();
    await fill({ password: "abcdefg " });
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or expired invite");
    expect(sent.password).toBe("abcdefg ");
  });

  it("blocks a display name containing NUL without touching the network", async () => {
    const calls = trackNetwork();
    renderApp();
    await fill({ name: "ab\x00cd" });
    expect(await screen.findByRole("alert")).toHaveTextContent(/Display name must not contain NUL/);
    expect(calls).toEqual([]);
  });

  it("trims the email for both signup and the follow-up login", async () => {
    const bodies: Record<string, Record<string, unknown>> = {};
    server.use(
      http.post(`${API}/members/signup`, async ({ request }) => {
        bodies.signup = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(member, { status: 201 });
      }),
      http.post(`${API}/members/login`, async ({ request }) => {
        bodies.login = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(token);
      }),
      http.get(`${API}/members/me`, () => HttpResponse.json(member)),
    );
    renderApp();
    await fill({ email: "  new@example.com  " });
    await screen.findByText(/Signed in as/);
    expect(bodies.signup.email).toBe("new@example.com");
    expect(bodies.login.email).toBe("new@example.com");
  });

  it("blocks an email with no @ without touching the network", async () => {
    const calls = trackNetwork();
    renderApp();
    await fill({ email: "nope" });
    expect(await screen.findByRole("alert")).toHaveTextContent(/Enter an email/);
    expect(calls).toEqual([]);
  });

  it("links /login and /signup both ways", async () => {
    const user = userEvent.setup();
    renderApp("/login");
    await user.click(screen.getByRole("link", { name: "Sign up" }));
    expect(screen.getByRole("heading", { name: "Sign up" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Log in" }));
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("does not show the form to a logged-in user", async () => {
    setToken("tok-2");
    server.use(http.get(`${API}/members/me`, () => HttpResponse.json(member)));
    renderApp("/signup");
    expect(await screen.findByText(/Signed in as Newbie/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign up" })).not.toBeInTheDocument();
  });
});
