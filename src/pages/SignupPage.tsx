import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { client } from "../api/client";
import { isApiError, normaliseError } from "../api/errors";
import { useAuth } from "../auth/AuthContext";

// Mirrors MemberCreate in the backend; the server stays the authority (422 is still shown).
// The email rule is exactly the server's, no stricter. Lengths count code points like pydantic.
// eslint-disable-next-line no-control-regex -- the server pattern refuses NUL, so this one must too
const EMAIL_PATTERN = /^[^@\s\x00]+@[^@\s\x00]+$/;
const len = (s: string): number => [...s].length;

type Fields = { email: string; password: string; displayName: string; inviteCode: string };

function validate(f: Fields): string | null {
  if (len(f.email) < 3 || len(f.email) > 255 || !EMAIL_PATTERN.test(f.email)) return "Enter an email like name@example.com.";
  if (len(f.password) < 8 || len(f.password) > 128) return "Password must be 8 to 128 characters.";
  if (len(f.displayName) > 64) return "Display name must be at most 64 characters.";
  if (f.displayName.includes("\x00")) return "Display name must not contain NUL.";
  if (len(f.inviteCode) < 20) return "Invite code must be at least 20 characters.";
  return null;
}

export default function SignupPage() {
  const { token, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/chat" replace />;

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const fields = { email: email.trim(), password, displayName: displayName.trim(), inviteCode: inviteCode.trim() };
    const invalid = validate(fields);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    setAccountCreated(false);
    try {
      const { error: apiError, response } = await client.POST("/members/signup", {
        body: {
          email: fields.email,
          password,
          invite_code: fields.inviteCode,
          ...(fields.displayName ? { display_name: fields.displayName } : {}),
        },
      });
      if (!response.ok) {
        const err = normaliseError(response.status, apiError, response.headers);
        setError(err.kind === "unavailable" ? "Service unavailable, try again later." : err.message);
        return;
      }
      setAccountCreated(true);
      try {
        await login(fields.email, password);
      } catch (e) {
        setError(isApiError(e) ? e.message : "Could not reach the server.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Sign up</h1>
      <form onSubmit={onSubmit} noValidate>
        <label>
          Email
          <input type="text" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label>
          Display name (optional)
          <input type="text" autoComplete="nickname" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label>
          Invite code
          <input type="text" autoComplete="off" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
        </label>
        {error && <p role="alert">{error}</p>}
        {accountCreated && error && (
          <p role="status">
            Your account was created, but signing you in failed. <Link to="/login">Go to log in</Link>.
          </p>
        )}
        <button type="submit" disabled={busy}>Sign up</button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </main>
  );
}
