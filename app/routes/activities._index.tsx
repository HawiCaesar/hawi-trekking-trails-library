import { useState } from "react";
import { Form, Link, useLoaderData, useNavigation } from "react-router";
import { db } from "~/lib/db.server";
import { commitSession, getIsOwner, getSession, requireOwner } from "~/lib/session.server";
import { getActivityById, getActivityStreams, getAthleteActivities, getValidStravaToken } from "~/services/strava.server";
import type { Route } from "./+types/activities._index";

export async function loader({ request }: Route.LoaderArgs) {
  const isOwner = await getIsOwner(request);

  const imported = await db.activity.findMany({
    select: { id: true, stravaId: true, name: true, distance: true, movingTime: true, totalElevGain: true, startDate: true },
    orderBy: { startDate: "desc" },
  });

  if (!isOwner) {
    return { imported, stravaActivities: [], importedMap: {}, isOwner: false, stravaConnected: false };
  }

  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (!settings?.stravaAccessToken) {
    return { imported, stravaActivities: [], importedMap: {}, isOwner: true, stravaConnected: false };
  }

  const token = await getValidStravaToken();
  const stravaActivities = await getAthleteActivities(token);
  const importedMap = Object.fromEntries(imported.map((a) => [a.stravaId, a.id]));

  return { imported, stravaActivities, importedMap, isOwner: true, stravaConnected: true };
}

export async function action({ request }: Route.ActionArgs) {
  await requireOwner(request);

  const session = await getSession(request);
  const token = await getValidStravaToken();

  const formData = await request.formData();
  const stravaId = formData.get("stravaId") as string;

  const [activity, streams] = await Promise.all([
    getActivityById(token, stravaId),
    getActivityStreams(token, stravaId),
  ]);

  await db.activity.upsert({
    where: { stravaId },
    update: {},
    create: {
      stravaId,
      name: activity.name,
      distance: activity.distance,
      movingTime: activity.moving_time,
      elapsedTime: activity.elapsed_time,
      totalElevGain: activity.total_elevation_gain,
      startDate: new Date(activity.start_date),
      type: activity.sport_type ?? activity.type,
      gpsData: streams,
    },
  });

  return new Response(null, {
    status: 303,
    headers: {
      Location: "/activities",
      "Set-Cookie": await commitSession(session),
    },
  });
}

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type SortKey = "date-desc" | "date-asc" | "distance-desc" | "elevation-desc";

