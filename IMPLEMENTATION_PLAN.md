# HawiTrekkTrails - Implementation Plan

This document breaks the project into concrete, sequential implementation phases.
Each phase has a clear goal, specific commands/files to create, and a verification checklist before moving on.

---

## Phase 1: Project Scaffold

**Goal**: Create the Remix app with TypeScript, connect it to a local PostgreSQL database, and verify the dev server runs.

### Steps

1. **Scaffold Remix app**
   ```bash
   npx create-remix@latest trails-app --template remix/indie-stack
   # OR bare template:
   npx create-remix@latest trails-app
   # Choose: TypeScript, Vite, no deployment target yet
   cd trails-app
   ```

2. **Install core dependencies**
   ```bash
   npm install prisma @prisma/client
   npm install react-leaflet leaflet
   npm install -D @types/leaflet
   npm install date-fns
   ```

3. **Initialize Prisma**
   ```bash
   npx prisma init
   # Creates: prisma/schema.prisma + .env with DATABASE_URL
   ```

4. **Define Prisma schema** — edit `prisma/schema.prisma`:
   ```prisma
   model Activity {
     id            String   @id @default(cuid())
     stravaId      String   @unique
     name          String
     distance      Float
     movingTime    Int
     elapsedTime   Int
     totalElevGain Float
     startDate     DateTime
     type          String
     gpsData       Json?

     // Custom fields
     difficulty    String?
     conditions    String?
     weather       String?
     notes         String?
     rating        Int?
     companions    String?
     gear          String?

     createdAt     DateTime @default(now())
     updatedAt     DateTime @updatedAt
   }
   ```

5. **Run initial migration**
   ```bash
   npx prisma migrate dev --name init
   ```

6. **Create Prisma client singleton** — `app/lib/db.server.ts`:
   ```ts
   import { PrismaClient } from "@prisma/client";
   declare global { var __db__: PrismaClient }
   if (!global.__db__) { global.__db__ = new PrismaClient(); }
   export const db = global.__db__;
   ```

