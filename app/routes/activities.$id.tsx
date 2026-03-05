import { lazy, Suspense, useRef, useState } from "react";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import type { ActivityMapHandle } from "~/components/ActivityMap";
import { db } from "~/lib/db.server";
import { requireAuth } from "~/lib/session.server";
import type { Route } from "./+types/activities.$id";

const ActivityMap = lazy(() => import("~/components/ActivityMap"));
const ElevationChart = lazy(() => import("~/components/ElevationChart"));

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);
  const activity = await db.activity.findUnique({ where: { id: params.id } });
  if (!activity) throw new Response("Not Found", { status: 404 });
  return { activity };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireAuth(request);
  const formData = await request.formData();

  const rating = formData.get("rating") ? Number(formData.get("rating")) : null;
  if (rating !== null && (rating < 1 || rating > 5)) {
    return { error: "Rating must be between 1 and 5" };
  }

  await db.activity.update({
    where: { id: params.id },
    data: {
      difficulty: (formData.get("difficulty") as string) || null,
      conditions: (formData.get("conditions") as string) || null,
      weather: (formData.get("weather") as string) || null,
      notes: (formData.get("notes") as string) || null,
      rating,
      companions: (formData.get("companions") as string) || null,
      gear: (formData.get("gear") as string) || null,
    },
  });

  return { success: true };
}

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatPace(meters: number, seconds: number) {
  const minPerKm = seconds / 60 / (meters / 1000);
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

const DIFFICULTY_OPTIONS = ["Easy", "Moderate", "Hard", "Very Hard"];
const CONDITIONS_OPTIONS = ["Excellent", "Good", "Muddy", "Wet", "Icy", "Overgrown"];
const WEATHER_OPTIONS = ["Sunny", "Cloudy", "Overcast", "Light Rain", "Heavy Rain", "Foggy", "Windy"];

export default function ActivityDetail() {
  const { activity } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [editing, setEditing] = useState(false);
  const mapRef = useRef<ActivityMapHandle>(null);

  const gps = activity.gpsData as any;
  const coords: [number, number][] = gps?.latlng?.data ?? [];
  const altitude: number[] = gps?.altitude?.data ?? [];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link to="/activities" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        ← Back to hikes
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{activity.name}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {new Date(activity.startDate).toLocaleDateString("en-GB", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        })}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Distance", value: formatDistance(activity.distance) },
          { label: "Moving Time", value: formatDuration(activity.movingTime) },
          { label: "Elevation Gain", value: `${activity.totalElevGain}m` },
          { label: "Pace", value: formatPace(activity.distance, activity.movingTime) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-lg font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Map */}
      {coords.length > 0 ? (
        <div className="mb-6">
          <Suspense fallback={<div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">Loading map...</div>}>
            <ActivityMap ref={mapRef} coords={coords} />
          </Suspense>
        </div>
      ) : (
        <div className="mb-6 h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
          No GPS data available
        </div>
      )}

      {/* Elevation Chart */}
      {altitude.length > 0 && (
        <div className="mb-6 bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Elevation Profile</p>
          <Suspense fallback={<div className="h-44 flex items-center justify-center text-gray-400 text-sm">Loading chart...</div>}>
            <ElevationChart altitude={altitude} totalDistanceKm={activity.distance / 1000} onHoverIndex={(i) => mapRef.current?.setHoverCoord(i != null ? coords[i] ?? null : null)} />
          </Suspense>
        </div>
      )}

      {/* Annotations */}
      <div className="bg-gray-50 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Trail Notes</h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-orange-500 hover:text-orange-600 font-medium"
            >
              {activity.notes || activity.difficulty || activity.rating ? "Edit" : "+ Add notes"}
            </button>
          )}
        </div>

        {editing ? (
          <Form method="post" onSubmit={() => setEditing(false)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Difficulty</label>
                <select name="difficulty" defaultValue={activity.difficulty ?? ""} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="">— Select —</option>
                  {DIFFICULTY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Trail Conditions</label>
                <select name="conditions" defaultValue={activity.conditions ?? ""} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="">— Select —</option>
                  {CONDITIONS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Weather</label>
                <select name="weather" defaultValue={activity.weather ?? ""} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="">— Select —</option>
                  {WEATHER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rating (1–5)</label>
                <input
                  type="number" name="rating" min="1" max="5"
                  defaultValue={activity.rating ?? ""}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Companions</label>
                <input type="text" name="companions" defaultValue={activity.companions ?? ""} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Gear</label>
                <input type="text" name="gear" defaultValue={activity.gear ?? ""} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea name="notes" defaultValue={activity.notes ?? ""} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>

            {actionData && "error" in actionData && (
              <p className="text-red-500 text-sm mb-3">{actionData.error}</p>
            )}

            <div className="flex gap-2">
              <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded transition-colors">
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2 rounded border border-gray-300 transition-colors">
                Cancel
              </button>
            </div>
          </Form>
        ) : (
          <div className="space-y-2 text-sm text-gray-600">
            {!activity.difficulty && !activity.rating && !activity.notes && !activity.conditions && (
              <p className="text-gray-400 italic">No notes added yet.</p>
            )}
            {activity.rating && (
              <p><span className="font-medium text-gray-700">Rating:</span> {"★".repeat(activity.rating)}{"☆".repeat(5 - activity.rating)}</p>
            )}
            {activity.difficulty && (
              <p><span className="font-medium text-gray-700">Difficulty:</span> {activity.difficulty}</p>
            )}
            {activity.conditions && (
              <p><span className="font-medium text-gray-700">Conditions:</span> {activity.conditions}</p>
            )}
            {activity.weather && (
              <p><span className="font-medium text-gray-700">Weather:</span> {activity.weather}</p>
            )}
            {activity.companions && (
              <p><span className="font-medium text-gray-700">With:</span> {activity.companions}</p>
            )}
            {activity.gear && (
              <p><span className="font-medium text-gray-700">Gear:</span> {activity.gear}</p>
            )}
            {activity.notes && (
              <p><span className="font-medium text-gray-700">Notes:</span> {activity.notes}</p>
            )}
            {actionData && "success" in actionData && (
              <p className="text-green-600 text-sm mt-2">Saved successfully.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
