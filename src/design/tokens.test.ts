import { readFileSync } from "node:fs";
import { resolve as path } from "node:path";
import { describe, expect, it } from "vitest";
import { ROWS, hexToRgb, ratio, resolve, type Rgb } from "./contrast";

const read = (f: string) => readFileSync(path(process.cwd(), f), "utf8");
const css = read("src/index.css");
const design = read("DESIGN.md");

const HEX = [
  "background", "card", "foreground", "muted-foreground", "muted", "primary", "primary-foreground",
  "cite", "notice-foreground", "notice", "destructive", "border", "input",
];
const ALIASES: Record<string, string> = {
  "card-foreground": "foreground",
  popover: "card",
  "popover-foreground": "foreground",
  secondary: "muted",
  "secondary-foreground": "foreground",
  accent: "muted",
  "accent-foreground": "foreground",
  ring: "primary",
};

function block(selector: RegExp): Record<string, string> {
  const m = css.match(selector);
  if (!m) throw new Error(`block ${selector} not found in src/index.css`);
  const props: Record<string, string> = {};
  for (const [, k, v] of m[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) props[k] = v.trim();
  return props;
}

const themes = {
  light: block(/^:root\s*\{([^}]*)\}/m),
  dark: block(/^\.dark\s*\{([^}]*)\}/m),
};

function tokens(props: Record<string, string>): Record<string, Rgb> {
  const t: Record<string, Rgb> = {};
  for (const k of HEX) t[k] = hexToRgb(props[k]);
  for (const [k, v] of Object.entries(ALIASES)) t[k] = t[v];
  return t;
}

describe.each(["light", "dark"] as const)("%s tokens", (name) => {
  const props = themes[name];
  it("has exactly 13 hex values and 8 aliases", () => {
    const names = Object.keys(props).filter((k) => k !== "radius");
    const hex = names.filter((k) => /^#[0-9a-f]{6}$/.test(props[k]));
    const alias = names.filter((k) => /^var\(--[\w-]+\)$/.test(props[k]));
    expect(hex.sort()).toEqual([...HEX].sort());
    expect(alias.sort()).toEqual(Object.keys(ALIASES).sort());
    expect(names.length).toBe(21);
    expect(names.some((k) => k.startsWith("chart-") || k.startsWith("sidebar"))).toBe(false);
  });

  it("aliases point at the decided token", () => {
    for (const [k, v] of Object.entries(ALIASES)) expect(props[k]).toBe(`var(--${v})`);
  });
});

it("contains no oklch, rgb or hsl colour anywhere in src/index.css", () => {
  expect(css).not.toMatch(/\b(oklch|oklab|rgba?|hsla?)\(/);
});

describe("contrast table", () => {
  const computed = ROWS.map((r) => {
    const cell = (theme: "light" | "dark") => {
      const t = tokens(themes[theme]);
      return ratio(resolve(r.fg, t), resolve(r.bg, t));
    };
    return { ...r, light: r.light ? cell("light") : null, dark: cell("dark") };
  });

  it("has 36 rows", () => {
    expect(computed.map((r) => r.n)).toEqual(Array.from({ length: 36 }, (_, i) => i + 1));
  });

  it.each(computed)("row $n meets its floor", (r) => {
    if (r.floor === null) return;
    if (r.light !== null) expect(r.light).toBeGreaterThanOrEqual(r.floor);
    expect(r.dark).toBeGreaterThanOrEqual(r.floor);
  });

  it("DESIGN.md lists exactly rows 1-36 with the computed ratios", () => {
    const rows = [...design.matchAll(/^\| (\d+) \| (.*) \| ([\d.—]+) \| ([\d.]+) \| ([^|]+?) \|$/gm)];
    expect(rows.map((m) => Number(m[1]))).toEqual(computed.map((r) => r.n));
    for (const [i, m] of rows.entries()) {
      const c = computed[i];
      expect(m[3], `row ${c.n} light`).toBe(c.light === null ? "—" : c.light.toFixed(2));
      expect(m[4], `row ${c.n} dark`).toBe(c.dark.toFixed(2));
      expect(m[5], `row ${c.n} floor`).toBe(c.floor === null ? "none (decorative)" : String(c.floor));
    }
  });
});
