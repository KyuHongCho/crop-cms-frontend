import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "../App";
import type { components } from "../api/schema";
import { AuthProvider } from "../auth/AuthContext";
import { getToken, setToken } from "../auth/token";
import { server } from "../test/server";

const API = `${window.location.origin}/api`;

type Chat = components["schemas"]["ChatResponse"];
type Doc = components["schemas"]["CitedDocument"];

const member: components["schemas"]["MemberResponse"] = {
  id: 1,
  email: "ada@example.com",
  display_name: "Ada",
  tokens_used_today: 120,
  tokens_budget_daily: 5000,
  budget_window_start: "2026-10-07",
  role: "member",
};

const doc = (over: Partial<Doc> = {}): Doc => ({
  id: 1,
  topic: "irrigation",
  title: "Basil watering",
  body: "Water basil when the top soil is dry.",
  source: "FAO Guide",
  reference: "p. 12",
  url: "https://example.org/basil",
  read_directly: true,
  via: null,
  condition: null,
  licence_note: null,
  key: "S1",
  crop_slug: null,
  ...over,
});

const chat = (over: Partial<Chat> = {}): Chat => ({
  answer: "Water basil when dry [S1].",
  documents: [doc()],
  topics_used: ["irrigation"],
  topics_used_crops: [],
  dropped: [],
  abstained: null,
  truncated: false,
  ...over,
});

function useMe(counter?: { n: number }) {
  server.use(
    http.get(`${API}/members/me`, () => {
      if (counter) counter.n += 1;
      return HttpResponse.json(member);
    }),
  );
}

function useChat(resolver: (body: unknown, request: Request) => Response | Promise<Response>) {
  const calls: unknown[] = [];
  server.use(
    http.post(`${API}/chat`, async ({ request }) => {
      const body = await request.json();
      calls.push(body);
      return resolver(body, request);
    }),
  );
  return calls;
}

