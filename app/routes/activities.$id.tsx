import { lazy, Suspense, useRef, useState } from "react";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import type { ActivityMapHandle } from "~/components/ActivityMap.types";
import ClientOnly from "~/components/ClientOnly";
import { db } from "~/lib/db.server";
import { getIsOwner, requireOwner } from "~/lib/session.server";
import type { Route } from "./+types/activities.$id";

const ActivityMap = lazy(() => import("~/components/ActivityMap"));
const ActivityFlyoverMap = lazy(() => import("~/components/ActivityFlyoverMap"));
const ElevationChart = lazy(() => import("~/components/ElevationChart"));

export async function loader({ request, params }: Route.LoaderArgs) {
  const isOwner = await getIsOwner(request);
  const activity = await db.activity.findUnique({ where: { id: params.id } });
  if (!activity) throw new Response("Not Found", { status: 404 });
  return { activity, isOwner };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireOwner(request);
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[#5c554d] dark:text-[#b8ae9f] text-xs uppercase tracking-wider">{label}</span>
      <span className="text-[#1a1816] dark:text-[#f5f1eb] font-semibold">{value}</span>
    </span>
  );
}

function EmptyNotes() {
  return <p className="text-sm text-[#5c554d] dark:text-[#b8ae9f] italic">No notes added yet.</p>;
}

