# Design system — Crop CMS ("Field, sage")

Section 2 (tokens, contrast, colour rules) states exactly what the app ships; sections 3 to 13
describe the design, which is built except react-i18next.
Two tests keep it true: `src/design/tokens.test.ts`
(colours and contrast) and `src/design/ui-classes.test.ts` (which generated classes and variants may
be rendered). Change the app and this file together.

## 1. Principles

- An answer page with sources, not a chat thread. The API takes one question and returns one answer.
- Calm and document-like: long-form text in a readable column, one accent colour.
- Borders over shadows. Shadows appear only on menus.
- Nothing relies on colour alone (section 3).

## 2. Colour

Every colour is a 6-digit lowercase hex value or a `var(--token)` alias of one. There is no OKLCH:
the build keeps hex, so the ratios below are the ratios of the shipped CSS. Tokens live in
`src/index.css` (`:root` for light, `.dark` for dark).

### Light

| Token | Value | Role |
|---|---|---|
| background | #f4f7f2 | page |
| surface/card | #ffffff | cards, menus (`--card`) |
| foreground | #1b2721 | body text |
| muted-foreground | #56635b | secondary text |
| muted | #e8eee6 | hover and focus fills, card footers |
| primary | #2f6b4f | buttons, links, focus ring |
| primary-foreground | #ffffff | text on primary |
| cite | #8a5a12 | citation markers |
| notice-foreground | #7a4b0c | text in notices |
| notice (bg) | #fbf1d9 | notice fill |
| destructive | #b4362c | error text |
| border | #d8e0d6 | decorative dividers |
| input | #7f8a82 | control edges |

### Dark

| Token | Value |
|---|---|
| background | #0f1612 |
| surface/card | #16201a |
| foreground | #e2eae4 |
| muted-foreground | #9fada4 |
| muted | #1e2a23 |
| primary | #7bc59a |
| primary-foreground | #0f1f16 |
| cite | #e0b060 |
| notice-foreground | #f2d9a0 |
| notice (bg) | #3a2e14 |
| destructive | #f08a7e |
| border | #26332b |
| input | #66746b |

### shadcn tokens, aliased (both themes)

| Token | Alias |
|---|---|
| `--card-foreground` | `var(--foreground)` |
| `--popover` | `var(--card)` |
| `--popover-foreground` | `var(--foreground)` |
| `--secondary` | `var(--muted)` |
| `--secondary-foreground` | `var(--foreground)` |
| `--accent` | `var(--muted)` |
| `--accent-foreground` | `var(--foreground)` |
| `--ring` | `var(--primary)` |

Deleted: `--chart-1` to `--chart-5` and the eight `--sidebar-*` tokens, with their `@theme inline`
mappings. Nothing uses them. Added `@theme inline` mappings: `--color-cite`, `--color-notice`,
`--color-notice-foreground`. `--radius` stays `0.625rem`.

Not defined: a destructive foreground. No solid destructive fill is used: white on dark destructive
measures 2.43. Destructive appears only as text, or as text on its own translucent tint.

Only `#ffffff` is shortenable (to `#fff`) by the build, and nothing is uppercase, so comparisons
against `dist/` normalise first.

### Compositing rule

A translucent `X/a` over surface S is composited per channel as `X·a + S·(1−a)` on unrounded 0–255
values. Relative luminance and ratio follow WCAG 2.x, rounded to 2 decimal places only for comparison
with this table. The token test computes exactly this.

### Contrast table

Floors: text 4.5; non-text (control boundary, focus ring) 3. Translucent rows use the compositing
rule. "—" in the light column marks a class that exists only with a `dark:` prefix; in light the same
element uses an opaque token already covered by rows 1–3, 33 and 34 (the outline button is
`bg-background` with `hover:bg-muted`, and inputs are transparent).

