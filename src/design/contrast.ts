export type Rgb = [number, number, number];
export type Spec = string | { tok: string; a: number; over: string };

export type Row = { n: number; label: string; fg: Spec; bg: Spec; floor: number | null; light: boolean };

const t = (tok: string, a: number, over: string): Spec => ({ tok, a, over });

export const ROWS: Row[] = [
  { n: 1, label: "foreground / background (body)", fg: "foreground", bg: "background", floor: 4.5, light: true },
  { n: 2, label: "foreground / card (= card-foreground; popover-foreground on popover)", fg: "foreground", bg: "card", floor: 4.5, light: true },
  { n: 3, label: "foreground / muted (= accent-fg/accent menu focus, secondary-fg/secondary chip, ghost and outline hover in light)", fg: "foreground", bg: "muted", floor: 4.5, light: true },
  { n: 4, label: "muted-foreground / background", fg: "muted-foreground", bg: "background", floor: 4.5, light: true },
  { n: 5, label: "muted-foreground / card", fg: "muted-foreground", bg: "card", floor: 4.5, light: true },
  { n: 6, label: "muted-foreground / muted", fg: "muted-foreground", bg: "muted", floor: 4.5, light: true },
  { n: 7, label: "primary-foreground / primary (default button, badge none)", fg: "primary-foreground", bg: "primary", floor: 4.5, light: true },
  { n: 8, label: "primary-foreground / primary 90% over card (default button hover)", fg: "primary-foreground", bg: t("primary", 0.9, "card"), floor: 4.5, light: true },
  { n: 9, label: "primary-foreground / primary 90% over background", fg: "primary-foreground", bg: t("primary", 0.9, "background"), floor: 4.5, light: true },
  { n: 10, label: "primary / background (links, nav)", fg: "primary", bg: "background", floor: 4.5, light: true },
  { n: 11, label: "primary / card", fg: "primary", bg: "card", floor: 4.5, light: true },
  { n: 12, label: "primary / muted (link inside a hovered or focused row)", fg: "primary", bg: "muted", floor: 4.5, light: true },
  { n: 13, label: "ring (opaque) / background", fg: "ring", bg: "background", floor: 3, light: true },
  { n: 14, label: "ring (opaque) / card", fg: "ring", bg: "card", floor: 3, light: true },
  { n: 15, label: "cite / card (markers in the answer)", fg: "cite", bg: "card", floor: 4.5, light: true },
  { n: 16, label: "cite / background", fg: "cite", bg: "background", floor: 4.5, light: true },
  { n: 17, label: "cite / notice (markers inside a notice block)", fg: "cite", bg: "notice", floor: 4.5, light: true },
  { n: 18, label: "notice-foreground / notice (notice chip and block)", fg: "notice-foreground", bg: "notice", floor: 4.5, light: true },
  { n: 19, label: "foreground / notice", fg: "foreground", bg: "notice", floor: 4.5, light: true },
  { n: 20, label: "destructive / card (Alert destructive title, FormError)", fg: "destructive", bg: "card", floor: 4.5, light: true },
  { n: 21, label: "destructive / background (over-limit counter)", fg: "destructive", bg: "background", floor: 4.5, light: true },
  { n: 22, label: "destructive 90% over card / card (Alert destructive description, `text-destructive/90`)", fg: t("destructive", 0.9, "card"), bg: "card", floor: 4.5, light: true },
  { n: 23, label: "foreground / muted 50% over card (Card footer `bg-muted/50`; dark ghost hover on card)", fg: "foreground", bg: t("muted", 0.5, "card"), floor: 4.5, light: true },
  { n: 24, label: "muted-foreground / muted 50% over card (Card footer text)", fg: "muted-foreground", bg: t("muted", 0.5, "card"), floor: 4.5, light: true },
  { n: 25, label: "primary / muted 50% over card (Card footer link)", fg: "primary", bg: t("muted", 0.5, "card"), floor: 4.5, light: true },
  { n: 26, label: "foreground / muted 50% over background (dark ghost hover, `dark:hover:bg-muted/50`)", fg: "foreground", bg: t("muted", 0.5, "background"), floor: 4.5, light: false },
  { n: 27, label: "foreground / input 30% over card (dark input, textarea and outline-button fill, `dark:bg-input/30`)", fg: "foreground", bg: t("input", 0.3, "card"), floor: 4.5, light: false },
  { n: 28, label: "muted-foreground / input 30% over card (dark placeholder, if any)", fg: "muted-foreground", bg: t("input", 0.3, "card"), floor: 4.5, light: false },
  { n: 29, label: "foreground / input 30% over background", fg: "foreground", bg: t("input", 0.3, "background"), floor: 4.5, light: false },
  { n: 30, label: "muted-foreground / input 30% over background", fg: "muted-foreground", bg: t("input", 0.3, "background"), floor: 4.5, light: false },
  { n: 31, label: "foreground / input 50% over card (dark outline-button hover, `dark:hover:bg-input/50`)", fg: "foreground", bg: t("input", 0.5, "card"), floor: 4.5, light: false },
  { n: 32, label: "foreground / input 50% over background", fg: "foreground", bg: t("input", 0.5, "background"), floor: 4.5, light: false },
  { n: 33, label: "input / card (control edge: input, textarea, outline button after D11)", fg: "input", bg: "card", floor: 3, light: true },
  { n: 34, label: "input / background (control edge)", fg: "input", bg: "background", floor: 3, light: true },
  { n: 35, label: "border / card (decorative dividers, Badge outline unused)", fg: "border", bg: "card", floor: null, light: true },
  { n: 36, label: "border / background (decorative)", fg: "border", bg: "background", floor: null, light: true },
];

export function hexToRgb(h: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

// WCAG 2.x relative luminance on unrounded channel values.
function lum([r, g, b]: Rgb): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function resolve(spec: Spec, tokens: Record<string, Rgb>): Rgb {
  if (typeof spec === "string") return tokens[spec];
  const x = tokens[spec.tok];
  const s = tokens[spec.over];
  return x.map((c, i) => c * spec.a + s[i] * (1 - spec.a)) as Rgb;
}

export function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
