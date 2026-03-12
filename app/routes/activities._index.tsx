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

  // Check if Strava is connected
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
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime(); // date-desc
    });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Hawi's Hikes</h1>
        {isOwner ? (
          <Form method="post" action="/logout">
            <button type="submit" className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
              Sign out
            </button>
          </Form>
        ) : (
          <Link to="/login" className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
            Owner login
          </Link>
        )}
      </div>

      {/* Owner: Strava import section */}
      {isOwner && (
        <div className="mb-8">
          {!stravaConnected ? (
            <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4 flex items-center justify-between">
              <p className="text-sm text-orange-700 dark:text-orange-300">Connect Strava to import new hikes.</p>
              <a
                href="/auth/strava"
                className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded transition-colors"
              >
                Connect Strava
              </a>
            </div>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Import from Strava</h2>
              <div className="space-y-2">
                {stravaActivities
                  .filter((a: any) => !importedMap[String(a.id)])
                  .map((activity: any) => {
                    const isImporting = importingId === String(activity.id);
                    return (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{activity.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(activity.start_date).toLocaleDateString()} ·{" "}
                            {formatDistance(activity.distance)} ·{" "}
                            {formatDuration(activity.moving_time)} ·{" "}
                            {activity.total_elevation_gain}m gain
                          </p>
                        </div>
                        <Form method="post" className="ml-4 flex-shrink-0">
                          <input type="hidden" name="stravaId" value={activity.id} />
                          <button
                            type="submit"
                            disabled={!!isImporting}
                            className="text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors"
                          >
                            {isImporting ? "Importing..." : "Import"}
                          </button>
                        </Form>
                      </div>
                    );
                  })}
                {stravaActivities.filter((a: any) => !importedMap[String(a.id)]).length === 0 && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">All Strava activities are imported.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Search */}
      {imported.length > 0 && (
        <input
          type="text"
          placeholder="Search hikes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-4 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      )}

      {/* Imported hikes — visible to everyone */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {isOwner ? "Imported Hikes" : "Hikes"}{filtered.length > 0 && ` (${filtered.length})`}
        </h2>
        {imported.length > 0 && (
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="distance-desc">Longest first</option>
            <option value="elevation-desc">Most elevation</option>
          </select>
        )}
      </div>
      {imported.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">No hikes yet.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">No hikes match your search.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((activity) => (
            <Link
              key={activity.id}
              to={`/activities/${activity.id}`}
              className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-orange-300 dark:hover:border-orange-600 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{activity.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(activity.startDate).toLocaleDateString()} ·{" "}
                  {formatDistance(activity.distance)} ·{" "}
                  {formatDuration(activity.movingTime)} ·{" "}
                  {activity.totalElevGain}m gain
                </p>
              </div>
              <span className="ml-4 text-sm text-orange-500 font-medium flex-shrink-0">View →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
