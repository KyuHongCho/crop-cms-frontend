# crop-cms-frontend

React + TypeScript SPA for the crop CMS backend. Slice S1: log in and see who you are.

## Run

1. Start the backend (`docker compose up -d --wait` in `crop-cms-backend`); API on `127.0.0.1:8000`.
2. `npm install`, then `npm run dev` (http://localhost:5173).

The browser calls `/api/*`; the Vite dev proxy strips `/api` and forwards to `VITE_API_TARGET`
(default `http://127.0.0.1:8000`, see `.env.example`). The proxy is dev-only.

## Get an account

S1 has no signup UI (that is S2), and the backend seed creates no members. Create one by hand, in the
backend repo, with an invite code (shown once). Pick your own password (8-128 characters); do not
reuse a real one.

```
CODE=$(docker compose exec -T cms python -m scripts.make_invite)
curl -X POST localhost:8000/members/signup -H 'content-type: application/json' \
  -d "{\"email\":\"you@example.com\",\"password\":\"<your-chosen-password>\",\"invite_code\":\"$CODE\"}"
```

Then log in on the frontend with that email and password.

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
