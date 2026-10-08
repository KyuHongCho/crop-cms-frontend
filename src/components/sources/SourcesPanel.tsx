import type { components } from "../../api/schema";
import SourceCard from "./SourceCard";

type Doc = components["schemas"]["CitedDocument"];

export default function SourcesPanel({ documents }: { documents: Doc[] }) {
  if (documents.length === 0) return null;
  return (
    <section aria-labelledby="sources-heading">
      <h2 id="sources-heading" className="text-xl leading-tight font-semibold">Sources</h2>
      <ul className="mt-3 space-y-3">
        {documents.map((d) => (
          <SourceCard key={d.key} doc={d} />
        ))}
      </ul>
    </section>
  );
}
