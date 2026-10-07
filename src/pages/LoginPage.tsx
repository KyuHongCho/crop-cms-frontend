import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import type { ApiError } from "../api/errors";
import { isApiError } from "../api/errors";
import { useAuth } from "../auth/AuthContext";

function loginMessage(e: unknown): string {
  if (!isApiError(e)) return "Could not reach the server. Try again.";
  const err: ApiError = e;
  switch (err.kind) {
    case "unauthenticated":
      return "Incorrect email or password";
    case "validation":
      return err.message;
    case "unavailable":
      return "Service unavailable, try again later.";
    default:
      return err.message;
  }
}

export default function LoginPage() {
  const { token, sessionExpired, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/chat" replace />;

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(loginMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Log in</h1>
      {sessionExpired && <p role="status">Your session expired. Please log in again.</p>}
      <form onSubmit={onSubmit}>
        <label>
          Email
          <input type="text" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy}>Log in</button>
      </form>
      <p>
        Have an invite? <Link to="/signup">Sign up</Link>
      </p>
    </main>
  );
}