| # | Pair (where it renders) | Light | Dark | Floor |
|---|---|---|---|---|
| 1 | foreground / background (body) | 14.30 | 14.97 | 4.5 |
| 2 | foreground / card (= card-foreground; popover-foreground on popover) | 15.46 | 13.64 | 4.5 |
| 3 | foreground / muted (= accent-fg/accent menu focus, secondary-fg/secondary chip, ghost and outline hover in light) | 13.10 | 12.14 | 4.5 |
| 4 | muted-foreground / background | 5.83 | 7.86 | 4.5 |
| 5 | muted-foreground / card | 6.30 | 7.16 | 4.5 |
| 6 | muted-foreground / muted | 5.34 | 6.37 | 4.5 |
| 7 | primary-foreground / primary (default button, badge none) | 6.29 | 8.38 | 4.5 |
| 8 | primary-foreground / primary 90% over card (default button hover) | 5.01 | 7.05 | 4.5 |
| 9 | primary-foreground / primary 90% over background | 5.08 | 6.97 | 4.5 |
| 10 | primary / background (links, nav) | 5.82 | 9.00 | 4.5 |
| 11 | primary / card | 6.29 | 8.20 | 4.5 |
| 12 | primary / muted (link inside a hovered or focused row) | 5.34 | 7.30 | 4.5 |
| 13 | ring (opaque) / background | 5.82 | 9.00 | 3 |
| 14 | ring (opaque) / card | 6.29 | 8.20 | 3 |
| 15 | cite / card (markers in the answer) | 5.91 | 8.40 | 4.5 |
| 16 | cite / background | 5.47 | 9.22 | 4.5 |
| 17 | cite / notice (markers inside a notice block) | 5.26 | 6.67 | 4.5 |
| 18 | notice-foreground / notice (notice chip and block) | 6.58 | 9.62 | 4.5 |
| 19 | foreground / notice | 13.75 | 10.83 | 4.5 |
| 20 | destructive / card (Alert destructive title, FormError) | 5.99 | 6.88 | 4.5 |
| 21 | destructive / background (over-limit counter) | 5.54 | 7.56 | 4.5 |
| 22 | destructive 90% over card / card (Alert destructive description, `text-destructive/90`) | 5.02 | 5.81 | 4.5 |
| 23 | foreground / muted 50% over card (Card footer `bg-muted/50`; dark ghost hover on card) | 14.25 | 12.90 | 4.5 |
| 24 | muted-foreground / muted 50% over card (Card footer text) | 5.81 | 6.77 | 4.5 |
| 25 | primary / muted 50% over card (Card footer link) | 5.80 | 7.75 | 4.5 |
| 26 | foreground / muted 50% over background (dark ghost hover, `dark:hover:bg-muted/50`) | — | 13.62 | 4.5 |
| 27 | foreground / input 30% over card (dark input, textarea and outline-button fill, `dark:bg-input/30`) | — | 9.77 | 4.5 |
| 28 | muted-foreground / input 30% over card (dark placeholder, if any) | — | 5.13 | 4.5 |
| 29 | foreground / input 30% over background | — | 10.76 | 4.5 |
| 30 | muted-foreground / input 30% over background | — | 5.65 | 4.5 |
| 31 | foreground / input 50% over card (dark outline-button hover, `dark:hover:bg-input/50`) | — | 7.56 | 4.5 |
| 32 | foreground / input 50% over background | — | 8.14 | 4.5 |
| 33 | input / card (control edge: input, textarea, outline button after D11) | 3.58 | 3.40 | 3 |
| 34 | input / background (control edge) | 3.32 | 3.74 | 3 |
| 35 | border / card (decorative dividers, Badge outline unused) | 1.35 | 1.27 | none (decorative) |
| 36 | border / background (decorative) | 1.25 | 1.39 | none (decorative) |

### Not rendered or exempt

Every other translucent class in the generated files gets no row:

- **Unused variants** (guard test):
  - `button.tsx`: `bg-destructive/10`, `dark:bg-destructive/20`, `hover:bg-destructive/20`,
    `dark:hover:bg-destructive/30`, `focus-visible:border-destructive/40`,
    `focus-visible:ring-destructive/20`, `dark:focus-visible:ring-destructive/40` (destructive variant);
    the `color-mix(…var(--secondary)…)` hover (secondary variant).
  - `badge.tsx`: `bg-destructive/10`, `dark:bg-destructive/20`, `[a]:hover:bg-destructive/20`,
    `focus-visible:ring-destructive/20`, `dark:focus-visible:ring-destructive/40` (destructive variant);
    `[a]:hover:bg-secondary/80` and `[a]:hover:bg-primary/90` (link form, never used);
    `dark:hover:bg-muted/50` (ghost variant).
  - `dropdown-menu.tsx`: `data-[variant=destructive]:focus:bg-destructive/10`,
    `dark:data-[variant=destructive]:focus:bg-destructive/20`.
