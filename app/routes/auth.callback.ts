import { redirect } from "react-router";
import { commitSession, getSession } from "~/lib/session.server";
import { db } from "~/lib/db.server";
import type { Route } from "./+types/auth.callback";

// Handles Strava OAuth callback — exchanges code for tokens and persists to DB
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

  // Persist tokens to DB — survives logout/login cycles
  await db.settings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      stravaAccessToken: data.access_token,
      stravaRefreshToken: data.refresh_token,
      stravaExpiresAt: data.expires_at,
    },
    update: {
      stravaAccessToken: data.access_token,
      stravaRefreshToken: data.refresh_token,
      stravaExpiresAt: data.expires_at,
    },
  });

  // Preserve existing session (isOwner stays intact if already logged in)
  const session = await getSession(request);
  return redirect("/activities", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}
