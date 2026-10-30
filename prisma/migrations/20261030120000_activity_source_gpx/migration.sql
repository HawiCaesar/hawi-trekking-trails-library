-- Preserve existing Strava imports under source = "strava", generalize identity for GPX uploads.

ALTER TABLE "Activity" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'strava';

DROP INDEX "Activity_stravaId_key";

ALTER TABLE "Activity" RENAME COLUMN "stravaId" TO "sourceId";

CREATE UNIQUE INDEX "Activity_source_sourceId_key" ON "Activity"("source", "sourceId");

DROP TABLE "Settings";