- **`aria-invalid` styling, never set:** `aria-invalid:ring-destructive/20`,
  `dark:aria-invalid:ring-destructive/40` and `dark:aria-invalid:border-destructive/50` in
  `button.tsx`, `badge.tsx`, `input.tsx` and `textarea.tsx`.
- **Disabled fills, exempt under WCAG 1.4.3 and never set on inputs:** `disabled:bg-input/50` and
  `dark:disabled:bg-input/80` in `input.tsx` and `textarea.tsx`.
- **Decorative container edges:** `ring-foreground/10` on Card and on DropdownMenu content and
  sub-content (2×). It measures 1.21 / 1.30 against card. Menu items are identified by their text, so
  it is not a control boundary.
- **Removed by D11 (below):** every `ring-ring/50`; `hover:bg-primary/80` in Button and
  `[a]:hover:bg-primary/80` in Badge.

### Rules

- **Control edges.** Every interactive control whose edge marks it out (inputs, textareas, outline
  buttons) uses the `input` token for that edge, at 3:1 or more against the colour outside it.
  `border` (1.25–1.39) is decorative only: card and section dividers, and non-interactive chips. It is
  never the only edge of an interactive control. The guard test enforces this for the outline button.
- **Boundary measurement.** Per WCAG 1.4.11, a control's boundary is measured against the colour
  *outside* it. The dark input boundary against its own 30% fill (2.44 under the compositing rule) is
  therefore not the rule's figure; input/card and input/background (rows 33 and 34) are.
- **Focus.** The focus ring is opaque `ring` (= primary). Translucent rings are forbidden (D11).
- **Translucency.** Every translucent colour the app renders is a row in the table above, measured
  with the compositing rule. A translucent class that is not in the table may exist in a generated file
  only if it is listed under "Not rendered or exempt", and the guard test keeps it unrendered.
- **Changes.** Any token change, any new variant, and any translucent class that starts being rendered
  means re-measuring it and updating this table. `src/design/tokens.test.ts` fails when the table and
  `src/index.css` disagree. The excluded classes are exempt: inactive (disabled) controls under WCAG
  1.4.3, and decorative container edges.

### D11 — permitted edits to generated `src/components/ui/*`, for contrast only

- `ring-ring/50` becomes `ring-ring` in `button.tsx`, `badge.tsx`, `input.tsx` and `textarea.tsx`;
  `outline-ring/50` becomes `outline-ring` in the `index.css` base layer. A 50% ring measures 2.15 /
  2.21 in light, below 3:1.
- `hover:bg-primary/80` becomes `hover:bg-primary/90` in `button.tsx`; `[a]:hover:bg-primary/80` becomes
  `[a]:hover:bg-primary/90` in `badge.tsx`. primary-foreground on primary/80 measures 4.00 in light.
- `border-border` becomes `border-input` on the Button `outline` variant in `button.tsx`. The variant's
  dark classes (`dark:border-input`) stay. `border` measures 1.25 / 1.35 in light and cannot be a
  control's only edge.

Re-running `shadcn add` can bring these back; the guard test fails when it does.

One further hand edit is not for contrast: `badge.tsx` has a local variant
`notice: "bg-notice text-notice-foreground"` (row 18), which `StatusChip` uses. A `shadcn add badge`
re-run would remove it, and typecheck would then fail on `variant="notice"`.

### What the guard test does and does not catch

`src/design/ui-classes.test.ts` fails when:

1. a file in `src/components/ui/*.tsx`, or `src/index.css`, contains `ring-ring/`, `outline-ring/`,
   `bg-primary/80`, `text-white`, `chart-` or `sidebar-`;
