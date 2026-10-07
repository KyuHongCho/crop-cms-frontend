# crop-cms-frontend

React + TypeScript SPA for the crop CMS backend. Slices so far: S1 (log in, see who you are), S2 (sign up with an invite code) and S3 (ask a question on `/chat`).

## Run

1. Start the backend (`docker compose up -d --wait` in `crop-cms-backend`); API on `127.0.0.1:8000`.
2. `npm install`, then `npm run dev` (http://localhost:5173).

The browser calls `/api/*`; the Vite dev proxy strips `/api` and forwards to `VITE_API_TARGET`
(default `http://127.0.0.1:8000`). The proxy is dev-only.

Vite reads `.env`, not `.env.example`. Only if the backend is not at the default address, copy
`.env.example` to `.env` and edit `VITE_API_TARGET`; restart `npm run dev` after any change to it.

Node: built and tested on 22.11.0; use Node 22.11 or newer (see "Dependency pins and Node").

## Get an account

The UI has a signup page at `/signup` (linked from `/login`), but signup needs an invite code and the
backend seed creates no members, so mint the invite from the backend repo (shown once):

```
docker compose exec -T cms python -m scripts.make_invite
```

Paste the code into the signup form. Pick your own password (8-128 characters); do not reuse a real
one. Without the UI, the same invite works with curl:

```
CODE=$(docker compose exec -T cms python -m scripts.make_invite)
curl -X POST localhost:8000/members/signup -H 'content-type: application/json' \
  -d "{\"email\":\"you@example.com\",\"password\":\"<your-chosen-password>\",\"invite_code\":\"$CODE\"}"
```

Then log in with that email and password.

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
`npm test`, so tests need no backend.

Generated types cover only the declared 200/422 responses; `src/api/errors.ts` hand-maps the
other statuses (400/401/413/429/503).

## Dependency pins and Node

- `typescript` is pinned `~5.9.3`: `openapi-typescript@7.13.0` peers `typescript ^5.x` and
  `typescript-eslint@8.71.1` peers `typescript >=4.8.4 <6.1.0`, so TypeScript 6.1+ is not allowed yet.
- `jsdom` is pinned `^26.1.0` (engines `node >=18`): `jsdom@27.1.0` needs Node
  `^20.19.0 || ^22.12.0 || >=24.0.0`, and this project was built on Node 22.11.0, which is below 22.12.
  Moving to Node 22.12+ lifts that constraint.
- There is no `engines` field in `package.json`: the Node floor above is what was tested, not
  something every dependency enforces.

## Pre-commit check

`.githooks/pre-commit` runs `npm run typecheck` then `npm run lint` on every commit. `npm install`
enables it (the `prepare` script sets `core.hooksPath`; run `npm run prepare` to do it by hand).
`git commit --no-verify` skips it. Tests are not part of it: run `npm test` yourself.

## S1 manual demo checklist

- [ ] You have an account (see "Get an account").
- [ ] `/chat` while logged out redirects to `/login`.
- [ ] A wrong password (or unknown email) shows "Incorrect email or password".
- [ ] A valid login lands on `/chat`, showing your name or email and "Tokens used today: N / M".
- [ ] Reload keeps you signed in. This holds only in the same tab: the token is in `sessionStorage`, so a new tab or a restarted browser asks you to log in again.
- [ ] Log out returns to `/login`.
- [ ] After the token expires (30 min) or is removed server-side, the next call returns you to
      `/login` with "Your session expired".

## S2 manual demo checklist

- [ ] Mint an invite (see "Get an account"). `/login` links to `/signup` and back.
- [ ] Sign up with email, password, optional display name and the invite code: you land on `/chat`
      already signed in.
- [ ] Reusing the same code shows "Invalid or expired invite"; a new invite with an existing email
      shows "Email already registered". (The message is the server's `detail`, shown as given.)
- [ ] A 7-character password, a 19-character invite code or a 65-character display name is refused in
      the browser before any request is sent (check the Network tab).
- [ ] Leaving display name empty works (the field is omitted from the request).
- [ ] While logged in, `/signup` redirects to `/chat`.

## S3 manual demo checklist

A real demo needs `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` in the backend `.env` (then restart the
backend) and **spends real provider tokens**. The automated tests need neither: they use MSW.

- [ ] Log in. In-scope crop question (for example "How often should I water basil?"): a cited answer
      appears, with citations showing title, source, reference and a link (only for http/https
      urls). "Show text" expands the document body as plain text.
- [ ] After the answer, "Tokens used today" has gone up (it is refetched from `/members/me`).
- [ ] Off-topic question (for example "Who won the 2018 World Cup?"): a "No answer" state with the
      reason line, not an error.
- [ ] The counter counts trimmed characters; a whitespace-only question or one over 2000 characters
      cannot be sent (check the Network tab: no request).
- [ ] Citations with a condition or licence note show them as "Condition: ..." / "Licence: ..."
      (plain text; nothing is shown when the document has none).
- [ ] While waiting, "Ask" is disabled and a second click sends no second request.
- [ ] 429: set your budget to 0 from the backend repo, then ask a question (the check runs before any
      model call, so this spends nothing):
      `docker compose exec db psql -U postgres -d cms -c "UPDATE members SET tokens_budget_daily = 0 WHERE email = 'you@example.com'"`.
      You see "Daily budget used up. It resets in about N hours." Asking again still sends a request
      (the server decides), and gets the same answer until the reset. Restore the budget afterwards
      (the column default is 20000); the next successful answer clears the message.
- [ ] 503 (for example a provider key missing or rejected): "Service unavailable, try later." with a
      Retry button.
- [ ] A truncated answer shows "cut off and may be incomplete". It depends on the model's output
      length, so it is hard to trigger by hand; the tests cover it.