async function openChat() {
  setToken("tok-1");
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

async function ask(user: ReturnType<typeof userEvent.setup>, text = "How often to water basil?") {
  await user.clear(screen.getByLabelText("Question"));
  await user.type(screen.getByLabelText("Question"), text);
  await user.click(screen.getByRole("button", { name: "Ask" }));
}

describe("S3 chat: answers", () => {
  it("sends the trimmed question as JSON with the bearer token and shows the cited answer", async () => {
    useMe();
    let auth: string | null = null;
    const calls = useChat((_b, req) => {
      auth = req.headers.get("authorization");
      return HttpResponse.json(chat({ documents: [doc({ crop_slug: "basil", read_directly: false, via: "FAO summary" })] }));
    });
    const user = await openChat();
    await ask(user, "  How often to water basil?  ");
    expect(await screen.findByText("Water basil when dry [S1].")).toBeInTheDocument();
    expect(calls).toEqual([{ question: "How often to water basil?" }]);
    expect(auth).toBe("Bearer tok-1");
    expect(screen.getByText("Basil watering")).toBeInTheDocument();
    expect(screen.getByText(/FAO Guide, p\. 12/)).toBeInTheDocument();
    expect(screen.getByText("Via FAO summary")).toBeInTheDocument();
    expect(screen.getByText(/Crop: basil/)).toBeInTheDocument();
    expect(screen.queryByText(/cut off/)).not.toBeInTheDocument();
    expect(screen.queryByText("Water basil when the top soil is dry.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show text" }));
    expect(screen.getByText("Water basil when the top soil is dry.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide text" }));
    expect(screen.queryByText("Water basil when the top soil is dry.")).not.toBeInTheDocument();
  });

  it("shows each citation's key, not its id", async () => {
    useMe();
    useChat(() =>
      HttpResponse.json(chat({ documents: [doc({ id: 41, key: "S1" }), doc({ id: 87, key: "S2", title: "Second" })] })),
    );
    const user = await openChat();
    await ask(user);
    expect(await screen.findByText("[S1]")).toBeInTheDocument();
    expect(screen.getByText("[S2]")).toBeInTheDocument();
    expect(screen.queryByText("[41]")).not.toBeInTheDocument();
    expect(screen.queryByText("[87]")).not.toBeInTheDocument();
  });

  it("shows condition and licence note as labelled plain text when present", async () => {
    useMe();
    useChat(() =>
      HttpResponse.json(chat({ documents: [doc({ condition: "at DLI 19.5 mol m-2 d-1", licence_note: "<b>FAO</b> attribution terms" })] })),
    );
    const user = await openChat();
    await ask(user);
    expect(await screen.findByText("Condition: at DLI 19.5 mol m-2 d-1")).toBeInTheDocument();
    expect(screen.getByText("Licence: <b>FAO</b> attribution terms")).toBeInTheDocument();
    expect(document.querySelector("main b")).toBeNull();
  });

  it.each([[null, null], ["", ""], [undefined, undefined]])(
    "shows no condition or licence label when empty (%s)",
    async (condition, licence_note) => {
      useMe();
      useChat(() => HttpResponse.json(chat({ documents: [doc({ condition, licence_note })] })));
      const user = await openChat();
      await ask(user);
      await screen.findByText("Basil watering");
      expect(screen.queryByText(/Condition:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Licence:/)).not.toBeInTheDocument();
    },
  );

  it("links an https url with rel noopener noreferrer", async () => {
    useMe();
    useChat(() => HttpResponse.json(chat()));
    const user = await openChat();
    await ask(user);
    const link = await screen.findByRole("link", { name: "https://example.org/basil" });
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it.each(["javascript:alert(1)", "data:text/html,<b>x</b>", "ftp://example.org/x", "not a url"])(
    "does not render %s as a link",
    async (url) => {
      useMe();
      useChat(() => HttpResponse.json(chat({ documents: [doc({ url })] })));
      const user = await openChat();
      await ask(user);
      await screen.findByText("Basil watering");
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    },
  );

  it("shows the truncated banner from the flag", async () => {
    useMe();
    useChat(() => HttpResponse.json(chat({ truncated: true })));
    const user = await openChat();
    await ask(user);
    expect(await screen.findByText(/cut off and may be incomplete/)).toBeInTheDocument();
  });

  it("does not show the banner when the flag is false even if the answer says it", async () => {
    useMe();
    useChat(() => HttpResponse.json(chat({ answer: "Note: this answer was cut off and may be incomplete.", truncated: false })));
    const user = await openChat();
    await ask(user);
    // the only occurrence is the answer text itself, in the answer paragraph
    const hits = await screen.findAllByText(/cut off and may be incomplete/);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toHaveClass("answer");
  });

  it.each([
    ["out_of_scope", /outside what this service covers/],
    ["no_relevant_topics", /No relevant topics were found/],
  ])("shows the abstained state for %s as a non-error", async (reason, line) => {
    useMe();
    useChat(() => HttpResponse.json(chat({ answer: "", documents: [], topics_used: [], abstained: { reason } })));
    const user = await openChat();
    await ask(user);
    expect(await screen.findByRole("status", { name: "No answer" })).toHaveTextContent(line);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Citations" })).not.toBeInTheDocument();
  });

  it("shows the server answer text inside the abstained state when present", async () => {
    useMe();
    useChat(() =>
      HttpResponse.json(chat({ answer: "I can only help with crops.", documents: [], abstained: { reason: "out_of_scope" } })),
    );
    const user = await openChat();
    await ask(user);
    expect(await screen.findByRole("status", { name: "No answer" })).toHaveTextContent("I can only help with crops.");
  });

  it("shows no empty answer paragraph when abstained with an empty answer", async () => {
    useMe();
    useChat(() => HttpResponse.json(chat({ answer: "", documents: [], abstained: { reason: "out_of_scope" } })));
    const user = await openChat();
    await ask(user);
    await screen.findByRole("status", { name: "No answer" });
    expect(document.querySelector(".answer")).toBeNull();
  });

  it("names dropped topics", async () => {
    useMe();
    useChat(() =>
      HttpResponse.json(
        chat({
          dropped: [
            { topic: "pests", score: 0.4, document_count: 3, context_chars: 9000, crop_slug: "basil" },
            { topic: "soil", score: 0.3, document_count: 2, context_chars: 7000 },
          ],
        }),
      ),
    );
    const user = await openChat();
    await ask(user);
    expect(await screen.findByText(/left out to fit the size limit/)).toHaveTextContent("pests (basil), soil");
  });

  it("renders html and script text literally", async () => {
    useMe();
    useChat(() =>
      HttpResponse.json(
        chat({
          answer: "<script>window.__pwned = 1</script><b>bold</b>",
          documents: [doc({ body: "<img src=x onerror=alert(1)>", title: "<i>t</i>" })],
        }),
      ),
    );
    const user = await openChat();
    await ask(user);
    expect(await screen.findByText("<script>window.__pwned = 1</script><b>bold</b>")).toBeInTheDocument();
    expect(screen.getByText("<i>t</i>")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show text" }));
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("main script, main b, main img, main i")).toBeNull();
  });

  it("a new submit replaces the previous result", async () => {
    useMe();
    let n = 0;
    useChat(() => HttpResponse.json(chat({ answer: `answer ${++n}` })));
    const user = await openChat();
    await ask(user, "first");
    await screen.findByText("answer 1");
    await ask(user, "second");
    await screen.findByText("answer 2");
    expect(screen.queryByText("answer 1")).not.toBeInTheDocument();
  });
});

describe("S3 chat: input rules", () => {
  it("counts trimmed characters and blocks a whitespace-only question without a request", async () => {
    useMe();
    const calls = useChat(() => HttpResponse.json(chat()));
    const user = await openChat();
    await user.type(screen.getByLabelText("Question"), "   ");
    expect(screen.getByText(/^0 \/ 2000 characters/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    fireEvent.submit(screen.getByRole("button", { name: "Ask" }).closest("form")!);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toHaveLength(0);
    await user.type(screen.getByLabelText("Question"), "hi ");
    expect(screen.getByText(/^2 \/ 2000 characters/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeEnabled();
  });

  it("enforces the 2000 limit on the trimmed text", async () => {
    useMe();
    const calls = useChat(() => HttpResponse.json(chat()));
    await openChat();
    const box = screen.getByLabelText("Question");
    fireEvent.change(box, { target: { value: "a".repeat(2001) } });
    expect(screen.getByText(/^2001 \/ 2000 characters/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    fireEvent.submit(box.closest("form")!);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toHaveLength(0);

    fireEvent.change(box, { target: { value: `  ${"a".repeat(2000)}  ` } });
    expect(screen.getByRole("button", { name: "Ask" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await screen.findByText("Water basil when dry [S1].");
    expect(calls).toEqual([{ question: "a".repeat(2000) }]);
  });

  it("counts code points like the server: 1500 emoji are sent, 2001 are blocked", async () => {
    useMe();
    const calls = useChat(() => HttpResponse.json(chat()));
    await openChat();
    const box = screen.getByLabelText("Question");
    const form = box.closest("form")!;
    fireEvent.change(box, { target: { value: "😀".repeat(2001) } });
    expect(screen.getByText(/^2001 \/ 2000 characters/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    fireEvent.submit(form);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toHaveLength(0);

    fireEvent.change(box, { target: { value: "😀".repeat(1500) } });
    expect(screen.getByText(/^1500 \/ 2000 characters/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await screen.findByText("Water basil when dry [S1].");
    expect(calls).toEqual([{ question: "😀".repeat(1500) }]);
  });

  it("sends one request for a second submit while loading and shows a loading state", async () => {
    useMe();
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const calls = useChat(async () => {
      await gate;
      return HttpResponse.json(chat());
    });
    await openChat();
    const box = screen.getByLabelText("Question");
    fireEvent.change(box, { target: { value: "q" } });
    const form = box.closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(await screen.findByText(/Waiting for the answer/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    await waitFor(() => expect(calls).toHaveLength(1));
    release();
    await screen.findByText("Water basil when dry [S1].");
    expect(calls).toHaveLength(1);
    expect(screen.queryByText(/Waiting for the answer/)).not.toBeInTheDocument();
  });

  it("refetches /members/me after a successful answer", async () => {
    const me = { n: 0 };
    let used = 120;
    server.use(
      http.get(`${API}/members/me`, () => {
        me.n += 1;
        return HttpResponse.json({ ...member, tokens_used_today: used });
      }),
    );
    useChat(() => {
      used = 900;
      return HttpResponse.json(chat());
    });
    const user = await openChat();
    expect(me.n).toBe(1);
    expect(screen.getByText(/120 \/ 5000/)).toBeInTheDocument();
    await ask(user);
    expect(await screen.findByText(/900 \/ 5000/)).toBeInTheDocument();
    expect(me.n).toBe(2);
  });

  it("does not refetch /members/me after a failed answer", async () => {
    const me = { n: 0 };
    useMe(me);
    useChat(() => HttpResponse.json({ detail: "x" }, { status: 503 }));
    const user = await openChat();
    await ask(user);
    await screen.findByRole("alert");
    expect(me.n).toBe(1);
  });
});

describe("S3 chat: errors", () => {
  it("429 shows the budget message with a reset time from Retry-After", async () => {
    useMe();
    useChat(() =>
      HttpResponse.json({ detail: "Daily token budget exhausted" }, { status: 429, headers: { "Retry-After": "10800" } }),
    );
    const user = await openChat();
    await ask(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Daily budget used up. It resets in about 3 hours.");
  });

  it("a submit after a 429 reaches the server, and a 200 clears the 429 message", async () => {
    useMe();
    let n = 0;
    const calls = useChat(() =>
      ++n === 1
        ? HttpResponse.json({ detail: "Daily token budget exhausted" }, { status: 429, headers: { "Retry-After": "10800" } })
        : HttpResponse.json(chat()),
    );
    const user = await openChat();
    await ask(user, "first");
    expect(await screen.findByRole("alert")).toHaveTextContent("Daily budget used up.");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("Water basil when dry [S1].")).toBeInTheDocument();
    expect(calls).toEqual([{ question: "first" }, { question: "first" }]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Daily budget used up/)).not.toBeInTheDocument();
  });

  it.each([[undefined], ["0"], ["soon"]])("429 with Retry-After %s falls back to a message without a time", async (value) => {
    useMe();
    useChat(() =>
      HttpResponse.json(
        { detail: "Daily token budget exhausted" },
        { status: 429, headers: value === undefined ? {} : { "Retry-After": value } },
      ),
    );
    const user = await openChat();
    await ask(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Daily budget used up. Try again later.");
  });

  it("413 shows the message from the detail object", async () => {
    useMe();
    useChat(() =>
      HttpResponse.json(
        {
          detail: {
            topic: "pests",
            document_count: 40,
            context_chars: 90000,
            context_char_budget: 60000,
            message: "Topic 'pests' is too large to answer from.",
          },
        },
        { status: 413 },
      ),
    );
    const user = await openChat();
    await ask(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Topic 'pests' is too large to answer from.");
  });

  it("503 shows a fixed message and Retry resends the same question", async () => {
    useMe();
    let n = 0;
    const calls = useChat(() =>
      ++n === 1
        ? HttpResponse.json({ detail: "The answering service is unavailable. Please try again later." }, { status: 503 })
        : HttpResponse.json(chat()),
    );
    const user = await openChat();
    await ask(user, "  water basil?  ");
    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable, try later.");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Water basil when dry [S1].")).toBeInTheDocument();
    expect(calls).toEqual([{ question: "water basil?" }, { question: "water basil?" }]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("401 clears the session and returns to login", async () => {
    useMe();
    useChat(() => HttpResponse.json({ detail: "Not authenticated" }, { status: 401 }));
    const user = await openChat();
    await ask(user);
    expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
    await waitFor(() => expect(getToken()).toBeNull());
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("422 shows the server message inline", async () => {
    useMe();
    useChat(() => HttpResponse.json({ detail: [{ msg: "Value error, question must not be blank" }] }, { status: 422 }));
    const user = await openChat();
    await ask(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Value error, question must not be blank");
  });

  it("a network failure shows a reachability message", async () => {
    useMe();
    useChat(() => HttpResponse.error());
    const user = await openChat();
    await ask(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the server");
  });
});

describe("S3 chat: announcements and session ownership", () => {
  it("puts a normal answer in a live region so assistive tech can announce it", async () => {
    useMe();
    useChat(() => HttpResponse.json(chat()));
    const user = await openChat();
    await ask(user);
    expect(await screen.findByRole("status", { name: "Answer" })).toHaveTextContent("Water basil when dry [S1].");
  });

  it("a late 401 for a replaced token does not end the new session", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    server.use(
      http.get(`${API}/members/me`, ({ request }) =>
        HttpResponse.json({ ...member, display_name: request.headers.get("authorization") === "Bearer tok-B" ? "Bea" : "Ada" }),
      ),
      http.post(`${API}/members/login`, () => HttpResponse.json({ access_token: "tok-B", token_type: "bearer" })),
      http.post(`${API}/chat`, async () => {
        await gate;
        return HttpResponse.json({ detail: "Not authenticated" }, { status: 401 });
      }),
    );
    const user = await openChat();
    await ask(user);
    await screen.findByText(/Waiting for the answer/);
    await user.click(screen.getByRole("button", { name: "Log out" }));
    await user.type(await screen.findByLabelText("Email"), "bea@example.com");
    await user.type(screen.getByLabelText("Password"), "pw-123456");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByText(/Signed in as Bea/);
    release();
    await waitFor(() => expect(getToken()).toBe("tok-B"));
    await new Promise((r) => setTimeout(r, 50));
    expect(getToken()).toBe("tok-B");
    expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Signed in as Bea/)).toBeInTheDocument();
  });

  it("a late 401 after logout does not put a session-expired note on the login page", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    useMe();
    server.use(
      http.post(`${API}/chat`, async () => {
        await gate;
        return HttpResponse.json({ detail: "Not authenticated" }, { status: 401 });
      }),
    );
    const user = await openChat();
    await ask(user);
    await screen.findByText(/Waiting for the answer/);
    await user.click(screen.getByRole("button", { name: "Log out" }));
    await screen.findByRole("heading", { name: "Log in" });
    release();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
  });
});
