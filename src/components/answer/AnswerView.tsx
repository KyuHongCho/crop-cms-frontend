import { CircleSlash, ListMinus, Scissors } from "lucide-react";
import type { components } from "../../api/schema";
import { citeText } from "./citeText";
import StatusChip from "./StatusChip";

type Chat = components["schemas"]["ChatResponse"];

const ABSTAIN_LINES: Record<string, string> = {
  out_of_scope: "The question is outside what this service covers.",
  no_relevant_topics: "No relevant topics were found for this question.",
};

const CARD = "rounded-xl border bg-card p-4 text-card-foreground sm:p-6";
// `answer` is a test hook; the styling is the utilities.
const ANSWER = "answer text-lg whitespace-pre-wrap";

export default function AnswerView({ data }: { data: Chat }) {
  const reason = data.abstained?.reason;
  const keys = new Set(data.documents.map((d) => d.key));
  const dropped = data.dropped.map((d) => (d.crop_slug ? `${d.topic} (${d.crop_slug})` : d.topic)).join(", ");
  return (
    <div className="max-w-[68ch] space-y-3">
      {(data.truncated || data.dropped.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {data.truncated && (
            <StatusChip tone="notice" icon={Scissors} role="status">
              This answer was cut off and may be incomplete.
            </StatusChip>
          )}
          {data.dropped.length > 0 && (
            <StatusChip tone="neutral" icon={ListMinus} role="status">
              {`Some topics were left out to fit the size limit: ${dropped}.`}
            </StatusChip>
          )}
        </div>
      )}
      {data.abstained ? (
        <section role="status" aria-label="No answer" className={`${CARD} space-y-3`}>
          <StatusChip tone="neutral" icon={CircleSlash}>
            No answer
          </StatusChip>
          <p>{ABSTAIN_LINES[reason ?? ""] ?? `No answer was given (${reason}).`}</p>
          {data.answer && <p className={ANSWER}>{data.answer}</p>}
        </section>
      ) : (
        <section aria-live="polite" aria-atomic="true" aria-label="Answer" className={CARD}>
          <p className={ANSWER}>{citeText(data.answer, keys)}</p>
        </section>
      )}
    </div>
  );
}
