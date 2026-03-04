# HawiTrekkTrails - Overall Plan

## Project Overview
Full-stack hiking trail tracker with Strava integration. Track completed hikes with custom annotations (difficulty, conditions, gear, etc.) and GPS visualization.

## Tech Stack
- **Framework**: Remix (full-stack React + TypeScript)
- **Map Visualization**: React Leaflet
- **Database**: PostgreSQL + Prisma ORM
- **Hosting**: Railway
- **Auth**: Strava OAuth (single user)

---

## Phase 1: Project Setup & Database Schema

### 1.1 Initialize Remix Project
- [ ] Create Remix v2 app (`npx create-remix@latest`)
- [ ] Choose TypeScript template
- [ ] Initialize git repository
- [ ] Set up `.gitignore` file
- [ ] Create `.env.example` file

### 1.2 Database Setup
- [ ] Install Prisma
- [ ] Define Prisma schema for Activity model
- [ ] Set up PostgreSQL database (local or Railway)
- [ ] Run initial migration
- [ ] Test database connection

### 1.3 Core Dependencies
- [ ] Prisma Client
- [ ] React Leaflet + Leaflet (map visualization)
- [ ] date-fns (date formatting)
- [ ] Any additional UI libraries (optional)

### 1.4 Project Structure
- [ ] Set up `/app/routes` folder structure
- [ ] Create `/app/lib` for utilities
- [ ] Create `/app/services` for Strava API calls
- [ ] Create `/prisma` folder for schema

**Deliverable**: Working local Remix development environment with database connected

---

## Phase 2: Strava OAuth Flow

**Note**: You already have a Strava app created (Client ID: 202148) and access token working.

### 2.1 Remix OAuth Routes
- [ ] `/app/routes/auth.strava.tsx` - Redirect to Strava authorization
- [ ] `/app/routes/auth.callback.tsx` - Handle OAuth callback (loader function)
- [ ] Exchange code for access token
- [ ] Store token in session or environment (single user MVP)
- [ ] Create token refresh utility function

### 2.2 Session Management
- [ ] Set up Remix session storage
- [ ] Create session helpers (`getSession`, `commitSession`)
- [ ] Protect routes with loader authentication checks
- [ ] Handle unauthorized redirects

### 2.3 Configure Environment
- [ ] Add Strava Client ID (202148) to `.env`
- [ ] Add Strava Client Secret to `.env`
- [ ] Add your current access token to `.env` (temporary for testing)
- [ ] Update callback URL when deploying
- [ ] Set SESSION_SECRET for Remix sessions

**Deliverable**: Working OAuth login flow with valid Strava access token

---

## Phase 3: Activity List & Import

### 3.1 Remix Routes & API Logic
- [ ] `/app/routes/activities._index.tsx` - Activity list page
  - Loader: Fetch activities from database
  - Action: Trigger Strava sync
- [ ] `/app/routes/api.strava.activities.tsx` - Resource route for Strava data
  - Loader: Fetch from Strava API
- [ ] `/app/routes/api.activities.import.tsx` - Import activity
  - Action: Import specific activity by Strava ID
    - Fetch activity metadata from Strava
    - Fetch GPS streams from Strava
    - Save to database with JSON GPS data
- [ ] Error handling for Strava API calls

### 3.2 Strava Service Layer
- [ ] Create `/app/services/strava.server.ts`
- [ ] `getAthleteActivities()` - Fetch from Strava
- [ ] `getActivityStreams(activityId)` - Fetch GPS data
- [ ] Token refresh logic
- [ ] Error handling and rate limiting

### 3.3 Activity List UI
- [ ] Activity cards (name, date, distance, elevation)
- [ ] Button to sync from Strava
- [ ] Import button for each activity
- [ ] Loading states (useNavigation hook)
- [ ] Error messages
- [ ] Import status indicators

**Deliverable**: Ability to view Strava activities and import them to database

---

## Phase 4: Activity Detail & Map Visualization

### 4.1 Remix Routes
- [ ] `/app/routes/activities.$id.tsx` - Activity detail page
  - Loader: Fetch single activity with GPS data
  - Action: Update or delete activity
