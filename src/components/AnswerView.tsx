import type { components } from "../api/schema";
import Citations from "./Citations";

type Chat = components["schemas"]["ChatResponse"];

const ABSTAIN_LINES: Record<string, string> = {
  out_of_scope: "The question is outside what this service covers.",
  no_relevant_topics: "No relevant topics were found for this question.",
};

export default function AnswerView({ data }: { data: Chat }) {
  const reason = data.abstained?.reason;
  return (
    <div>
      {data.truncated && (
        <p role="status" className="notice">
          This answer was cut off and may be incomplete.
        </p>
      )}
      {data.abstained ? (
        <section role="status" aria-label="No answer" className="notice">
          <h2>No answer</h2>
          <p>{ABSTAIN_LINES[reason ?? ""] ?? `No answer was given (${reason}).`}</p>
          {data.answer && <p className="answer">{data.answer}</p>}
        </section>
      ) : (
        <section role="status" aria-label="Answer">
          <p className="answer">{data.answer}</p>
        </section>
      )}
      {data.dropped.length > 0 && (
        <p className="notice">
          Some topics were left out to fit the size limit:{" "}
          {data.dropped.map((d) => (d.crop_slug ? `${d.topic} (${d.crop_slug})` : d.topic)).join(", ")}.
        </p>
      )}
      <Citations documents={data.documents} />
    </div>
  );
}