7. **Create `.env.example`**
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/trails"
   SESSION_SECRET="changeme"
   STRAVA_CLIENT_ID="202148"
   STRAVA_CLIENT_SECRET=""
   STRAVA_ACCESS_TOKEN=""
   STRAVA_REFRESH_TOKEN=""
   ```

### Verify Phase 1
- [ ] `npm run dev` starts without errors
- [ ] `npx prisma studio` opens and shows the Activity table
- [ ] `.env` is in `.gitignore`

---

## Phase 2: Strava OAuth

**Goal**: Log in via Strava and store the access/refresh tokens in a session. Protect routes from unauthenticated access.

### Steps

1. **Install session helpers**
   ```bash
   npm install remix-utils  # optional, for cookie utilities
   ```

2. **Create session storage** — `app/lib/session.server.ts`:
   ```ts
   import { createCookieSessionStorage, redirect } from "@remix-run/node";

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
     if (!session.get("accessToken")) throw redirect("/login");
     return session;
   }
   ```

3. **Create Strava OAuth routes**

   `app/routes/auth.strava.tsx` — redirect to Strava:
   ```ts
   import type { LoaderFunctionArgs } from "@remix-run/node";
   import { redirect } from "@remix-run/node";

   export async function loader({ request }: LoaderFunctionArgs) {
     const params = new URLSearchParams({
       client_id: process.env.STRAVA_CLIENT_ID!,
       redirect_uri: `${new URL(request.url).origin}/auth/callback`,
       response_type: "code",
       scope: "read,activity:read_all",
     });
     return redirect(`https://www.strava.com/oauth/authorize?${params}`);
   }
   ```

   `app/routes/auth.callback.tsx` — exchange code for tokens:
   ```ts
   // Exchange code → tokens → store in session → redirect to /activities
   ```

4. **Create login page** — `app/routes/login.tsx`:
   - Simple page with "Connect with Strava" button linking to `/auth/strava`

5. **Create token refresh utility** — `app/lib/strava.server.ts`:
   ```ts
   export async function refreshStravaToken(refreshToken: string) {
     const res = await fetch("https://www.strava.com/oauth/token", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         client_id: process.env.STRAVA_CLIENT_ID,
         client_secret: process.env.STRAVA_CLIENT_SECRET,
         grant_type: "refresh_token",
         refresh_token: refreshToken,
       }),
     });
     return res.json();
   }
   ```

6. **Add logout route** — `app/routes/logout.tsx`:
   ```ts
   // Action: destroy session → redirect to /login
   ```

### Verify Phase 2
- [ ] Visiting `/auth/strava` redirects to Strava authorization page
- [ ] After approving, callback stores tokens in session
- [ ] Visiting `/activities` without a session redirects to `/login`
- [ ] Logout clears session and redirects to `/login`

---

## Phase 3: Activity List & Strava Import

**Goal**: Fetch your Strava activities, display them in a list, and import selected ones to the database.

### Steps

1. **Create Strava service** — `app/services/strava.server.ts`:
   ```ts
   const BASE = "https://www.strava.com/api/v3";

   export async function getAthleteActivities(token: string, page = 1) {
     const res = await fetch(
       `${BASE}/athlete/activities?per_page=30&page=${page}`,
       { headers: { Authorization: `Bearer ${token}` } }
     );
     if (!res.ok) throw new Error("Strava API error");
     return res.json();
   }

   export async function getActivityById(token: string, id: string) {
     const res = await fetch(`${BASE}/activities/${id}`, {
       headers: { Authorization: `Bearer ${token}` },
     });
     return res.json();
   }

   export async function getActivityStreams(token: string, id: string) {
     const res = await fetch(
       `${BASE}/activities/${id}/streams?keys=latlng,altitude&key_by_type=true`,
       { headers: { Authorization: `Bearer ${token}` } }
     );
     return res.json();
   }
   ```

2. **Create activities index route** — `app/routes/activities._index.tsx`:
   - **Loader**: `requireAuth` → fetch from DB + optionally fetch from Strava
   - **Action**: handle `intent=sync` (fetch Strava list) or `intent=import` (save one activity)
   - **UI**: list of Strava activities with Import button; list of already-imported ones

3. **Import logic in the action**:
   ```ts
   // When intent === "import":
   // 1. getActivityById(token, stravaId)
   // 2. getActivityStreams(token, stravaId)
   // 3. db.activity.upsert({ where: { stravaId }, ... })
   ```

4. **Activity card component** — `app/components/ActivityCard.tsx`:
   - Shows: name, date, distance (km), elevation gain, type
   - Shows import status badge if already in DB

### Verify Phase 3
- [ ] `/activities` loads and shows Strava activities
- [ ] Clicking "Import" saves activity + GPS to the DB
- [ ] Already-imported activities show a status badge
- [ ] Errors from the Strava API are displayed gracefully

---

## Phase 4: Activity Detail & Map

**Goal**: View a single imported activity with its GPS route on a Leaflet map.

### Steps

1. **Create detail route** — `app/routes/activities.$id.tsx`:
   - **Loader**: `requireAuth` → `db.activity.findUniqueOrThrow({ where: { id } })`
   - Return activity with `gpsData`
   - Handle 404 with `throw new Response("Not Found", { status: 404 })`

2. **Create map component** — `app/components/ActivityMap.tsx`:
   ```tsx
   import { MapContainer, TileLayer, Polyline } from "react-leaflet";
   // Accept: coords: [number, number][]
   // Render polyline + fit bounds
   ```
   - Must be lazy-loaded (SSR will break Leaflet):
   ```tsx
   // In the route file:
   import { lazy, Suspense } from "react";
   const ActivityMap = lazy(() => import("~/components/ActivityMap"));
   // Wrap in <ClientOnly> or <Suspense>
   ```
   - Or use Remix's `ClientOnly` pattern.

3. **Parse GPS data** in the route:
   ```ts
   const coords = (activity.gpsData as any)?.latlng?.data as [number, number][];
   ```

4. **Detail page UI**:
   - Stats row: distance, time, elevation, date
   - Map (full width, 400px tall)
   - Custom fields section (read-only for now)
   - Edit button (links to edit view / Phase 5)

5. **Add Leaflet CSS** — in `app/root.tsx`:
   ```tsx
   import "leaflet/dist/leaflet.css";
   ```
   Or use a `<link>` tag in the route's `links` export.

### Verify Phase 4
- [ ] `/activities/:id` loads and shows activity stats
- [ ] Map renders with the GPS polyline
- [ ] No SSR errors from Leaflet
- [ ] 404 page shown for missing activities

---

## Phase 5: Custom Annotations (Edit Form)

**Goal**: Let the user add difficulty, conditions, notes, rating, etc. to any activity.

### Steps

1. **Add action to `activities.$id.tsx`**:
   ```ts
   // intent=edit → validate + db.activity.update(...)
   ```

2. **Edit form UI** (inline on detail page or separate `/activities/:id/edit`):
   ```tsx
   <Form method="post">
     <input type="hidden" name="intent" value="edit" />
     <select name="difficulty">...</select>
     <select name="conditions">...</select>
     <input name="weather" />
     <textarea name="notes" />
     <input type="number" name="rating" min="1" max="5" />
     <input name="companions" />
     <input name="gear" />
     <button type="submit">Save</button>
   </Form>
   ```

3. **Validation** in the action:
   - `rating` must be 1–5 or empty
   - `difficulty` must be one of allowed values
   - Return `json({ errors })` on failure

4. **Show custom fields** on the detail page (below the map)

5. **Filter/highlight** annotated activities in the list view (add a colored dot or badge)

### Verify Phase 5
- [ ] Submitting the form saves custom fields to the DB
- [ ] Validation errors are shown inline
- [ ] Saved values appear on the detail page
- [ ] List view shows a badge for annotated activities

---

## Phase 6: Railway Deployment

**Goal**: Deploy the app to Railway with a production PostgreSQL database.

### Steps

1. **Test production build locally**:
   ```bash
   npm run build
   npm start
   ```

2. **Create Railway project** via dashboard or CLI:
   ```bash
   npm install -g @railway/cli
   railway login
   railway init
   railway add postgresql
   ```

3. **Set environment variables** in Railway dashboard:
   ```
   DATABASE_URL        (auto-set by Railway PostgreSQL plugin)
   SESSION_SECRET
   STRAVA_CLIENT_ID
   STRAVA_CLIENT_SECRET
   STRAVA_ACCESS_TOKEN
   STRAVA_REFRESH_TOKEN
   ```

4. **Add `Procfile` or `railway.json`**:
   ```json
   {
     "build": { "builder": "NIXPACKS" },
     "deploy": { "startCommand": "npm start" }
   }
   ```

5. **Run migrations in production**:
   ```bash
   railway run npx prisma migrate deploy
   ```

6. **Update Strava OAuth callback URL**:
   - Strava Developer settings → update callback domain to Railway URL

7. **Verify SSL and OAuth flow end-to-end**

### Verify Phase 6
- [ ] `npm run build && npm start` works locally
- [ ] Railway deployment succeeds (no build errors)
- [ ] Database migrations run in production
- [ ] OAuth flow works with the production callback URL
- [ ] Activities import and map renders in production

---

## Phase 7: Polish (Post-MVP)

Only tackle these after Phase 6 is fully working.

| Feature | Notes |
|---|---|
| Responsive mobile layout | Tailwind breakpoints on list/detail |
| Bulk import all activities | Loop + upsert with rate limiting |
| Activity search & sort | Filter by type, date range, sort by distance |
| Loading skeletons | Use Remix `useNavigation` pending states |
| Activity stats dashboard | Aggregate totals (total km, hikes, elevation) |
| GPX upload | Parse GPX XML → gpsData JSON |
| Dark mode | CSS variables or Tailwind `dark:` classes |

---

## Debugging Notes

- **Leaflet SSR crash**: Always lazy-load map components or wrap in a `ClientOnly` component.
- **Prisma hot-reload issue**: Use the singleton pattern in `db.server.ts` to avoid "too many connections" in dev.
- **Strava rate limits**: 100 requests per 15 min, 1000/day. Cache activity list in session or DB to avoid repeated hits.
- **Token expiry**: Access tokens expire in 6 hours. Always check `expires_at` and refresh before API calls.
- **GPS data size**: `latlng` streams for long hikes can be large. Store as JSON in Postgres — no need to normalize.

### Railway + Prisma 7 Deployment (Phase 6 lessons)

- **Prisma 7 removes `url` from `schema.prisma`**: The datasource URL is now configured only in `prisma.config.ts`. Do not add `url = env("DATABASE_URL")` to the schema — Prisma 7 will throw an error.
- **`prisma.config.ts` relies on `process.env`**: The config file reads `DATABASE_URL` at runtime. This works fine in Railway's runtime environment but NOT at build time, since Railway does not inject service variables into the build phase by default.
- **Do not run `prisma migrate deploy` in the build or start script**: Prisma 7 cannot reliably find `prisma.config.ts` or the schema during Railway's build/runtime lifecycle. The `--schema` flag is also unreliable in Prisma 7.
- **Best approach for Railway: run migrations manually once from local machine**:
  ```bash
  # Use the public external URL from Railway's Postgres service (not the internal one)
  DATABASE_URL="postgresql://postgres:...@roundhouse.proxy.rlwy.net:PORT/railway" npx prisma migrate deploy
  ```
  - Railway exposes two URLs: `DATABASE_URL` (internal, only reachable within Railway network) and `DATABASE_PUBLIC_URL` (external, reachable from anywhere). Use the public one locally.
  - After running this once, the schema is applied. Future schema changes should be migrated the same way.
- **Keep build and start scripts simple**:
  ```json
  "build": "prisma generate && react-router build",
  "start": "react-router-serve ./build/server/index.js"
  ```
- **Strava `client_id` in `.env`**: Must not be wrapped in quotes. Use `STRAVA_CLIENT_ID=202148`, not `STRAVA_CLIENT_ID="202148"`.
- **Chrome DevTools `.well-known` probe errors**: Add a catch-all route `route(".well-known/*", "routes/well-known.ts")` returning a 200 to suppress the terminal noise.

---

## File Structure (Target)

```
trails-app/
├── app/
│   ├── components/
│   │   ├── ActivityCard.tsx
│   │   └── ActivityMap.tsx
│   ├── lib/
│   │   ├── db.server.ts
│   │   └── session.server.ts
│   ├── routes/
│   │   ├── _index.tsx              # redirect to /activities
│   │   ├── login.tsx
│   │   ├── logout.tsx
│   │   ├── auth.strava.tsx
│   │   ├── auth.callback.tsx
│   │   ├── activities._index.tsx
│   │   └── activities.$id.tsx
│   ├── services/
│   │   └── strava.server.ts
│   └── root.tsx
├── prisma/
│   └── schema.prisma
├── .env
├── .env.example
└── package.json
```
