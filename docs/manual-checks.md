# Manual checks

The offline tests run against mocks. These are the checks to do by hand against a running backend
(see the [Quickstart](../README.md#quickstart)), for what mocks cannot show: the real server's
answers, the browser's own behaviour, and the Network tab.

The backend must be set up first, by [its Quickstart](https://github.com/KyuHongCho/crop-cms-backend#quickstart):
schema migrated for login and signup, and the demo corpus seeded and embedded for chat.

## Look and feel

- [ ] `/login` and `/signup` at 375px and 1280px wide, in light and dark: a centred card on the sage
      background, nothing clipped.
- [ ] The keyboard focus ring is visible on every field and button, in both themes.
- [ ] Set the OS to dark, then reload: no flash of the light page before the dark one.
- [ ] Korean text (a display name or an error) wraps between words, not mid-word.
- [ ] A login error shows an icon and the text, not colour alone.
- [ ] Ask page: a multi-line answer keeps its line breaks; the counter turns red past
      2000 characters; Ask, Retry and Show text look like buttons.
- [ ] The top bar at 375px and 1280px wide: one row, 56px tall; below 640px only the sprout shows (no
      wordmark) and nothing overflows.
- [ ] Member menu by keyboard only: Tab to the account button, Enter opens it, arrow keys move between
      Light / Dark / System / Log out, Enter selects, Escape closes and returns focus to the button.
- [ ] Choose Dark in the menu, reload: it stays dark with no flash. Choose System and change the OS
      setting: the page follows without a reload.
- [ ] The current page (Ask or Library) is underlined in the nav; the logo and wordmark go to `/chat`.

## Library

Read-only; it calls `GET /crops`, `/items` and `/retrieval/...` and writes nothing.

- [ ] Nav "Library" opens `/library`: all 7 crops, each with its scientific name in italics.
- [ ] Open basil: its topics are listed with counts, and the draft item (13, "DRAFT -- basil
      propagation...") is absent. Basil `propagation` shows 1 document, not 2, and the topic page agrees.
- [ ] Open `basil/watering-needs`: "3 documents" and three source cards without a `[S1]` key; "Show
      text" expands the body as plain text; the Network tab shows `/api/retrieval/basil/watering-needs`.
- [ ] A document whose url is not http(s) is shown as text, not a link.
- [ ] `/library/nope` shows "No crop named "nope"." with an alert icon and a link back.
- [ ] A topic over the size limit (hard to arrange on the demo corpus) shows the server's message.
- [ ] Logged out, `/library` goes to login.
- [ ] Layout at 375px and 1280px in light and dark: one column, nothing clipped, skeletons visible
      while loading (throttle the network to see them).

## Login

- [ ] You have an account (mint an invite and sign up, as in the Quickstart).
- [ ] `/chat` while logged out redirects to `/login`.
- [ ] A wrong password (or unknown email) shows "Incorrect email or password".
- [ ] A valid login lands on `/chat`, showing your name or email in the account button and, under the
      title, "Signed in as … · Tokens used today: N / M". The menu shows "Signed in as <email>".
- [ ] Reload keeps you signed in. This holds only in the same tab: the token is in `sessionStorage`,
      so a new tab or a restarted browser asks you to log in again.
- [ ] Log out (in the account menu at the top right) returns to `/login`.
- [ ] After the token expires (30 min) or is removed server-side, the next call returns you to
      `/login` with "Your session expired".
- [ ] Lockout: once the backend's default limit of 10 failed login attempts (`LOGIN_MAX_FAILURES`) is
      reached inside its 900-second window (`LOGIN_WINDOW_SECONDS`), the next attempt shows "Too many
      failed attempts. Try again in about 15 minutes." **This locks that account** until the window
      ends or an admin calls the backend's `POST /members/{id}/unlock`. Use a throwaway account,
      never the only admin.

## Signup

- [ ] Mint an invite (see the Quickstart). `/login` links to `/signup` and back.
- [ ] Sign up with email, password, optional display name and the invite code: you land on `/chat`
      already signed in.
- [ ] Reusing the same code shows "Invalid or expired invite"; a new invite with an existing email
      shows "Email already registered". (The message is the server's `detail`, shown as given.)
- [ ] A 7-character password, a 19-character invite code or a 65-character display name is refused
      in the browser before any request is sent (check the Network tab).
- [ ] Leaving display name empty works (the field is omitted from the request).
- [ ] While logged in, `/signup` redirects to `/chat`.

## Chat

A real demo needs the backend's demo corpus seeded and embedded (steps 4 and 5 of its Quickstart;
an unseeded backend answers "no relevant topics"), `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` in the
backend `.env` (then restart the backend), and **spends real provider tokens**. The automated tests
need none of that: they use MSW.

- [ ] Log in. In-scope crop question (for example "How often should I water basil?"): a cited
      answer appears, with citations showing title, source, reference and a link (only for
      http/https urls). "Show text" expands the document body as plain text.
- [ ] The answer card and the Sources panel: the panel sits to the right (about 360px) from 1024px
      and stacks below the answer under it. Check 375, 768 and 1280px in light and dark.
- [ ] Citation markers: `[S1]` shows the key in ochre with an underline; Tab to the key, press
      Enter, and focus lands on the matching source card (a visible ring). `[S1, S2]` gives two
      links. A key that was not sent, such as `[S9]`, is plain text.
- [ ] Over 2000 characters, the counter turns red and shows an alert icon beside the text.
- [ ] Cut off, left-out topics and "No answer" each show an icon and text in a chip; the 429
      budget message shows an hourglass in an amber block.
- [ ] The answer is announced as a polite live region labelled "Answer". This is confirmed in the
      DOM by a test; screen-reader output has not been checked.
- [ ] After the answer, "Tokens used today" has gone up (it is refetched from `/members/me`).
- [ ] Off-topic question (for example "Who won the 2018 World Cup?"): a "No answer" state with the
      reason line, not an error.
- [ ] The counter counts trimmed characters; a whitespace-only question or one over 2000 characters
      cannot be sent (check the Network tab: no request).
- [ ] Citations with a condition or licence note show them as "Condition: ..." / "Licence: ..."
      (plain text; nothing is shown when the document has none).
- [ ] While waiting, "Ask" is disabled and a second click sends no second request.
- [ ] 429: set your budget to 0 from the backend repo, then ask a question (the check runs before
      any model call, so this spends nothing):
      `docker compose exec db psql -U postgres -d cms -c "UPDATE members SET tokens_budget_daily = 0 WHERE email = 'you@example.com'"`.
      You see "Daily budget used up. It resets in about N hours." Asking again still sends a
      request (the server decides), and gets the same answer until the reset. Restore the budget
      afterwards (the default is 20000); the next successful answer clears the message.
- [ ] 503 (for example a provider key missing or rejected): "Service unavailable, try later." with
      a Retry button.
- [ ] A truncated answer shows "cut off and may be incomplete". It depends on the model's output
      length, so it is hard to trigger by hand; the tests cover it.
