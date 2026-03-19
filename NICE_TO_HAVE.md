# Nice to Have

Ideas for future improvements, discussed but not yet planned for implementation.

---

## Landing Page Visualizations

The current landing page is a flat list of hike entries. The goal is to make it more visual and personal as the archive grows.

### Route Gallery
Each hike card shows a small thumbnail of its actual GPS route — the trail line drawn as an SVG path on a clean background, no map tiles. Like art prints of your trails.

- Data source: encoded polylines already stored in the DB — no extra API calls
- Clicking a shape opens the full hike detail page
- Aesthetic: thin orange line on white (light mode) or dark background
- Scales well — 5 hikes looks good, 50 looks like a collection
- Could be filterable by location/type

### Interactive Map of Kenya
A Mapbox map centered on Kenya with a marker for each hike location. Filters (Easy trails / High altitude / Multi-day) show/hide markers. Clicking a marker opens a side panel with the hike name, stats, and a View button.

- Two views: **Map view** (this) and **List view** (current default)
- Becomes more compelling the more hikes are spread across different locations

### Elevation Wall
All elevation profiles lined up side by side as a continuous mountain skyline. Hovering a peak highlights that hike. Shows the character of each trail at a glance — flat vs steep, out-and-back vs descent.

### Calendar Heatmap
A GitHub-style year grid where each day with a hike is filled in orange. Shows consistency, patterns, streaks, and which months are most active. Grows more interesting over time.

---

## UI Polish

### Loading Skeletons
Show animated placeholder blocks while route data or the activity list is loading, instead of a blank page. Most useful on the activity detail page (map + elevation chart) and during Strava imports.

Uses `useNavigation` from React Router (already imported) and Tailwind's `animate-pulse`.

---

## Activity List

### Filter by Activity Type
Alongside search and sort, add a filter chip row (All / Hike / Walk / Run) to narrow the list by Strava activity type.
