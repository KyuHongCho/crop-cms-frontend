import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import type { ApiError } from "../api/errors";
import { isApiError } from "../api/errors";
import { formatReset } from "../api/format";
import { Info } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import Logo from "@/components/brand/Logo";
import FormError from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function loginMessage(e: unknown): string {
  if (!isApiError(e)) return "Could not reach the server. Try again.";
  const err: ApiError = e;
  switch (err.kind) {
    case "unauthenticated":
      return "Incorrect email or password";
    case "validation":
      return err.message;
    case "rate_limited":
      // login's Retry-After is the lockout time left, not chat's daily rollover.
      return err.retryAfter
        ? `Too many failed attempts. Try again in ${formatReset(err.retryAfter)}.`
        : "Too many failed attempts. Try again later.";
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
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-8">
      <Logo className="text-xl text-primary" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl leading-tight font-semibold">Log in</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {sessionExpired && (
            <p role="status" className="flex items-start gap-2 rounded-lg bg-notice px-3 py-2 text-sm text-notice-foreground">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Your session expired. Please log in again.
            </p>
          )}
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="text" autoComplete="username" className="text-base!" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input id="login-password" type="password" autoComplete="current-password" className="text-base!" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <FormError>{error}</FormError>}
            <Button type="submit" size="lg" disabled={busy}>Log in</Button>
          </form>
        </CardContent>
        <CardFooter className="text-sm">
          <p>
            Have an invite? <Link to="/signup" className="text-primary underline underline-offset-4">Sign up</Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
