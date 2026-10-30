import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
  route("activities", "routes/activities._index.tsx"),
  route("activities/:id", "routes/activities.$id.tsx"),
  route(".well-known/*", "routes/well-known.ts"),
] satisfies RouteConfig;
