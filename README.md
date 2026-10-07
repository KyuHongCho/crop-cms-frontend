# crop-cms-frontend

React + TypeScript SPA for the crop CMS backend. Slices so far: S1 (log in, see who you are) and S2 (sign up with an invite code).

## Run

1. Start the backend (`docker compose up -d --wait` in `crop-cms-backend`); API on `127.0.0.1:8000`.
2. `npm install`, then `npm run dev` (http://localhost:5173).

The browser calls `/api/*`; the Vite dev proxy strips `/api` and forwards to `VITE_API_TARGET`
(default `http://127.0.0.1:8000`, see `.env.example`). The proxy is dev-only.

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
