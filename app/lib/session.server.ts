import { createCookieSessionStorage } from "react-router";

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

export async function getIsOwner(request: Request): Promise<boolean> {
  const session = await getSession(request);
  return session.get("isOwner") === true;
}

export async function requireOwner(request: Request): Promise<void> {
  const isOwner = await getIsOwner(request);
  if (!isOwner) throw new Response("Forbidden", { status: 403 });
}