2. `button.tsx` contains `border-border`;
3. a `src/**/*.tsx` file outside `src/components/ui/` and outside `*.test.tsx`
   - contains `aria-invalid`;
   - has any `variant=` or `variant:` whose value is not a string literal from its allow-list
     (`default`, `outline`, `ghost`, `link`; plus `secondary` and `notice` in
     `src/components/answer/StatusChip.tsx`; plus `destructive` in `src/components/FormError.tsx`). This
     covers `variant="destructive"`, `variant={"destructive"}`, single and backtick quotes,
     `buttonVariants({ variant: "secondary" })`, a computed value such as `variant={v}`, and a Badge in
     StatusChip using `outline`, `ghost`, `link` or `destructive`;
   - imports `ui/badge` (any specifier ending in `/ui/badge`, alias or relative) outside `StatusChip.tsx`, or `ui/alert` outside
     `FormError.tsx`;
4. any of the file lists it scans is empty.

It does **not** catch: an unused variant reached without a `variant` prop (a hand-written
`className` that spells a translucent class, such as `bg-destructive/10`); a variant name held in a
string that is not next to `variant=` or `variant:`; `{...props}` spreads that carry a variant; a
literal built by concatenation or a template with interpolation; or `disabled` on an Input or
Textarea; an edit to a generated file that adds a new translucent class not on the forbidden list (for
example changing `hover:bg-primary/90` to `/60`), which needs a table re-measurement by hand. Review catches those, and the translucency rule above still requires a table row for any
translucent class that is rendered.

## 3. Colour-blind rule

No state relies on colour alone. Every state has an icon and text. Citations are identified by their
key text (`[S1]`), not by the ochre colour; a marker in the answer is also underlined. On the Ask page
that means: the over-limit counter (`CircleAlert`), the status chips (`CircleSlash`, `Scissors`,
`ListMinus`), the budget block (`Hourglass`), errors (`CircleAlert`, or `WifiOff` offline) and each
source's provenance line (`BookOpenCheck`, `Forward`). On the Library pages: errors
(`CircleAlert`, `WifiOff` offline) and empty lists (`CircleSlash`).

## 4. Typography

- Pretendard Variable (Latin and Korean), self-hosted from the `pretendard` npm package, with the
  fallback stack `"Pretendard Variable", Pretendard, system-ui, sans-serif`. Licence: SIL OFL 1.1.
- Sizes: 14px labels, 16px body and inputs, 18px the answer, 20 / 24 / 30px headings.
- Line height 1.6 for body, 1.25–1.3 for headings.
- Answer column maximum 68ch.
- `word-break: keep-all` on body, so Korean wraps by word; `overflow-wrap: anywhere` on long text.

## 5. Spacing and layout

- 4px grid: 4 / 8 / 12 / 16 / 24 / 32 / 48.
- Gutters 16 / 24 / 32px at base / `sm` / `lg`.
- 56px top bar (`src/shell/AppShell.tsx`): logo and wordmark linking to `/chat`, the nav "Ask · Library",
  and the member menu at the right. Below `sm` the wordmark is hidden so the bar stays one row. The shell
  owns the page's one `<main>`; pages render inside it and must not add another.
- Ask page (`src/pages/ChatPage.tsx`): the answer card (`src/components/answer/`) in a column of at most
  68ch, and the sources panel (`src/components/sources/`) about 360px wide beside it from `lg`
  (1024px and up), stacked below that.
- Library pages (`src/pages/library/`): one column of at most `max-w-3xl` (48rem) inside the shell's
  `<main>`. `/library` lists crops as bordered cards (common name, scientific name in italics);
  `/library/:cropSlug` lists published topics with a document count; `/library/:cropSlug/:topic`
  shows "N documents" and the documents as source cards in a list, without the `[S1]` key. The crop
  and topic pages have a "Back to ..." link above their heading. Loading shows skeletons with a status line; 404, 413 and
  other errors use `FormError` (icon and text); an empty topic list or document list is a status line
  with an icon. Rows use `hover:bg-muted` (rows 3 and 6), not a translucent class.
  The Library sits behind `RequireAuth` as a UI choice, not a security boundary: `GET /crops`,
  `GET /items` and `GET /retrieval/...` are public.

## 6. Radius, borders, elevation

