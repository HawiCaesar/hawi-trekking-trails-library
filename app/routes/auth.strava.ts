import type { Route } from "./+types/auth.strava";

// Redirects user to Strava's OAuth authorization page
export async function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;

  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: `${origin}/auth/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
  });

  return Response.redirect(
    `https://www.strava.com/oauth/authorize?${params}`
  );
}
