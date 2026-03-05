import { useSearchParams } from "react-router";

export default function Login() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">HawiTrekkTrails</h1>
        <p className="text-gray-500 mb-8">Your personal hiking trail archive</p>

        {error && (
          <p className="text-red-500 text-sm mb-4">
            {error === "strava_denied"
              ? "Strava authorization was denied."
              : "Something went wrong. Please try again."}
          </p>
        )}

        <a
          href="/auth/strava"
          className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          Connect with Strava
        </a>
      </div>
    </div>
  );
}
