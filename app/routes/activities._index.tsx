import { Form, Link, useLoaderData, useNavigation } from "react-router";
import { db } from "~/lib/db.server";
import { commitSession, requireAuth } from "~/lib/session.server";
import { getActivityById, getActivityStreams, getAthleteActivities } from "~/services/strava.server";
import type { Route } from "./+types/activities._index";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const token = session.get("accessToken") as string;

  const [stravaActivities, importedActivities] = await Promise.all([
    getAthleteActivities(token),
    db.activity.findMany({ select: { id: true, stravaId: true }, orderBy: { startDate: "desc" } }),
  ]);

  const importedMap = new Map(
    importedActivities.map((a: { id: string; stravaId: string }) => [a.stravaId, a.id])
  );

  return { stravaActivities, importedMap: Object.fromEntries(importedMap) };
}

export async function action({ request }: Route.ActionArgs) {
  const session = await requireAuth(request);
  const token = session.get("accessToken") as string;

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

export default function ActivitiesIndex() {
  const { stravaActivities, importedMap } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const importingId = navigation.formData?.get("stravaId");

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Hikes</h1>

      <div className="space-y-3">
        {stravaActivities.map((activity: any) => {
          const dbId = importedMap[String(activity.id)];
          const isImported = !!dbId;
          const isImporting = importingId === String(activity.id);

          return (
            <div
              key={activity.id}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4"
            >
              <div>
                <p className="font-medium text-gray-900">{activity.name}</p>
                <p className="text-sm text-gray-500">
                  {new Date(activity.start_date).toLocaleDateString()} ·{" "}
                  {formatDistance(activity.distance)} ·{" "}
                  {formatDuration(activity.moving_time)} ·{" "}
                  {activity.total_elevation_gain}m gain
                </p>
              </div>

              <div className="ml-4 flex-shrink-0">
                {isImported ? (
                  <Link to={`/activities/${dbId}`} className="text-sm text-green-600 font-medium hover:underline">
                    View →
                  </Link>
                ) : (
                  <Form method="post">
                    <input type="hidden" name="stravaId" value={activity.id} />
                    <button
                      type="submit"
                      disabled={!!isImporting}
                      className="text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors"
                    >
                      {isImporting ? "Importing..." : "Import"}
                    </button>
                  </Form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