export default function ActivitiesIndex() {
  const { imported, stravaActivities, importedMap, isOwner, stravaConnected } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const importingId = navigation.formData?.get("stravaId");

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("date-desc");

  const filtered = imported
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "date-asc") return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      if (sort === "distance-desc") return b.distance - a.distance;
      if (sort === "elevation-desc") return b.totalElevGain - a.totalElevGain;
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

  const importable = stravaActivities.filter((a: any) => !importedMap[String(a.id)]);

  return (
    <div className="min-h-screen bg-[#f5f1eb] dark:bg-[#1c1916]">
      <header className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="font-[Oswald] text-lg font-semibold tracking-tight text-[#1a1816] dark:text-[#f5f1eb]"
        >
          Hawi's Hikes
        </Link>
        {isOwner ? (
          <Form method="post" action="/logout">
            <button
              type="submit"
              className="text-sm text-[#5c554d] hover:text-[#1a1816] dark:text-[#b8ae9f] dark:hover:text-[#f5f1eb] transition-colors"
            >
              Sign out
            </button>
          </Form>
        ) : (
          <Link
            to="/login"
            className="text-sm text-[#5c554d] hover:text-[#1a1816] dark:text-[#b8ae9f] dark:hover:text-[#f5f1eb] transition-colors"
          >
            Owner login
          </Link>
        )}
      </header>

      <section className="relative w-full h-[50vh] min-h-[320px] max-h-[560px] overflow-hidden">
        <img
          src="/hero-magazine-cover.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover motion-safe:animate-[hero-zoom_20s_ease-in-out_infinite_alternate]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1816]/80 via-[#1a1816]/30 to-[#1a1816]/10" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-6xl mx-auto px-6 pb-10 md:pb-14 w-full">
            <p className="text-[#c4a13e] text-xs font-semibold uppercase tracking-[0.2em] mb-3">
              Personal Trail Archive
            </p>
            <h1 className="font-[Oswald] text-5xl md:text-7xl font-bold text-[#f5f1eb] tracking-tight leading-[0.95]">
              Hawi's Hikes
            </h1>
            <p className="mt-4 text-[#f5f1eb]/90 text-base md:text-lg max-w-xl leading-relaxed">
              A curated collection of trails, recorded from Strava and remembered in detail.
            </p>
          </div>
        </div>
      </section>

      {isOwner && (
        <section className="max-w-6xl mx-auto px-6 py-8">
          <div className="border border-[#ddd5c9] dark:border-[#4a443e] bg-[#f0ebe3] dark:bg-[#2a2622] p-5 md:p-6">
            <h2 className="font-[Oswald] text-xl font-semibold text-[#1a1816] dark:text-[#f5f1eb] mb-1">
              Editor's Desk
            </h2>
            <p className="text-sm text-[#5c554d] dark:text-[#b8ae9f] mb-5">
              Import new hikes from Strava to add them to the archive.
            </p>

            {!stravaConnected ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-[#ddd5c9] dark:border-[#4a443e] pt-5">
                <p className="text-sm text-[#1a1816] dark:text-[#f5f1eb]">
                  Connect Strava to import new hikes.
                </p>
                <a
                  href="/auth/strava"
                  className="inline-flex items-center justify-center text-sm font-semibold uppercase tracking-wider bg-[#2d4a3e] hover:bg-[#1f352b] text-[#f5f1eb] px-5 py-2.5 transition-colors"
                >
                  Connect Strava
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                {importable.length === 0 ? (
                  <p className="text-sm text-[#5c554d] dark:text-[#b8ae9f] italic">
                    All Strava activities are imported.
                  </p>
                ) : (
                  importable.map((activity: any) => {
                    const isImporting = importingId === String(activity.id);
                    return (
                      <div
                        key={activity.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-[#ddd5c9] dark:border-[#4a443e] pt-4 first:border-0 first:pt-0"
                      >
                        <div>
                          <p className="font-medium text-[#1a1816] dark:text-[#f5f1eb]">{activity.name}</p>
                          <p className="text-sm text-[#5c554d] dark:text-[#b8ae9f]">
                            {new Date(activity.start_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                            {" · "}
                            {formatDistance(activity.distance)}
                            {" · "}
                            {formatDuration(activity.moving_time)}
                            {" · "}
                            {activity.total_elevation_gain}m gain
                          </p>
                        </div>
                        <Form method="post" className="flex-shrink-0">
                          <input type="hidden" name="stravaId" value={activity.id} />
                          <button
                            type="submit"
                            disabled={!!isImporting}
                            className="text-xs font-semibold uppercase tracking-wider bg-[#2d4a3e] hover:bg-[#1f352b] disabled:opacity-50 text-[#f5f1eb] px-4 py-2 transition-colors"
                          >
                            {isImporting ? "Importing..." : "Import"}
                          </button>
                        </Form>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <main className="max-w-6xl mx-auto px-6 pt-12 md:pt-16 pb-16 md:pb-24">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-8 pb-6 border-b border-[#ddd5c9] dark:border-[#4a443e]">
          <div>
            <h2 className="font-[Oswald] text-2xl md:text-3xl font-semibold text-[#1a1816] dark:text-[#f5f1eb]">
              {isOwner ? "Imported Hikes" : "Hikes"}
            </h2>
            {filtered.length > 0 && (
              <p className="text-[#5c554d] dark:text-[#b8ae9f] text-sm mt-1">
                {filtered.length} {filtered.length === 1 ? "story" : "stories"}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <label htmlFor="hike-search" className="sr-only">
              Search hikes
            </label>
            <input
              id="hike-search"
              type="text"
              placeholder="Search hikes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-56 border border-[#ddd5c9] dark:border-[#4a443e] bg-white dark:bg-[#3d3832] text-[#1a1816] dark:text-[#f5f1eb] placeholder-[#8c8379] dark:placeholder-[#8c8379] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d4a3e] dark:focus:ring-[#a3c4b3]"
            />
            <label htmlFor="hike-sort" className="sr-only">
              Sort hikes
            </label>
            <select
              id="hike-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full sm:w-auto border border-[#ddd5c9] dark:border-[#4a443e] bg-white dark:bg-[#3d3832] text-[#1a1816] dark:text-[#f5f1eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d4a3e] dark:focus:ring-[#a3c4b3]"
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="distance-desc">Longest first</option>
              <option value="elevation-desc">Most elevation</option>
            </select>
          </div>
        </div>

        {imported.length === 0 ? (
          <div className="border border-[#ddd5c9] dark:border-[#4a443e] bg-white dark:bg-[#2a2622] p-8 md:p-12 text-center">
            <p className="font-[Oswald] text-xl text-[#1a1816] dark:text-[#f5f1eb] mb-2">No hikes yet</p>
            <p className="text-sm text-[#5c554d] dark:text-[#b8ae9f]">
              {isOwner ? "Connect Strava and import your first hike to begin the archive." : "The archive is empty. Check back soon."}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-[#ddd5c9] dark:border-[#4a443e] bg-white dark:bg-[#2a2622] p-8 md:p-12 text-center">
            <p className="font-[Oswald] text-xl text-[#1a1816] dark:text-[#f5f1eb] mb-2">No matches</p>
            <p className="text-sm text-[#5c554d] dark:text-[#b8ae9f]">
              No hikes match your search. Try a different term.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((activity) => (
              <Link
                key={activity.id}
                to={`/activities/${activity.id}`}
                className="group focus:outline-none focus:ring-2 focus:ring-[#2d4a3e] dark:focus:ring-[#a3c4b3]"
              >
                <article className="h-full bg-white dark:bg-[#2a2622] border border-[#ddd5c9] dark:border-[#4a443e] p-5 transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-sm">
                  <p className="text-[#5c554d] dark:text-[#b8ae9f] text-xs uppercase tracking-[0.15em] mb-3">
                    {new Date(activity.startDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <h3 className="font-[Oswald] text-xl font-semibold text-[#1a1816] dark:text-[#f5f1eb] group-hover:text-[#2d4a3e] dark:group-hover:text-[#a3c4b3] transition-colors leading-tight">
                    {activity.name}
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5c554d] dark:text-[#b8ae9f] uppercase tracking-wider">
                    <span>{formatDistance(activity.distance)}</span>
                    <span>{formatDuration(activity.movingTime)}</span>
                    <span>{activity.totalElevGain}m gain</span>
                  </div>
                  <div className="mt-5 pt-4 border-t border-[#ddd5c9] dark:border-[#4a443e] flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#2d4a3e] dark:text-[#a3c4b3]">
                      Read the route
                    </span>
                    <span aria-hidden="true" className="text-lg text-[#2d4a3e] dark:text-[#a3c4b3] transition-transform duration-200 group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
