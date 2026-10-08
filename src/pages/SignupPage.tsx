import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { client } from "../api/client";
import { isApiError, normaliseError } from "../api/errors";
import { Info } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import Logo from "@/components/brand/Logo";
import FormError from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-8">
      <Logo className="text-xl text-primary" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl leading-tight font-semibold">Sign up</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="signup-email">Email</Label>
              <Input id="signup-email" type="text" autoComplete="username" className="text-base!" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="signup-password">Password</Label>
              <Input id="signup-password" type="password" autoComplete="new-password" className="text-base!" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="signup-display-name">Display name (optional)</Label>
              <Input id="signup-display-name" type="text" autoComplete="nickname" className="text-base!" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="signup-invite-code">Invite code</Label>
              <Input id="signup-invite-code" type="text" autoComplete="off" className="text-base!" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
            </div>
            {error && <FormError>{error}</FormError>}
            {accountCreated && error && (
              <p role="status" className="flex items-start gap-2 rounded-lg bg-notice px-3 py-2 text-sm text-notice-foreground">
                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  Your account was created, but signing you in failed. <Link to="/login" className="underline underline-offset-4">Go to log in</Link>.
                </span>
              </p>
            )}
            <Button type="submit" size="lg" disabled={busy}>Sign up</Button>
          </form>
        </CardContent>
        <CardFooter className="text-sm">
          <p>
            Already have an account? <Link to="/login" className="text-primary underline underline-offset-4">Log in</Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