`0.625rem` radius, 1px borders, shadows only on menus.

## 7. Motion

Colour transitions run 150ms; menus fade and zoom in over 100ms. `prefers-reduced-motion: reduce` removes both.

## 8. Icons

lucide-react: 16px inline, 20px for the account icon in the top bar, `aria-hidden` beside visible text.

| State | Tone | Icon |
|---|---|---|
| No answer / abstained | neutral | `CircleSlash` |
| Cut off / truncated | notice | `Scissors` |
| Topics dropped | neutral | `ListMinus` |
| Budget (429) | notice | `Hourglass` |
| Error | destructive | `CircleAlert` |
| Offline | destructive | `WifiOff` |
| Empty list | neutral | `CircleSlash` |
| Read first-hand | — | `BookOpenCheck` |
| Via another source | — | `Forward` |
| Informational notice (session expired, account created) | notice | `Info` |

An icon may be swapped only by updating this table.

## 9. Logo

Our own hand-drawn sprout, drawn in `currentColor` (primary on the auth pages), `aria-hidden`, with the
wordmark "Crop CMS" as real text beside it. Minimum size 24px for the mark; clear space of half the
mark's height on every side. The same mark is `public/favicon.svg`.

## 10. Dark mode

- `light | dark | system`, default `system`, stored in `localStorage` key `crop-cms-theme`.
- Set before paint by an inline script in `index.html`, so a reload does not flash.
- `ThemeProvider` wraps the routes in `AppRoutes`; `useTheme` throws outside it; a missing
  `matchMedia` is tolerated.
- Dark applies the `.dark` class on `<html>`; `color-scheme` follows it.
- The choice is made in the member menu, as a Light / Dark / System radio group.

## 11. Components

- shadcn (`radix-nova` style, base colour `stone` recorded in `components.json`; no visual effect,
  because every colour token is overridden): Button, Input, Label, Textarea, Card, Badge, Alert,
  DropdownMenu, Separator, Skeleton.
- Variants the app renders: Button `default | outline | ghost | link`; Badge `secondary` plus a local
  `notice` variant, only inside `StatusChip`, never as a link; Alert `destructive`, only inside
  `FormError`; Card with header, content and footer; DropdownMenu items without
  `variant="destructive"`; Input and Textarea, never `disabled`, never `aria-invalid`.
- Not rendered: Button `secondary` / `destructive`; Badge `destructive` / `outline` / `ghost` / `link`;
  destructive menu items; `aria-invalid` styling. Using any of these later means measuring it first
  and adding a row to the table.
- **Alert is for errors only**, because it carries `role="alert"`. Notices and neutral states use
  `StatusChip` or a notice block with `role="status"`. The 429 budget message is the exception that
  stays `role="alert"`, drawn as a notice block (row 18) with `Hourglass`.
- `StatusChip` is Badge `secondary` (neutral, row 3) or the local Badge `notice` variant
  (`bg-notice text-notice-foreground`, row 18), with a 16px icon beside the text.
- Citation markers in the answer are ochre (`text-cite`, row 15) links to `#source-<key>`; the source
  card is focusable and takes focus when the marker is activated. Library cards have no marker and
  are neither focusable nor ringed.
- Edits to generated `ui/` files: see D11 in section 2.
- Every trigger's accessible name contains its visible label (Label in Name). The member menu trigger
  reads "Account: <name>" (the "Account: " part is screen-reader-only) and "Account" until the profile
  has loaded.

## 12. i18n readiness

Whole-sentence string literals; no sentences built from fragments; no text in CSS `content`; `lang` is
set on `<html>`; `keep-all`; no layout that assumes English length. react-i18next is not built yet.

## 13. Accessibility checklist

- A visible label on every field.
- Errors use `role="alert"`, non-errors `role="status"`.
- The answer sits in a polite, atomic live region.
- An opaque focus ring of at least 3:1.
- Full keyboard use, including the menu.
- Label in Name.
- http(s)-only links with `rel="noopener noreferrer"`.
- Plain-text rendering, no `dangerouslySetInnerHTML`.
- `aria-current` on the nav.
- Targets at least 24px.
- Reduced motion respected.
- A `<main>` per page.
