# Crop CMS Frontend

[![CI](https://github.com/KyuHongCho/crop-cms-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/KyuHongCho/crop-cms-frontend/actions/workflows/ci.yml)

A React + TypeScript single-page app for the crop CMS backend: log in, sign up with an invite code,
ask crop questions and get cited answers.

## Why it exists

[crop-cms-backend](https://github.com/KyuHongCho/crop-cms-backend) returns a topic's documents
**complete** and answers crop questions with citations. This app is the first consumer of that API,
and it makes those guarantees visible to a user:

- **Citations** show the source, reference and link, whether the document was read first-hand or
  through another source, the crop label, the condition and licence note when there are any, and the
  full text on request.
- **"No answer" is a state, not an error.** A declined question and a question with no relevant
  topic both show it, with the reason.
- **A "cut off" banner** appears when the response's `truncated` flag is set, and only then.
- **Dropped topics are named**, so a reader sees what was left out to fit the size limit.
- **The daily token budget message** says when the budget resets.

The structured half of the planned chat, crop suitability from climate data, lives in
[crop-climate-advisor](https://github.com/KyuHongCho/crop-climate-advisor).

## Status

**Early and in progress.**

| Works today | Not built yet |
|---|---|
| Login and logout; the session is kept in `sessionStorage` for the tab, and an expired session returns to login with a notice | Admin screens (members, invites, unlock) |
| Invite-only signup, with browser checks that mirror the server's limits and an automatic login | Editing or deleting documents |
| `/chat` with every state above, plus `413` (topic too large), `503` (with a Retry button) and `422` | Deployment |
| The login page shows the lockout wait when the backend's throttle answers `429` (about 15 minutes for a fresh default lockout) | Conversation history (the backend answers single questions) |
| API types generated from the backend's OpenAPI, committed, with a drift check in CI | Browser end-to-end tests |
| CI (a required `checks` job) and an advisory AI review on pull requests | |
| A pre-commit hook (typecheck, then lint) | |

Remaining work: admin screens, document editing, deployment, conversation history, browser
end-to-end tests.

## Engineering highlights

- **Types come from the backend, and CI notices drift.** `src/api/schema.d.ts` is generated from the
  backend's OpenAPI and committed; a CI job regenerates it from the backend's main and reports a
  difference.
  [`src/api/schema.d.ts`](src/api/schema.d.ts) · [`scripts/check-api.mjs`](scripts/check-api.mjs) · [`.github/workflows/ci.yml`](.github/workflows/ci.yml) · [why](docs/design-notes.md#api-types-and-drift)
- **Every failure becomes one error shape.** The backend's `detail` is sometimes a string, sometimes
  a list and sometimes an object; one function turns each into the same `kind`, `status`,
  `message` and optional `retryAfter`.
  [`src/api/errors.ts`](src/api/errors.ts) · [`src/api/errors.test.ts`](src/api/errors.test.ts) · [why](docs/design-notes.md#error-shapes)
- **A 401 ends the session only if it answers the token still in use.** A late 401 for a token the
  user already replaced would otherwise log the new session out.
  [`src/api/client.ts`](src/api/client.ts) · [`src/pages/ChatPage.test.tsx`](src/pages/ChatPage.test.tsx) · [why](docs/design-notes.md#token-storage-and-sessions)
- **Model and document text is rendered as plain text.** There is no `dangerouslySetInnerHTML`, and
  a link is made only for `http(s)` addresses, with `rel="noopener noreferrer"`.
  [`src/components/AnswerView.tsx`](src/components/AnswerView.tsx) · [`src/components/Citations.tsx`](src/components/Citations.tsx) · [why](docs/design-notes.md#token-storage-and-sessions)
- **The question counter counts code points like the server, not UTF-16 units.** An emoji counts
  once, as it does on the server.
  [`src/pages/ChatPage.tsx`](src/pages/ChatPage.tsx) · [why](docs/design-notes.md#trade-offs-and-known-limits)
- **Tests fail on any unhandled network request.** A call with no mock fails the test that made it,
  even when the app swallows the error.
  [`src/test/setup.ts`](src/test/setup.ts) · [why](docs/design-notes.md#testing-details)
- **CI and the AI review mirror the backend's.** Same required check, same advisory review, with the
  review prompt adapted to this repo.
  [`.github/workflows/`](.github/workflows/) · [why](docs/design-notes.md#ci-and-the-ai-review)

Trade-offs, known limits and the full rationale: [`docs/design-notes.md`](docs/design-notes.md#trade-offs-and-known-limits).

## Quickstart

Requires Node 22.11 or newer (built and tested on 22.11.0; see [Dependency pins and Node](#dependency-pins-and-node)).

```bash
# 1. (backend checkout) Set up the backend by its Quickstart
#    (https://github.com/KyuHongCho/crop-cms-backend#quickstart). Its steps 1-3 are enough for
#    login and signup:
#      .env with the passwords and SECRET_KEY, then
docker compose up -d --build
docker compose exec cms alembic upgrade head
#    Chat answers also need the demo corpus (its step 4) and embeddings (its step 5, which needs
#    OPENAI_API_KEY; ANTHROPIC_API_KEY is needed too). Without the corpus chat answers
#    "no relevant topics".
docker compose exec cms python -m scripts.seed
docker compose exec cms python -m scripts.reindex
#    The API listens on 127.0.0.1:8000.

# 2. (frontend checkout) Install; this also enables the pre-commit hook
npm install

# 3. (backend checkout) Mint an invite (shown once); the seed creates no members
CODE=$(docker compose exec -T cms python -m scripts.make_invite)
echo "$CODE"

# 4. (any directory) Optional: sign up with curl instead of the signup page, using the same $CODE.
#    Choose your own password (8-128 characters); do not reuse a real one.
curl -X POST localhost:8000/members/signup -H 'content-type: application/json' \
  -d "{\"email\":\"you@example.com\",\"password\":\"<your-chosen-password>\",\"invite_code\":\"$CODE\"}"

# 5. (frontend checkout) Start the dev server last: it keeps running. Open
#    http://localhost:5173/signup and paste the code (or /login if you signed up with curl).
#    Choose your own password (8-128 characters); do not reuse a real one.
#    The browser calls /api/*; the Vite dev proxy strips /api and forwards it to VITE_API_TARGET
#    (default http://127.0.0.1:8000). The proxy is dev-only.
#    Only if the backend is elsewhere: cp .env.example .env and edit VITE_API_TARGET. Vite reads
#    .env, not .env.example; restart npm run dev after changing it.
npm run dev
```

Then log in with the email and password you chose. The by-hand checks are in
[`docs/manual-checks.md`](docs/manual-checks.md).

## Testing

```bash
npm test             # Vitest + React Testing Library + MSW
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run build        # typecheck, then the production build
```

The tests run fully offline: MSW mocks the API with responses typed from the generated schema, so
they need no backend and no API key. A request with no mock fails the test that made it
([why](docs/design-notes.md#testing-details)).

`npm run check:api` regenerates the types and fails if they differ from the committed file. It needs
the backend running, or `OPENAPI_SRC` pointing at another URL or a local OpenAPI file.

`.githooks/pre-commit` runs `npm run typecheck` then `npm run lint` on every commit. `npm install`
enables it (the `prepare` script sets `core.hooksPath`; run `npm run prepare` to do it by hand).
`git commit --no-verify` skips it. Tests are not part of it: run `npm test` yourself.

What the offline tests cannot show, such as the real backend's answers, is checked by hand:
[`docs/manual-checks.md`](docs/manual-checks.md).

## Scripts

| Script | Does |
|---|---|
| `dev` / `build` | Vite dev server / typecheck + production build |
| `test` | Vitest + RTL + MSW, fully offline |
| `typecheck`, `lint` | `tsc --noEmit`, ESLint |
| `gen:api` | Regenerate `src/api/schema.d.ts` (committed) |
| `check:api` | Regenerate to a temp file and fail if it differs from the committed one |

`gen:api` and `check:api` read the live backend `http://127.0.0.1:8000/openapi.json` by default. Set
`OPENAPI_SRC` to another URL or a local OpenAPI file path to use that instead. Neither is part of
`npm test`.

Generated types cover only the declared 200/201/204 success responses and 422; `src/api/errors.ts` hand-maps the
other statuses (400/401/413/429/503).

## Dependency pins and Node

- `typescript` is pinned `~5.9.3`: `openapi-typescript@7.13.0` peers `typescript ^5.x` and
  `typescript-eslint@8.71.1` peers `typescript >=4.8.4 <6.1.0`, so TypeScript 6.1+ is not allowed yet.
- `jsdom` is pinned `^26.1.0` (engines `node >=18`): `jsdom@27.1.0` needs Node
  `^20.19.0 || ^22.12.0 || >=24.0.0`, and this project was built on Node 22.11.0, which is below 22.12.
  Moving to Node 22.12+ lifts that constraint.
- There is no `engines` field in `package.json`: the Node floor above is what was tested, not
  something every dependency enforces.

## CI

The `checks` job (install from the lockfile, typecheck, lint, tests, build) runs on pull requests to
main and on pushes to main. It is the required check on `main`: branch protection is strict, applies
to admins, and requires a pull request. It uses the Node version in `.nvmrc`, so CI tests that
version and no newer one.

`schema-drift` regenerates the API types from the backend's main and fails when the committed
`src/api/schema.d.ts` disagrees. It is advisory; fix it with `npm run gen:api` against the backend
and commit the result.

An advisory AI review runs on pull requests and on a `/agentic-review` comment from the owner, a
member or a collaborator. It needs two things:

- the `CLAUDE_CODE_OAUTH_TOKEN` repository secret: without it the review stands down quietly;
- the [Claude GitHub App](https://github.com/apps/claude) installed on the repository: without it
  the review job fails with "Claude Code is not installed on this repository".

The labels `Review ongoing`, `Audit ongoing` and `Review finished` show its progress. Details:
[`docs/design-notes.md`](docs/design-notes.md#ci-and-the-ai-review).

## Related repositories

- [crop-cms-backend](https://github.com/KyuHongCho/crop-cms-backend) — the API this app talks to:
  the document store, members, and `POST /chat`.
- [crop-climate-advisor](https://github.com/KyuHongCho/crop-climate-advisor) — crop suitability from
  NASA POWER climate data and FAO ECOCROP requirements; the structured half of the planned chat.
- [agentic-workflow](https://github.com/KyuHongCho/agentic-workflow) — the plan → build → review
  workflow with adversarial auditors, used to build this repo; its review stage runs when a pull
  request is opened here.

## Licence

Source code: MIT — see [LICENSE](LICENSE). Crop data is not covered: it comes from the backend, and
each document carries its own licence note, which the app shows under the citation.

Personal portfolio repository — issues are welcome; external pull requests are not accepted.
