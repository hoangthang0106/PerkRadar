import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { accessToken, authorized } from "@/lib/auth";
import "@/components/deal-board.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ERRORS: Record<string, string> = {
  invalid: "Invalid access token. Please try again.",
  rate: "Too many attempts. Please try again in one minute.",
  request: "Request rejected. Please submit again from this page.",
  config: "Access authentication is misconfigured on the server. Check your deployment settings.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  let token: string | null = null;
  let misconfigured = false;
  try {
    token = accessToken();
  } catch {
    misconfigured = true;
  }
  // Nothing to sign in to, or already signed in: the board is the right place.
  if (!misconfigured && (token === null || authorized(new Headers(await headers()), token))) redirect("/");

  const raw = (await searchParams).error;
  const code = Array.isArray(raw) ? raw[0] : raw;
  const message = misconfigured ? ERRORS.config : code ? (ERRORS[code] ?? ERRORS.request) : null;

  return (
    <div className="perk-board" data-testid="login-root">
      <main className="board-login">
        <p className="demo-brand"><Radar aria-hidden="true" />PerkRadar</p>
        <h1>Sign in</h1>
        <p className="board-login-hint">Enter the access token configured for this deployment. Your session will last for up to 8 hours.</p>
        {message ? <p className="board-alert" role="alert" data-testid="login-error">{message}</p> : null}
        <form action="/api/session" method="post" className="board-login-form">
          <label htmlFor="token">Access token</label>
          <Input id="token" name="token" type="password" required maxLength={1024} autoComplete="current-password" autoFocus data-testid="login-token" />
          <Button type="submit" data-testid="login-submit">Sign in</Button>
        </form>
        <p className="board-footer-note">Enter your token only here. Do not include it in URLs or chat messages.</p>
      </main>
    </div>
  );
}
