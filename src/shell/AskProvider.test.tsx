import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "../App";
import type { components } from "../api/schema";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { MemberProvider } from "../auth/MemberContext";
import { setToken } from "../auth/token";
import ChatPage from "../pages/ChatPage";
import { server } from "../test/server";
import { AskProvider } from "./AskProvider";

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

const answer = (text: string): components["schemas"]["ChatResponse"] => ({
  answer: text,
  documents: [],
  topics_used: [],
  topics_used_crops: [],
  dropped: [],
  abstained: null,
  truncated: false,
});

function gatedChat(text: string) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  server.use(
    http.post(`${API}/chat`, async () => {
      await gate;
      return HttpResponse.json(answer(text));
    }),
  );
  return release;
}

function useShellApi() {
  server.use(
    http.get(`${API}/members/me`, () => HttpResponse.json(member)),
    http.get(`${API}/crops`, () => HttpResponse.json([])),
    http.get(`${API}/items`, () => HttpResponse.json([])),
    http.post(`${API}/members/login`, () => HttpResponse.json({ access_token: "tok-B", token_type: "bearer" })),
  );
}

async function openApp() {
  setToken("tok-A");
  render(
    <MemoryRouter initialEntries={["/chat"]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
  await screen.findByText(/Signed in as Ada/);
  return userEvent.setup();
}

async function askQuestion(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByLabelText("Question"), text);
  await user.click(screen.getByRole("button", { name: "Ask" }));
}

const tab = (name: string) => screen.getByRole("link", { name });

async function logout(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Account/ }));
  await user.click(await screen.findByRole("menuitem", { name: "Log out" }));
}

describe("ask retention", () => {
  it("keeps the question and the answer after leaving Ask and coming back", async () => {
    useShellApi();
    server.use(http.post(`${API}/chat`, () => HttpResponse.json(answer("Water basil when dry."))));
    const user = await openApp();
    await askQuestion(user, "How often to water basil?");
    expect(await screen.findByRole("region", { name: "Answer" })).toHaveTextContent("Water basil when dry.");

    await user.click(tab("Library"));
    await screen.findByRole("heading", { level: 1, name: "Library" });
    await user.click(tab("Ask"));

    expect(await screen.findByRole("region", { name: "Answer" })).toHaveTextContent("Water basil when dry.");
    expect(screen.getByLabelText("Question")).toHaveValue("How often to water basil?");
  });

  it("shows an answer that landed while the user was on another route", async () => {
    useShellApi();
    const release = gatedChat("Landed while away.");
    const user = await openApp();
    await askQuestion(user, "Slow question");
    await screen.findByText(/Waiting for the answer/);

    await user.click(tab("Library"));
    await screen.findByRole("heading", { level: 1, name: "Library" });
    release();
    await new Promise((r) => setTimeout(r, 50));
    await user.click(tab("Ask"));

    expect(await screen.findByRole("region", { name: "Answer" })).toHaveTextContent("Landed while away.");
    expect(screen.queryByText(/Waiting for the answer/)).not.toBeInTheDocument();
  });

  it("shows the question still waiting when the user returns before the answer", async () => {
    useShellApi();
    const release = gatedChat("Late answer.");
    const user = await openApp();
    await askQuestion(user, "Slow question");
    await user.click(tab("Library"));
    await screen.findByRole("heading", { level: 1, name: "Library" });
    await user.click(tab("Ask"));

    expect(await screen.findByText(/Waiting for the answer/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    release();
    expect(await screen.findByRole("region", { name: "Answer" })).toHaveTextContent("Late answer.");
  });

  it("is empty after logout and a new login", async () => {
    useShellApi();
    server.use(http.post(`${API}/chat`, () => HttpResponse.json(answer("Private answer."))));
    const user = await openApp();
    await askQuestion(user, "Private question");
    await screen.findByRole("region", { name: "Answer" });

    await logout(user);
    await user.type(await screen.findByLabelText("Email"), "bea@example.com");
    await user.type(screen.getByLabelText("Password"), "pw-123456");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByText(/Signed in as Ada/);

    expect(screen.getByLabelText("Question")).toHaveValue("");
    expect(screen.queryByText("Private answer.")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Answer" })).not.toBeInTheDocument();
  });

  it("drops a response that settles after logout without touching the new session", async () => {
    let meCalls = 0;
    let postCalls = 0;
    const releases: Array<() => void> = [];
    const texts = ["Answer for the old session.", "Answer for the new session."];
    useShellApi();
    server.use(
      http.get(`${API}/members/me`, () => {
        meCalls += 1;
        return HttpResponse.json(member);
      }),
      http.post(`${API}/chat`, async () => {
        const mine = postCalls++;
        await new Promise<void>((r) => releases.push(r));
        return HttpResponse.json(answer(texts[mine]));
      }),
    );
    // No RequireAuth here: the provider survives logout, so only the token logic can stop the late result.
    function Controls() {
      const { token, logout: out, login } = useAuth();
      return (
        <>
          <p>{token ? `token ${token}` : "signed out"}</p>
          <button onClick={out}>drop session</button>
          <button onClick={() => void login("bea@example.com", "pw-123456")}>new session</button>
        </>
      );
    }
    setToken("tok-A");
    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <AuthProvider>
          <MemberProvider>
            <AskProvider>
              <Controls />
              <ChatPage />
            </AskProvider>
          </MemberProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await screen.findByText(/Signed in as Ada/);
    await askQuestion(user, "Old question");
    await waitFor(() => expect(releases).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "drop session" }));
    await user.click(screen.getByRole("button", { name: "new session" }));
    await screen.findByText("token tok-B");
    await screen.findByText(/Signed in as Ada/);

    expect(screen.getByLabelText("Question")).toHaveValue("");
    expect(screen.queryByText(/Waiting for the answer/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Question"), "New question");
    expect(screen.getByRole("button", { name: "Ask" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(releases).toHaveLength(2));
    await screen.findByText(/Waiting for the answer/);
    const meBefore = meCalls;

    releases[0]();
    await new Promise((r) => setTimeout(r, 50));

    expect(meCalls).toBe(meBefore);
    expect(screen.queryByText("Answer for the old session.")).not.toBeInTheDocument();
    expect(screen.getByText(/Waiting for the answer/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Question"), " again");
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(postCalls).toBe(2);

    releases[1]();
    expect(await screen.findByRole("region", { name: "Answer" })).toHaveTextContent("Answer for the new session.");
    await waitFor(() => expect(meCalls).toBe(meBefore + 1));
  });
});
