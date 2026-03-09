import bcrypt from "bcryptjs";
import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { commitSession, getIsOwner, getSession } from "~/lib/session.server";
import type { Route } from "./+types/login";

export async function loader({ request }: Route.LoaderArgs) {
  const isOwner = await getIsOwner(request);
  if (isOwner) return redirect("/activities");
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const password = formData.get("password") as string;

  const hash = Buffer.from(process.env.ADMIN_PASSWORD_HASH!, "base64").toString("utf8");
  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    return { error: "Incorrect password" };
  }

  const session = await getSession(request);
  session.set("isOwner", true);
  return redirect("/activities", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center w-full max-w-sm px-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">HawiTrekkTrails</h1>
        <p className="text-gray-500 mb-8">Your personal hiking trail archive</p>

        <Form method="post" className="space-y-4">
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          {actionData && "error" in actionData && (
            <p className="text-red-500 text-sm">{actionData.error}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </Form>

        <Link to="/activities" className="text-sm text-gray-400 hover:text-gray-600 block mt-4">
          ← Back to hikes
        </Link>
      </div>
    </div>
  );
}
