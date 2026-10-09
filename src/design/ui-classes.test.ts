import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "src");
const read = (f: string) => readFileSync(f, "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const rel = (f: string) => relative(process.cwd(), f).split("\\").join("/");
const all = walk(root);
const ui = all.filter((f) => rel(f).startsWith("src/components/ui/") && f.endsWith(".tsx"));
const app = all.filter((f) => f.endsWith(".tsx") && !rel(f).startsWith("src/components/ui/") && !f.endsWith(".test.tsx"));
const cssFile = resolve(root, "index.css");

const FORBIDDEN = ["ring-ring/", "outline-ring/", "bg-primary/80", "text-white", "chart-", "sidebar-"];

// Variant literals each file may pass; every other value, including a computed one, fails.
const OK_VARIANTS: Record<string, string[]> = {
  default: ["default", "outline", "ghost"],
  "src/components/answer/StatusChip.tsx": ["secondary", "notice"],
  "src/components/FormError.tsx": ["destructive"],
};

describe("generated ui files", () => {
  it("scans a non-empty file list", () => {
    expect(ui.length).toBeGreaterThanOrEqual(10);
    expect(app.length).toBeGreaterThan(0);
  });

  it.each([...ui, cssFile].map((f) => [rel(f), f]))("%s has no forbidden translucent or fixed-colour class", (_n, f) => {
    const text = read(f);
    for (const bad of FORBIDDEN) expect(text, bad).not.toContain(bad);
  });

  // A scroll-padding-top on html scrolls the page when a sticky-bar link takes keyboard focus; the clearance
  // belongs on the jump target (SourceCard, scroll-mt-18), which only scrollIntoView ever aims at.
  it("index.css has no scroll-padding-top, and a source card keeps its clearance below the sticky bar", () => {
    expect(read(cssFile)).not.toContain("scroll-padding");
    expect(read(resolve(root, "components/sources/SourceCard.tsx"))).toContain("scroll-mt-18");
  });

  it("button.tsx has no border-border", () => {
    expect(read(resolve(root, "components/ui/button.tsx"))).not.toContain("border-border");
  });
});

describe("app files keep the not-rendered list true", () => {
  it.each(app.map((f) => [rel(f), f]))("%s", (name, f) => {
    const text = read(f);
    expect(text).not.toContain("aria-invalid");

    const allowed = OK_VARIANTS[name] ?? OK_VARIANTS.default;
    for (const m of text.matchAll(/\bvariant\s*[=:]\s*(\{\s*)?(["'`])?([^"'`}\s,)]*)/g)) {
      expect(m[2] && allowed.includes(m[3]), `${name}: variant ${m[0]}`).toBe(true);
    }

    const badge = /from\s+["'][^"']*\/ui\/badge["']/.test(text);
    expect(badge, `${name} imports badge`).toBe(name === "src/components/answer/StatusChip.tsx" ? badge : false);
    const alert = /from\s+["'][^"']*\/ui\/alert["']/.test(text);
    expect(alert, `${name} imports alert`).toBe(name === "src/components/FormError.tsx" ? alert : false);
  });
});
