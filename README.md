# Trails Archive

A personal library of hikes I've done — connected to Strava, with GPS maps and trail notes.

## Screenshots

![Hike list](hike-list.png)
![Hike detail](hike-detail.png)

## What it does

- Pulls hiking activities from Strava and saves it to my own database.
- Shows each hike with distance, time, elevation gain, and a GPS route map
- Lets you add your own notes: difficulty, trail conditions, weather, gear, companions, and a rating

## Stack

- React Router v7 (full-stack, SSR)
- Prisma 7 + PostgreSQL
- Leaflet for GPS maps
- Tailwind CSS
- Deployed on Railway

## Running locally

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your values:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/trails
   SESSION_SECRET=your-secret
   STRAVA_CLIENT_ID=your-client-id
   STRAVA_CLIENT_SECRET=your-client-secret
   ```

3. Run the database migration:
   ```bash
   npx prisma migrate dev
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

## Strava setup

- Create an app at [strava.com/settings/api](https://www.strava.com/settings/api)
- Set the Authorization Callback Domain to `localhost` for local dev or your Railway domain for production
- Copy the Client ID and Client Secret into your `.env`