- [ ] Handle 404 for non-existent activities

### 4.2 Activity Detail UI
- [ ] Display all Strava metadata (distance, time, elevation)
- [ ] Leaflet map component (client-side only)
- [ ] Parse GPS JSON and render polyline on map
- [ ] Map controls (zoom, fit bounds to route)
- [ ] Start/end markers
- [ ] Loading states

### 4.3 Map Rendering
- [ ] Create `/app/components/ActivityMap.tsx`
- [ ] Use `useEffect` for client-side map initialization
- [ ] Transform latlng JSON to Leaflet format
- [ ] Style the route polyline
- [ ] Handle SSR (map only renders on client)

**Deliverable**: Activity detail page with GPS route visualization

---

## Phase 5: Custom Fields & Annotations

### 5.1 Remix Action
- [ ] Update `/app/routes/activities.$id.tsx` action
- [ ] Handle form submission with custom fields
- [ ] Validation for inputs
- [ ] Return success/error responses

### 5.2 Edit Form UI
- [ ] Use Remix `<Form>` component
- [ ] Edit mode toggle on detail page
- [ ] Form fields for custom data:
  - Difficulty (dropdown or rating)
  - Trail conditions (text or dropdown)
  - Weather (text or dropdown)
  - Personal notes (textarea)
  - Rating (1-5 stars)
  - Companions (text)
  - Gear used (text or tags)
- [ ] Save/cancel buttons
- [ ] Client-side validation
- [ ] Show action data for success/error messages

### 5.3 Display Custom Data
- [ ] Show custom fields on detail page
- [ ] Highlight rated/annotated activities in list view
- [ ] Filter by difficulty/rating (optional)

**Deliverable**: Ability to annotate activities with custom metadata

---

## Phase 6: Deployment to Railway

### 6.1 Remix Production Setup
- [ ] Build Remix app (`npm run build`)
- [ ] Test production build locally
- [ ] Configure Remix adapter (default Node server is fine)
- [ ] Set up start script in package.json

### 6.2 Railway Deployment
- [ ] Create Railway project
- [ ] Add PostgreSQL service
- [ ] Configure environment variables:
  - DATABASE_URL
  - SESSION_SECRET
  - STRAVA_CLIENT_ID
  - STRAVA_CLIENT_SECRET
  - STRAVA_ACCESS_TOKEN (temporary)
- [ ] Deploy Remix app
- [ ] Run Prisma migrations in production
- [ ] Test deployed endpoints

### 6.3 Domain & OAuth Update
- [ ] Configure custom domain (optional)
- [ ] Update Strava OAuth callback URL to production domain
- [ ] Test OAuth flow in production
- [ ] Verify SSL certificates

**Deliverable**: Fully deployed application accessible via URL

---

## Phase 7: Polish & Enhancements

### 7.1 UI/UX Improvements
- [ ] Responsive design for mobile
- [ ] Loading skeletons (use Remix pending states)
- [ ] Better error boundaries
- [ ] Activity filtering/search
- [ ] Sort options (date, distance, elevation)
- [ ] Optimistic UI updates

### 7.2 Additional Features (Nice-to-Have)
- [ ] Bulk import all activities
- [ ] Activity statistics dashboard
- [ ] GPX file upload for non-Strava hikes
- [ ] Photo uploads for activities
- [ ] Export activities to GPX
- [ ] Share activity links
- [ ] Dark mode

### 7.3 Performance
- [ ] Optimize GPS data loading (defer or paginate if needed)
- [ ] Cache Strava API responses (Remix loaders)
- [ ] Add database indexes
- [ ] Route prefetching
- [ ] Image optimization

**Deliverable**: Production-ready portfolio project

---

## Success Metrics
- [ ] OAuth authentication works reliably
- [ ] Activities import with complete GPS data
- [ ] Maps render smoothly with 5,000+ GPS points
- [ ] Custom annotations save and display correctly
- [ ] Application is mobile-responsive
- [ ] Deployed and accessible online

## Notes
- Start with single-user MVP (your personal Strava account)
- Focus on core functionality before polish
- Test each phase before moving to next
- Keep commits small and frequent
- Document any API quirks or gotchas