import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
  route("auth/strava", "routes/auth.strava.ts"),
  route("auth/callback", "routes/auth.callback.ts"),
  route("activities", "routes/activities._index.tsx"),
  route("activities/:id", "routes/activities.$id.tsx"),
  // Suppress noisy Chrome DevTools probe errors (/.well-known/appspecific/com.chrome.devtools.json)
  route(".well-known/*", "routes/well-known.ts"),
] satisfies RouteConfig;
