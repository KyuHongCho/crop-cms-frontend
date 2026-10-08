# Design notes

The reasoning behind the decisions summarised in the [README](../README.md).

## Trade-offs and known limits

The costs and known limits of these design decisions, in brief. Each is explained further down this
file or documented next to the code it concerns.

- **Chat is single-turn.** The backend answers one question at a time, so the page keeps no
  conversation; each answer replaces the last.
- **One tab holds a session.** The token is in `sessionStorage`, so a new tab or a restarted
  browser asks for a login. [More below](#token-storage-and-sessions)
- **There is no refresh token.** The backend token lasts 30 minutes by default and the app cannot
  renew it, so expiry returns the user to login.
- **The late-401 tests wait a fixed 50 ms.** The margin is about 10x on one development machine and
  unmeasured on a GitHub runner. [More below](#testing-details)
- **The live-region behaviour is confirmed in the DOM only.** The answer is a polite, atomic live
  region; a test asserts `aria-live` and the label, while `aria-atomic` and screen-reader output are
  unverified.
  [`src/pages/ChatPage.test.tsx`](../src/pages/ChatPage.test.tsx)
- **Field limits are mirrored by hand.** `openapi-typescript` does not emit limits such as
  `max_length`, so the forms repeat the server's numbers; the server stays the authority and its
  `422` is still shown. [More below](#api-types-and-drift)
- **The app is dev-proxy only.** The backend has no CORS middleware, so deployment needs a
  decision: same-origin hosting, or a backend change. [More below](#dev-proxy-and-cors)
- **Reset times are relative.** `formatReset` says "about 15 minutes", not a clock time, because
  `Retry-After` is a wait in seconds and a clock time would mean guessing the member's timezone.
  [`src/api/format.ts`](../src/api/format.ts)
- **The question counter counts trimmed code points.** The server counts code points too (pydantic),
  so an emoji is one character on both sides; UTF-16 units would count it twice.
  [`src/pages/ChatPage.tsx`](../src/pages/ChatPage.tsx)

- **The theme choice is in `localStorage`.** Unlike the token, it is not a secret and should survive
  a restart. [More below](#design-system)
- **Colours are hex, not OKLCH.** The build keeps hex, so the contrast ratios computed from the CSS
  are the shipped ones. [More below](#design-system)

## Token storage and sessions

The JWT lives in `sessionStorage` under one key, read and written only through
[`src/auth/token.ts`](../src/auth/token.ts). It survives a reload in the same tab, but not a new tab
or a browser restart. The backend token lasts 30 minutes by default (`ACCESS_TOKEN_EXPIRE_MINUTES`)
and there is no refresh, so when it expires the next call returns the user to login with "Your
session expired".

| Where the token lives | Survives reload | Survives restart | Exposed to XSS | Needs backend support |
|---|---|---|---|---|
| Memory only | No | No | Less (not readable from storage) | No |
| `sessionStorage` | Yes, same tab | No | Yes | No |
| `localStorage` | Yes | Yes | Yes | No |
| `httpOnly` cookie | Yes | Depends on expiry | No (script cannot read it) | Yes |

The "Exposed to XSS" cells for memory only and the `httpOnly` cookie are general web-security
reasoning, not tested here; injected script can still make authenticated requests with a cookie.

A cookie would remove the script-readable token, but the backend returns the token in the
response body and sets no cookie, so it is not an option here. `localStorage` would only add
survival across restarts, which gains little for a token that dies after 30 minutes and widens the
exposure to every tab. Memory only would log the user out on every reload. `sessionStorage` is the middle choice.

The remaining exposure is script injection, so the app avoids the ways model or document text could
become markup: there is no `dangerouslySetInnerHTML`, answers and citations render as plain text,
and a citation URL becomes a link only when it parses as `http` or `https`, with
`rel="noopener noreferrer"`.
[`src/components/Citations.tsx`](../src/components/Citations.tsx)

**A 401 ends the session only when the request's token is the one currently stored.** Otherwise a
late 401 for a token the user already replaced (log out, log in again while a request is in flight)
would end the new session. A test reproduces it and fails with the old condition.
A bad login's 401 carries no token, so it never reads as an expired session.
[`src/api/client.ts`](../src/api/client.ts)

## Design system

[`DESIGN.md`](../DESIGN.md) is the design guideline. It sits at the repo root beside the README, and
not under `docs/`, so it is not confused with this file, which holds engineering rationale.

- **Colour tokens are hex or a `var()` alias of a decided hex.** There is no OKLCH: shadcn's generated
  OKLCH values are replaced, so the ratios the test computes are the ratios of the shipped CSS. Dark
  mode is the `.dark` class on `<html>`.
- **Two tests keep it true.** [`tokens.test.ts`](../src/design/tokens.test.ts) parses
  `src/index.css`, computes every row of the contrast table, and compares it with `DESIGN.md`.
  [`ui-classes.test.ts`](../src/design/ui-classes.test.ts) fails if a generated component brings back one of the classes D11 removed, or the app renders a
  variant the table leaves out.
  `DESIGN.md` lists what that guard cannot see.
- **D11: a few generated lines are edited by hand,** for contrast only: `ring-ring/50` to `ring-ring`,
  `hover:bg-primary/80` to `/90`, and `border-border` to `border-input` on the outline Button. A later
  `npx shadcn add` can bring them back; the guard test then fails.
- **Theme.** `light | dark | system`, stored in `localStorage` under `crop-cms-theme`, and set before
  paint by an inline script in `index.html`. The script and
  [`ThemeProvider`](../src/theme/ThemeProvider.tsx) repeat a few lines, because the script must run
  before the bundle loads.
- **The shell owns `<main>`.** [`AppShell`](../src/shell/AppShell.tsx) renders the 56px bar and then the
  one `<main>` with the routed page inside it, so a page must not render its own. Login and signup sit
  outside the shell and keep theirs. The member menu
  ([`MemberMenu`](../src/shell/MemberMenu.tsx)) holds the email, the theme radio group and "Log out".
- **`/members/me` is fetched once per session, in the shell.**
  [`MemberProvider`](../src/auth/MemberContext.tsx) is keyed by the token, so a replaced session never
  shows the previous member, and a response for an old token is dropped. The Ask page reads the member
  from it and calls `refresh()` after an answer, so the request count is unchanged. Its error texts
  ("Could not load your profile (N).", "Could not reach the server.") are shown in the shell.
- **Only the login, signup and shell are fully restyled so far.** The Ask page has shadcn buttons and a
  textarea inside the old layout; its legacy classes live in a temporary block in `src/index.css`. The
  Library route is a placeholder heading.

## Dev proxy and CORS

The backend has no CORS middleware: a preflight request to it returned `405` with no
`Access-Control-*` headers. A browser page on another origin could therefore not call it, so the dev
server proxies instead. The browser calls `/api/*` on its own origin; the Vite proxy strips `/api`
and forwards to `VITE_API_TARGET` (default `http://127.0.0.1:8000`).
[`vite.config.ts`](../vite.config.ts)

The proxy exists only under `npm run dev`. A production build needs the app and the API served from
one origin, or a CORS change in the backend.

## API types and drift

[`src/api/schema.d.ts`](../src/api/schema.d.ts) is generated by `openapi-typescript` from the
backend's `/openapi.json`, committed, regenerated with `npm run gen:api` and checked with
`npm run check:api` ([`scripts/check-api.mjs`](../scripts/check-api.mjs)).

Only the declared `200`/`201`/`204` success responses and `422` are typed, because the backend declares nothing else;
the other statuses are mapped by hand in [`src/api/errors.ts`](../src/api/errors.ts).
`openapi-typescript` also does not emit field limits such as `max_length`, so the signup form and
the question counter repeat the server's numbers by hand.

The CI `schema-drift` job dumps the backend's OpenAPI from its committed code in natural key order:
sorting the keys reorders the generated types and makes `check:api` report a false "stale". The job
is advisory because it compares the whole schema, so it goes red for routes this app never calls.
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

## Error shapes

The backend's `detail` is a string, a list of validation items or an object, depending on the
route. [`normaliseError`](../src/api/errors.ts) turns every case into
`{ kind, status, message, retryAfter? }`, and each page decides what to show.

| Case | Backend answer | `kind` | Message the UI shows |
|---|---|---|---|
| Login, wrong email or password | `401`, `"Incorrect email or password"` | `unauthenticated` | "Incorrect email or password" |
| Bad or missing token | `401`, `"Not authenticated"` | `unauthenticated` | None; the session ends and login shows "Your session expired" |
| Signup, invite unusable | `400`, `"Invalid or expired invite"` | `bad_request` | The server's text, as given |
| Signup, email taken | `400`, `"Email already registered"` | `bad_request` | The server's text, as given |
| Any request body refused | `422`, `detail` is a list | `validation` | The items' `msg` values joined with "; " |
| Chat, daily budget spent | `429`, `"Daily token budget exhausted"`, `Retry-After` in seconds | `rate_limited` | "Daily budget used up. It resets in about N hours." |
| Login, throttled | `429`, `"Too many failed attempts"`, `Retry-After` in seconds | `rate_limited` | "Too many failed attempts. Try again in about N minutes." |
| Chat, one topic too large | `413`, `detail` is an object with a `message` | `too_large` | The object's `message` |
| Chat, model unavailable | `503`, a fixed string | `unavailable` | "Service unavailable, try later." with a Retry button |

Rows are checked against [`src/api/errors.ts`](../src/api/errors.ts), the login, signup and chat
pages in [`src/pages/`](../src/pages/), and the backend's `app/router/member.py`,
`app/router/chat.py` and `app/auth/budget.py` on its main branch. A `Retry-After` that is missing or
not a positive number leaves `retryAfter` unset, and the pages then fall back to "Try again later."

## Testing details

The fixtures MSW returns are typed from the generated schema, so a fixture that no longer matches
the API fails the type check.

**An unhandled request fails the test.** MSW's `onUnhandledRequest: "error"` only logs and fails the
fetch, which the app can swallow and still pass. [`src/test/setup.ts`](../src/test/setup.ts)
therefore collects the `request:unhandled` events and throws in `afterEach`. Removing a test's own
listener with `server.events.removeAllListeners()` would be wrong: it also removes that collector,
and the suite stays green while no longer checking anything. A test that adds a listener removes
only its own, with `onTestFinished` and `removeListener`
([`src/pages/SignupPage.test.tsx`](../src/pages/SignupPage.test.tsx)).

**Vitest and CI.** With `CI=true`, vitest rejects a committed `.only` instead of silently skipping
the rest of the file. It exits 1 when it finds no tests, with or without `CI`.

**The late-401 tests wait a fixed 50 ms** after releasing the response, then assert that the session
survived ([`src/pages/ChatPage.test.tsx`](../src/pages/ChatPage.test.tsx)). Measured on one
development machine, the stale 401 took about 1.3 ms idle (maximum 1.6) and about 3.2 ms under heavy
CPU load (maximum 4.9), so the margin there is about 10x. It is unmeasured on a GitHub runner.
Waiting on MSW's `response:mocked` event was tried and rejected: it fires before the app's
middleware handles the response, and it caught the bug in only one of the two tests.

## CI and the AI review

Three files carry it: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) with the `checks` and
`schema-drift` jobs, and [`.github/workflows/agentic-review.yml`](../.github/workflows/agentic-review.yml).
`checks` installs from the lockfile with `npm ci`, then runs typecheck, lint, tests and the build, on
the Node version in `.nvmrc`. Branch protection on `main` requires `checks`, strict (the branch must
be up to date), enforced for admins, with a pull request required and 0 approvals.

The review workflow is the backend's, with two paragraphs of its prompts adapted: planning-unit
names in a diff are flagged, and the chat citation key `S1`/`[S1]` and ordinary `.slice()` calls are exempt.

It needs the `CLAUDE_CODE_OAUTH_TOKEN` repository secret, the
[Claude GitHub App](https://github.com/apps/claude) installed on the repository, and the labels
`Review ongoing`, `Audit ongoing` and `Review finished`. A run started by a `/agentic-review`
comment executes the default branch's copy of the workflow, so its check runs attach to main's tip
and not to the pull request; it reports through an `agentic-review` commit status on the PR head
instead.

`actionlint` reports two warnings about the `conclusion` output, inherited from the backend's
workflow. They are false positives: the review ran and was labelled "Review finished", which
requires those outputs to be `success`.

## Project layout

```
src/
  api/         client.ts (openapi-fetch + auth middleware), errors.ts, format.ts, schema.d.ts (generated),
               errors.test.ts, format.test.ts
  auth/        AuthContext.tsx (login, logout, route guard), MemberContext.tsx (/members/me),
               token.ts (sessionStorage), token.test.ts
  shell/       AppShell.tsx (top bar, nav, main), MemberMenu.tsx, AppShell.test.tsx
  pages/       LoginPage.tsx, SignupPage.tsx, ChatPage.tsx, ChatPage.test.tsx, SignupPage.test.tsx,
               LoginPage.test.tsx
  components/  AnswerView.tsx, Citations.tsx, FormError.tsx, brand/Logo.tsx,
               ui/ (generated shadcn components; only the D11 edits are made by hand)
  lib/         utils.ts (re-exports cn)
  theme/       ThemeProvider.tsx, ThemeProvider.test.tsx
  design/      contrast.ts, tokens.test.ts, ui-classes.test.ts (keep DESIGN.md true)
  test/        server.ts (MSW), setup.ts (unhandled-request guard, storage and theme reset)
  App.tsx, App.test.tsx, main.tsx, index.css
DESIGN.md      design guideline (colour, type, layout, components, accessibility)
components.json  shadcn configuration
public/        favicon.svg
scripts/       check-api.mjs
.githooks/     pre-commit
.github/workflows/  ci.yml, agentic-review.yml
```
