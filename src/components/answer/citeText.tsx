import type { ReactNode } from "react";
import { focusSource, sourceId } from "../sources/sourceLinks";

// Mirrors the backend parser: any bracket group, then S<digits> inside it. Only keys that were
// actually sent become links; the characters rendered are exactly the input's.
export function citeText(text: string, keys: ReadonlySet<string>): ReactNode[] {
  const out: ReactNode[] = [];
  let plain = "";
  const flush = () => {
    if (plain) out.push(plain);
    plain = "";
  };
  let last = 0;
  for (const group of text.matchAll(/\[([^\]]*)\]/g)) {
    const start = group.index + 1;
    plain += text.slice(last, start);
    let at = 0;
    for (const m of group[1].matchAll(/S\d+/g)) {
      if (!keys.has(m[0])) continue;
      plain += group[1].slice(at, m.index);
      flush();
      const key = m[0];
      out.push(
        <a
          key={`${start}-${m.index}`}
          href={`#${sourceId(key)}`}
          onClick={(ev) => {
            ev.preventDefault();
            focusSource(key);
          }}
          className="rounded-sm text-cite underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          {key}
        </a>,
      );
      at = m.index + key.length;
    }
    plain += group[1].slice(at);
    last = start + group[1].length;
  }
  plain += text.slice(last);
  flush();
  return out;
}
