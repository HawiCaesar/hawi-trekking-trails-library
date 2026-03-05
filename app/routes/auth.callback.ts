import { redirect } from "react-router";
import { commitSession, getSession } from "~/lib/session.server";
import type { Route } from "./+types/auth.callback";

// Handles Strava OAuth callback — exchanges code for tokens and stores in session
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    throw redirect("/login?error=strava_denied");
  }

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    console.error("Token exchange failed:", await res.text());
    throw redirect("/login?error=token_exchange_failed");
  }

  const data = await res.json();

  const session = await getSession(request);
  session.set("accessToken", data.access_token);
  session.set("refreshToken", data.refresh_token);
  session.set("expiresAt", data.expires_at);
  session.set("athleteId", data.athlete?.id);

  return redirect("/activities", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}
