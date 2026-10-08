import { useEffect, useRef, useState, type FormEvent } from "react";
import { client } from "../api/client";
import { isApiError, normaliseError, type ApiError } from "../api/errors";
import { formatReset } from "../api/format";
import type { components } from "../api/schema";
import { useAuth } from "../auth/AuthContext";
import AnswerView from "../components/AnswerView";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Member = components["schemas"]["MemberResponse"];
type Chat = components["schemas"]["ChatResponse"];
type Result = { answer: Chat } | { error: ApiError } | { offline: true } | null;

const MAX_QUESTION = 2000;

function budgetMessage(retryAfter?: number): string {
  return retryAfter
    ? `Daily budget used up. It resets in ${formatReset(retryAfter)}.`
    : "Daily budget used up. Try again later.";
}

function errorMessage(err: ApiError): string {
  switch (err.kind) {
    case "rate_limited":
      return budgetMessage(err.retryAfter);
    case "unavailable":
      return "Service unavailable, try later.";
    default:
      return err.message;
  }
}

export default function ChatPage() {
  const { logout } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [lastAsked, setLastAsked] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    let live = true;
    client
      .GET("/members/me")
      .then(({ data, response }) => {
        if (!live) return;
        if (data) setMember(data);
        else if (response.status !== 401) setError(`Could not load your profile (${response.status}).`);
      })
      .catch(() => live && setError("Could not reach the server."));
    return () => {
      live = false;
    };
  }, []);

  async function refreshMember() {
    try {
      const { data } = await client.GET("/members/me");
      if (data) setMember(data);
    } catch {
      // the indicator stays on its last value; the answer is already shown
    }
  }

  const trimmed = question.trim();
  // The server counts code points (pydantic), not UTF-16 units; emoji would otherwise count twice.
  const count = [...trimmed].length;
  const tooLong = count > MAX_QUESTION;
  const canSubmit = count > 0 && !tooLong && !loading;

  async function ask(text: string) {
    if (inFlight.current) return;
    const q = text.trim();
    const n = [...q].length;
    if (n === 0 || n > MAX_QUESTION) return;
    inFlight.current = true;
    setLoading(true);
    setResult(null);
    setLastAsked(q);
    try {
      const { data, error: body, response } = await client.POST("/chat", { body: { question: q } });
      if (data) {
        setResult({ answer: data });
        void refreshMember();
      } else {
        const err = normaliseError(response.status, body, response.headers);
        setResult({ error: err });
      }
    } catch (e) {
      setResult(isApiError(e) ? { error: e } : { offline: true });
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    void ask(question);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-4 text-2xl leading-tight font-semibold">Chat</h1>
      {member && (
        <p>
          Signed in as {member.display_name || member.email}. Tokens used today:{" "}
          {member.tokens_used_today} / {member.tokens_budget_daily}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <form onSubmit={onSubmit}>
        <label className="mb-1.5 block text-sm font-medium">
          Question
          <Textarea
            className="mt-1.5 text-base!"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            aria-describedby="question-count"
          />
        </label>
        <p id="question-count" className={tooLong ? "over" : undefined}>
          {count} / {MAX_QUESTION} characters (leading and trailing spaces not counted)
        </p>
        <Button type="submit" disabled={!canSubmit}>
          Ask
        </Button>
      </form>
      {loading && <p role="status">Waiting for the answer...</p>}
      {result && "answer" in result && <AnswerView data={result.answer} />}
      {result && "offline" in result && <p role="alert">Could not reach the server. Try again.</p>}
      {result && "error" in result && result.error.kind !== "unauthenticated" && (
        <div role="alert">
          <p>{errorMessage(result.error)}</p>
          {result.error.kind === "unavailable" && (
            <Button type="button" variant="outline" disabled={loading} onClick={() => void ask(lastAsked)}>
              Retry
            </Button>
          )}
        </div>
      )}
      <Button variant="outline" className="mt-6" onClick={logout}>Log out</Button>
    </main>
  );
}
