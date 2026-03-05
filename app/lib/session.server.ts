import { createCookieSessionStorage, redirect } from "react-router";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET!],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export const { commitSession, destroySession } = sessionStorage;

export async function requireAuth(request: Request) {
  const session = await getSession(request);
  if (!session.get("accessToken")) {
    throw redirect("/login");
  }
  return session;
}
