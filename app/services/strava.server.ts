import { db } from "~/lib/db.server";

const BASE = "https://www.strava.com/api/v3";

export async function getValidStravaToken(): Promise<string> {
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (!settings?.stravaAccessToken || !settings.stravaRefreshToken) {
    throw new Error("No Strava token stored — connect Strava first");
  }

  const now = Math.floor(Date.now() / 1000);
  if (settings.stravaExpiresAt && settings.stravaExpiresAt > now + 300) {
    return settings.stravaAccessToken;
  }

  // Token expired — refresh it
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: settings.stravaRefreshToken,
    }),
  });
  const data = await res.json();

  await db.settings.update({
    where: { id: 1 },
    data: {
      stravaAccessToken: data.access_token,
      stravaRefreshToken: data.refresh_token,
      stravaExpiresAt: data.expires_at,
    },
  });

  return data.access_token;
}

export async function getAthleteActivities(token: string, page = 1) {
  const res = await fetch(
    `${BASE}/athlete/activities?per_page=30&page=${page}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Strava API error: ${res.status}`);
  return res.json();
}

export async function getActivityById(token: string, id: string) {
  const res = await fetch(`${BASE}/activities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Strava API error: ${res.status}`);
  return res.json();
}

export async function getActivityStreams(token: string, id: string) {
  const res = await fetch(
    `${BASE}/activities/${id}/streams?keys=latlng,altitude&key_by_type=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Strava API error: ${res.status}`);
  return res.json();
}
