import { useState } from "react";
import { BookOpenCheck, Forward } from "lucide-react";
import type { components } from "../../api/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sourceId } from "./sourceLinks";

// The key exists only on cited documents; retrieval documents have none.
type Doc = Omit<components["schemas"]["CitedDocument"], "key"> & { key?: string };

// Model-adjacent text may carry any scheme (javascript:, data:); only http(s) becomes a link.
export function safeHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export default function SourceCard({ doc }: { doc: Doc }) {
  const [open, setOpen] = useState(false);
  const href = safeHttpUrl(doc.url);
  return (
    <li
      id={doc.key ? sourceId(doc.key) : undefined}
      tabIndex={doc.key ? -1 : undefined}
      className={cn("rounded-xl border bg-card p-4 text-sm text-card-foreground outline-none", doc.key && "focus:ring-3 focus:ring-ring")}
    >
      <h3 className="font-medium">
        {doc.key && <span className="mr-2 text-cite">{`[${doc.key}]`}</span>}
        {doc.title}
      </h3>
      {doc.crop_slug && <p className="mt-1 text-muted-foreground">{`Crop: ${doc.crop_slug}`}</p>}
      <p className="mt-1">{`${doc.source}, ${doc.reference}`}</p>
      <p className="mt-1">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            {href}
          </a>
        ) : (
          doc.url
        )}
      </p>
      {doc.read_directly ? (
        <p className="mt-2 flex items-start gap-1.5 text-muted-foreground">
          <BookOpenCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>Read directly from the source</span>
        </p>
      ) : (
        <p className="mt-2 flex items-start gap-1.5 text-muted-foreground">
          <Forward aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{doc.via ? `Via ${doc.via}` : "Not read directly"}</span>
        </p>
      )}
      {doc.condition && <p className="mt-1">{`Condition: ${doc.condition}`}</p>}
      {doc.licence_note && <p className="mt-1">{`Licence: ${doc.licence_note}`}</p>}
      <Button type="button" variant="outline" size="sm" className="mt-3" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Hide text" : "Show text"}
      </Button>
      {open && <div className="mt-3 whitespace-pre-wrap">{doc.body}</div>}
    </li>
  );
}
