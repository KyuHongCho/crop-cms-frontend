import { useState } from "react";
import type { components } from "../api/schema";
import { Button } from "@/components/ui/button";

type Doc = components["schemas"]["CitedDocument"];

// Model-adjacent text may carry any scheme (javascript:, data:); only http(s) becomes a link.
export function safeHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function provenance(doc: Doc): string {
  if (doc.read_directly) return "Read directly from the source";
  return doc.via ? `Via ${doc.via}` : "Not read directly";
}

function Citation({ doc }: { doc: Doc }) {
  const [open, setOpen] = useState(false);
  const href = safeHttpUrl(doc.url);
  return (
    <li>
      <strong>[{doc.key}]</strong> {doc.title}
      {doc.crop_slug && <span className="tag"> Crop: {doc.crop_slug}</span>}
      <div>
        {doc.source}, {doc.reference}
      </div>
      <div>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {href}
          </a>
        ) : (
          <span>{doc.url}</span>
        )}
      </div>
      <div className="muted">{provenance(doc)}</div>
      {doc.condition && <div>Condition: {doc.condition}</div>}
      {doc.licence_note && <div>Licence: {doc.licence_note}</div>}
      <Button type="button" variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Hide text" : "Show text"}
      </Button>
      {open && <div className="doc-body">{doc.body}</div>}
    </li>
  );
}

export default function Citations({ documents }: { documents: Doc[] }) {
  if (documents.length === 0) return null;
  return (
    <section aria-label="Citations">
      <h2>Citations</h2>
      <ul>
        {documents.map((d) => (
          <Citation key={d.key} doc={d} />
        ))}
      </ul>
    </section>
  );
}
