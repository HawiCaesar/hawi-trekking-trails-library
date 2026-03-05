const BASE = "https://www.strava.com/api/v3";

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
