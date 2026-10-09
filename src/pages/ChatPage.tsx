import type { FormEvent } from "react";
import type { ApiError } from "../api/errors";
import { formatReset } from "../api/format";
import { useMember } from "../auth/MemberContext";
import { MAX_QUESTION, useAsk } from "../shell/AskProvider";
import { CircleAlert, Hourglass, WifiOff } from "lucide-react";
import AnswerView from "../components/answer/AnswerView";
import FormError from "../components/FormError";
import SourcesPanel from "../components/sources/SourcesPanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { cn } from "@/lib/utils";

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
  useDocumentTitle("Ask");
  const { member } = useMember();
  const { question, setQuestion, loading, result, lastAsked, ask } = useAsk();

  const trimmed = question.trim();
  // The server counts code points (pydantic), not UTF-16 units; emoji would otherwise count twice.
  const count = [...trimmed].length;
  const tooLong = count > MAX_QUESTION;
  const canSubmit = count > 0 && !tooLong && !loading;

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
      <div role="status" className={loading ? "mt-8 max-w-[68ch] space-y-3" : "sr-only"}>
        {loading ? (
          <>
            <Skeleton aria-hidden="true" className="h-4 w-full" />
            <Skeleton aria-hidden="true" className="h-4 w-5/6" />
            <p className="text-sm text-muted-foreground">Waiting for the answer...</p>
          </>
        ) : (
          result && "answer" in result && (result.answer.abstained ? "No answer was given." : "Answer ready.")
        )}
      </div>
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