export default function ActivityDetail() {
  const { activity, isOwner } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [editing, setEditing] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [mapView, setMapView] = useState<"2d" | "3d">("2d");
  const mapRef = useRef<ActivityMapHandle>(null);

  const gps = activity.gpsData as any;
  const coords: [number, number][] = gps?.latlng?.data ?? [];
  const altitude: number[] = gps?.altitude?.data ?? [];

  const hasNotes = activity.difficulty || activity.rating || activity.notes || activity.conditions || activity.weather || activity.companions || activity.gear;

  return (
    <div className="min-h-screen bg-[#f5f1eb] dark:bg-[#1c1916]">
      <header className="max-w-6xl mx-auto px-6 py-4">
        <Link
          to="/activities"
          className="text-sm text-[#5c554d] hover:text-[#1a1816] dark:text-[#b8ae9f] dark:hover:text-[#f5f1eb] transition-colors"
        >
          ← Back to all hikes
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-8 md:pt-12 pb-16 md:pb-24">
        <div className="mb-10 md:mb-14">
          <h1 className="font-[Oswald] text-4xl md:text-6xl font-bold text-[#1a1816] dark:text-[#f5f1eb] leading-[0.95] tracking-tight">
            {activity.name}
          </h1>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span className="text-[#5c554d] dark:text-[#b8ae9f]">
              {new Date(activity.startDate).toLocaleDateString("en-GB", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span className="hidden sm:inline text-[#ddd5c9] dark:text-[#4a443e]">|</span>
            <Stat label="Distance" value={formatDistance(activity.distance)} />
            <Stat label="Time" value={formatDuration(activity.movingTime)} />
            <Stat label="Elevation" value={`${activity.totalElevGain}m`} />
            <Stat label="Pace" value={formatPace(activity.distance, activity.movingTime)} />
          </div>
        </div>

        {coords.length > 0 ? (
          <figure className="mb-12 md:mb-16">
            <div className="border border-[#ddd5c9] dark:border-[#4a443e] bg-white dark:bg-[#2a2622] p-1">
              <div className="flex mb-1" role="tablist" aria-label="Map view">
                <button
                  type="button"
                  role="tab"
                  id="two-dimensional-map-tab"
                  aria-selected={mapView === "2d"}
                  aria-controls="two-dimensional-map-panel"
                  onClick={() => setMapView("2d")}
                  className={`px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
                    mapView === "2d"
                      ? "bg-[#f0ebe3] dark:bg-[#3d3832] text-[#1a1816] dark:text-[#f5f1eb]"
                      : "text-[#5c554d] dark:text-[#b8ae9f] hover:text-[#1a1816] dark:hover:text-[#f5f1eb]"
                  }`}
                >
                  2D Route
                </button>
                <button
                  type="button"
                  role="tab"
                  id="three-dimensional-map-tab"
                  aria-selected={mapView === "3d"}
                  aria-controls="three-dimensional-map-panel"
                  onClick={() => setMapView("3d")}
                  className={`px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
                    mapView === "3d"
                      ? "bg-[#f0ebe3] dark:bg-[#3d3832] text-[#1a1816] dark:text-[#f5f1eb]"
                      : "text-[#5c554d] dark:text-[#b8ae9f] hover:text-[#1a1816] dark:hover:text-[#f5f1eb]"
                  }`}
                >
                  3D Flyover
                </button>
              </div>

              {mapView === "2d" ? (
                <div id="two-dimensional-map-panel" role="tabpanel" aria-labelledby="two-dimensional-map-tab">
                  <ClientOnly
                    fallback={
                      <div className="flex h-[480px] md:h-[580px] items-center justify-center bg-[#f0ebe3] dark:bg-[#2a2622] text-[#8c8379] dark:text-[#b8ae9f]">
                        Loading map…
                      </div>
                    }
                  >
                    <Suspense
                      fallback={
                        <div className="h-[480px] md:h-[580px] bg-[#f0ebe3] dark:bg-[#2a2622] flex items-center justify-center text-[#8c8379] dark:text-[#b8ae9f]">
                          Loading map…
                        </div>
                      }
                    >
                      <div className="h-[480px] md:h-[580px]">
                        <ActivityMap ref={mapRef} coords={coords} />
                      </div>
                    </Suspense>
                  </ClientOnly>
                </div>
              ) : (
                <div id="three-dimensional-map-panel" role="tabpanel" aria-labelledby="three-dimensional-map-tab">
                  <ClientOnly
                    fallback={
                      <div className="flex h-[480px] items-center justify-center bg-[#1c1916] text-[#f5f1eb]/70">
                        Loading 3D flyover…
                      </div>
                    }
                  >
                    <Suspense
                      fallback={
                        <div className="h-[480px] bg-[#1c1916] flex items-center justify-center text-[#f5f1eb]/70">
                          Loading 3D flyover…
                        </div>
                      }
                    >
                      <ActivityFlyoverMap coords={coords} />
                    </Suspense>
                  </ClientOnly>
                </div>
              )}
            </div>
            <figcaption className="mt-3 flex items-center justify-between text-xs text-[#5c554d] dark:text-[#b8ae9f] uppercase tracking-wider">
              <span>{mapView === "2d" ? "Route map" : "3D flyover"}</span>
              <span>{coords.length} GPS points</span>
            </figcaption>
          </figure>
        ) : (
          <div className="mb-12 md:mb-16 border border-[#ddd5c9] dark:border-[#4a443e] bg-[#f0ebe3] dark:bg-[#2a2622] h-32 flex items-center justify-center text-sm text-[#8c8379] dark:text-[#b8ae9f]">
            No GPS data available
          </div>
        )}

        {altitude.length > 0 && (
          <figure className="mb-12 md:mb-16">
            <div className="border border-[#ddd5c9] dark:border-[#4a443e] bg-white dark:bg-[#2a2622] p-4 md:p-5">
              <Suspense
                fallback={
                  <div className="h-44 flex items-center justify-center text-[#8c8379] dark:text-[#b8ae9f] text-sm">
                    Loading chart…
                  </div>
                }
              >
                <ElevationChart altitude={altitude} totalDistanceKm={activity.distance / 1000} onHoverIndex={(i) => mapRef.current?.setHoverCoord(i != null ? coords[i] ?? null : null)} />
              </Suspense>
            </div>
            <figcaption className="mt-3 text-xs text-[#5c554d] dark:text-[#b8ae9f] uppercase tracking-wider">
              Elevation Profile
            </figcaption>
          </figure>
        )}

        <div className="border border-[#ddd5c9] dark:border-[#4a443e] bg-white dark:bg-[#2a2622] mb-12 md:mb-16">
          <button
            type="button"
            onClick={() => setNotesOpen((o) => !o)}
            className="w-full flex items-center justify-between p-5 md:p-6 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#2d4a3e] dark:focus:ring-[#a3c4b3]"
            aria-expanded={notesOpen}
          >
            <h2 className="font-[Oswald] text-xl md:text-2xl font-semibold text-[#1a1816] dark:text-[#f5f1eb]">
              Trail Notes
            </h2>
            <span className="text-2xl text-[#2d4a3e] dark:text-[#a3c4b3]">{notesOpen ? "−" : "+"}</span>
          </button>

          {notesOpen && (
            <div className="border-t border-[#ddd5c9] dark:border-[#4a443e] p-5 md:p-6">
              {editing ? (
                <Form method="post" onSubmit={() => setEditing(false)}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c554d] dark:text-[#b8ae9f] mb-1.5">Difficulty</label>
                      <select name="difficulty" defaultValue={activity.difficulty ?? ""} className="w-full border border-[#ddd5c9] dark:border-[#4a443e] bg-[#f5f1eb] dark:bg-[#3d3832] text-[#1a1816] dark:text-[#f5f1eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d4a3e] dark:focus:ring-[#a3c4b3]">
                        <option value="">— Select —</option>
                        {DIFFICULTY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c554d] dark:text-[#b8ae9f] mb-1.5">Trail Conditions</label>
                      <select name="conditions" defaultValue={activity.conditions ?? ""} className="w-full border border-[#ddd5c9] dark:border-[#4a443e] bg-[#f5f1eb] dark:bg-[#3d3832] text-[#1a1816] dark:text-[#f5f1eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d4a3e] dark:focus:ring-[#a3c4b3]">
                        <option value="">— Select —</option>
                        {CONDITIONS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c554d] dark:text-[#b8ae9f] mb-1.5">Weather</label>
                      <select name="weather" defaultValue={activity.weather ?? ""} className="w-full border border-[#ddd5c9] dark:border-[#4a443e] bg-[#f5f1eb] dark:bg-[#3d3832] text-[#1a1816] dark:text-[#f5f1eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d4a3e] dark:focus:ring-[#a3c4b3]">
                        <option value="">— Select —</option>
                        {WEATHER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c554d] dark:text-[#b8ae9f] mb-1.5">Rating (1–5)</label>
                      <input
                        type="number" name="rating" min="1" max="5"
                        defaultValue={activity.rating ?? ""}
                        className="w-full border border-[#ddd5c9] dark:border-[#4a443e] bg-[#f5f1eb] dark:bg-[#3d3832] text-[#1a1816] dark:text-[#f5f1eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d4a3e] dark:focus:ring-[#a3c4b3]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c554d] dark:text-[#b8ae9f] mb-1.5">Companions</label>
                      <input type="text" name="companions" defaultValue={activity.companions ?? ""} className="w-full border border-[#ddd5c9] dark:border-[#4a443e] bg-[#f5f1eb] dark:bg-[#3d3832] text-[#1a1816] dark:text-[#f5f1eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d4a3e] dark:focus:ring-[#a3c4b3]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c554d] dark:text-[#b8ae9f] mb-1.5">Gear</label>
                      <input type="text" name="gear" defaultValue={activity.gear ?? ""} className="w-full border border-[#ddd5c9] dark:border-[#4a443e] bg-[#f5f1eb] dark:bg-[#3d3832] text-[#1a1816] dark:text-[#f5f1eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d4a3e] dark:focus:ring-[#a3c4b3]" />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c554d] dark:text-[#b8ae9f] mb-1.5">Notes</label>
                    <textarea name="notes" defaultValue={activity.notes ?? ""} rows={4} className="w-full border border-[#ddd5c9] dark:border-[#4a443e] bg-[#f5f1eb] dark:bg-[#3d3832] text-[#1a1816] dark:text-[#f5f1eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d4a3e] dark:focus:ring-[#a3c4b3]" />
                  </div>

                  {actionData && "error" in actionData && (
                    <p className="text-[#c44536] text-sm mb-3">{actionData.error}</p>
                  )}

                  <div className="flex gap-3">
                    <button type="submit" className="bg-[#2d4a3e] hover:bg-[#1f352b] text-[#f5f1eb] text-sm font-semibold uppercase tracking-wider px-5 py-2.5 transition-colors">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="border border-[#ddd5c9] dark:border-[#4a443e] text-[#1a1816] dark:text-[#f5f1eb] hover:bg-[#f0ebe3] dark:hover:bg-[#3d3832] text-sm px-5 py-2.5 transition-colors">
                      Cancel
                    </button>
                  </div>
                </Form>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-[#5c554d] dark:text-[#b8ae9f] uppercase tracking-wider">
                      {hasNotes ? "Recorded details" : "No details recorded"}
                    </p>
                    {isOwner && (
                      <button
                        onClick={() => setEditing(true)}
                        className="text-sm font-semibold text-[#2d4a3e] dark:text-[#a3c4b3] hover:underline"
                      >
                        {hasNotes ? "Edit notes" : "+ Add notes"}
                      </button>
                    )}
                  </div>
                  {!hasNotes ? (
                    <EmptyNotes />
                  ) : (
                    <div className="space-y-3 text-sm">
                      {activity.rating && (
                        <p><span className="font-semibold text-[#1a1816] dark:text-[#f5f1eb]">Rating:</span> {"★".repeat(activity.rating)}{"☆".repeat(5 - activity.rating)}</p>
                      )}
                      {activity.difficulty && (
                        <p><span className="font-semibold text-[#1a1816] dark:text-[#f5f1eb]">Difficulty:</span> {activity.difficulty}</p>
                      )}
                      {activity.conditions && (
                        <p><span className="font-semibold text-[#1a1816] dark:text-[#f5f1eb]">Conditions:</span> {activity.conditions}</p>
                      )}
                      {activity.weather && (
                        <p><span className="font-semibold text-[#1a1816] dark:text-[#f5f1eb]">Weather:</span> {activity.weather}</p>
                      )}
                      {activity.companions && (
                        <p><span className="font-semibold text-[#1a1816] dark:text-[#f5f1eb]">With:</span> {activity.companions}</p>
                      )}
                      {activity.gear && (
                        <p><span className="font-semibold text-[#1a1816] dark:text-[#f5f1eb]">Gear:</span> {activity.gear}</p>
                      )}
                      {activity.notes && (
                        <p className="leading-relaxed"><span className="font-semibold text-[#1a1816] dark:text-[#f5f1eb]">Notes:</span> {activity.notes}</p>
                      )}
                    </div>
                  )}
                  {actionData && "success" in actionData && (
                    <p className="text-[#4a7c59] dark:text-[#7db88f] text-sm mt-4">Saved successfully.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-8 border-t border-[#ddd5c9] dark:border-[#4a443e]">
          <Link
            to="/activities"
            className="text-sm font-semibold text-[#2d4a3e] dark:text-[#a3c4b3] hover:underline"
          >
            ← Back to all hikes
          </Link>
        </div>
      </main>
    </div>
  );
}
