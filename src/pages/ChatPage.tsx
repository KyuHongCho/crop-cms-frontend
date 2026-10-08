import { useRef, useState, type FormEvent } from "react";
import { client } from "../api/client";
import { isApiError, normaliseError, type ApiError } from "../api/errors";
import { formatReset } from "../api/format";
import type { components } from "../api/schema";
import { useMember } from "../auth/MemberContext";
import { CircleAlert, Hourglass, WifiOff } from "lucide-react";
import AnswerView from "../components/answer/AnswerView";
import FormError from "../components/FormError";
import SourcesPanel from "../components/sources/SourcesPanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
  const { member, refresh: refreshMember } = useMember();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [lastAsked, setLastAsked] = useState("");
  const inFlight = useRef(false);

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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-4 text-2xl leading-tight font-semibold">Ask</h1>
      {member && (
        <p className="mb-4 text-sm text-muted-foreground">
          {`Signed in as ${member.display_name || member.email} · Tokens used today: ${member.tokens_used_today} / ${member.tokens_budget_daily}`}
        </p>
      )}
      <form onSubmit={onSubmit} className="max-w-[68ch]">
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
        <p
          id="question-count"
          className={cn("mt-2 mb-3 flex items-start gap-1.5 text-sm", tooLong ? "text-destructive" : "text-muted-foreground")}
        >
          {tooLong && <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
          <span>{`${count} / ${MAX_QUESTION} characters (leading and trailing spaces not counted)`}</span>
        </p>
        <Button type="submit" disabled={!canSubmit}>
          Ask
        </Button>
      </form>
      {loading && (
        <div role="status" className="mt-8 max-w-[68ch] space-y-3">
          <Skeleton aria-hidden="true" className="h-4 w-full" />
          <Skeleton aria-hidden="true" className="h-4 w-5/6" />
          <p className="text-sm text-muted-foreground">Waiting for the answer...</p>
        </div>
      )}
      {result && "answer" in result && (
        <div
          className={cn(
            "mt-8 grid gap-8",
            result.answer.documents.length > 0 && "lg:grid-cols-[minmax(0,1fr)_22.5rem]",
          )}
        >
          <AnswerView data={result.answer} />
          <SourcesPanel documents={result.answer.documents} />
        </div>
      )}
      {result && "offline" in result && (
        <div className="mt-8 max-w-[68ch]">
          <FormError icon={WifiOff}>Could not reach the server. Try again.</FormError>
        </div>
      )}
      {result && "error" in result && result.error.kind !== "unauthenticated" && (
        <div className="mt-8 max-w-[68ch] space-y-3">
          {result.error.kind === "rate_limited" ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-notice px-3 py-2 text-sm text-notice-foreground">
              <Hourglass aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p>{errorMessage(result.error)}</p>
            </div>
          ) : (
            <FormError>{errorMessage(result.error)}</FormError>
          )}
          {result.error.kind === "unavailable" && (
            <Button type="button" variant="outline" disabled={loading} onClick={() => void ask(lastAsked)}>
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
