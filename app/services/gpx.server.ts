import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";

export const ACTIVITY_SOURCE_FITOTRACK_GPX = "fitotrack-gpx";
export const ACTIVITY_SOURCE_STRAVA = "strava";

/** Intervals below this speed (m/s) are treated as stopped for moving time. ~1.8 km/h. */
export const MOVING_SPEED_THRESHOLD_MPS = 0.5;

/** Ignore elevation bumps smaller than this (m) when summing gain. */
export const ELEVATION_GAIN_NOISE_M = 3;

/** Maximum accepted GPX upload size in bytes (10 MiB). */
export const MAX_GPX_FILE_BYTES = 10 * 1024 * 1024;

export type GpxStreamShape = {
  latlng: { data: [number, number][] };
  altitude: { data: number[] };
  time?: { data: number[] };
  speed?: { data: number[] };
};

export type ParsedGpxActivity = {
  sourceId: string;
  name: string;
  type: string;
  startDate: Date;
  distance: number;
  movingTime: number;
  elapsedTime: number;
  totalElevGain: number;
  gpsData: GpxStreamShape;
  validPointCount: number;
};

export class GpxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GpxParseError";
  }
}

type ValidTrackPoint = {
  lat: number;
  lon: number;
  ele: number;
  time: Date;
  speedMps: number | null;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true,
  isArray: (name) => name === "trkpt" || name === "trkseg" || name === "trk",
});

const EARTH_RADIUS_M = 6_371_000;

const haversineMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
};

const parseNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
};

const parseLat = (value: unknown): number | null => {
  const n = parseNumber(value);
  if (n === null || n < -90 || n > 90) return null;
  return n;
};

const parseLon = (value: unknown): number | null => {
  const n = parseNumber(value);
  if (n === null || n < -180 || n > 180) return null;
  return n;
};

const parseEle = (value: unknown): number | null => {
  const n = parseNumber(value);
  if (n === null) return null;
  return n;
};

const parseTime = (value: unknown): Date | null => {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

const extractSpeedMps = (extensions: unknown): number | null => {
  if (!extensions || typeof extensions !== "object") return null;
  const ext = extensions as Record<string, unknown>;
  const speed = parseNumber(ext.speed);
  if (speed === null || speed < 0) return null;
  return speed;
};

const canonicalPointLine = (point: ValidTrackPoint): string => {
  return [
    point.lat.toFixed(6),
    point.lon.toFixed(6),
    point.ele.toFixed(2),
    point.time.toISOString(),
  ].join(",");
};

export const computeGpxSourceId = (points: ValidTrackPoint[]): string => {
  const payload = points.map(canonicalPointLine).join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex");
};

const sumSegmentDistance = (points: ValidTrackPoint[]): number => {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(
      points[i - 1].lat,
      points[i - 1].lon,
      points[i].lat,
      points[i].lon
    );
  }
  return total;
};

const sumElevationGain = (points: ValidTrackPoint[]): number => {
  let gain = 0;
  let baseline = points[0]?.ele ?? 0;
  for (let i = 1; i < points.length; i++) {
    const ele = points[i].ele;
    if (ele >= baseline + ELEVATION_GAIN_NOISE_M) {
      gain += ele - baseline;
      baseline = ele;
    } else if (ele < baseline) {
      baseline = ele;
    }
  }
  return gain;
};

const computeMovingTimeSeconds = (points: ValidTrackPoint[]): number => {
  let moving = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dt = (curr.time.getTime() - prev.time.getTime()) / 1000;
    if (dt <= 0) continue;

    const dist = haversineMeters(prev.lat, prev.lon, curr.lat, curr.lon);
    const inferredSpeed = dist / dt;
    const recordedSpeed = curr.speedMps ?? prev.speedMps;
    const speed =
      recordedSpeed !== null ? Math.max(recordedSpeed, inferredSpeed) : inferredSpeed;

    if (speed >= MOVING_SPEED_THRESHOLD_MPS) {
      moving += dt;
    }
  }
  return Math.round(moving);
};

const assertSafeGpxXml = (raw: string): void => {
  const trimmed = raw.trimStart();
  if (/<!DOCTYPE/i.test(raw) || /<!ENTITY/i.test(raw)) {
    throw new GpxParseError("GPX files with DTD or DOCTYPE declarations are not accepted.");
  }
  if (!trimmed.startsWith("<")) {
    throw new GpxParseError("Uploaded file is not valid GPX XML.");
  }
};

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

const pickName = (
  trackName: string | undefined,
  metadataName: string | undefined,
  filename: string
): string => {
  const fromTrack = trackName?.trim();
  if (fromTrack) return fromTrack;
  const fromMeta = metadataName?.trim();
  if (fromMeta) return fromMeta;
  const base = filename.replace(/\.gpx$/i, "").trim();
  return base || "Imported hike";
};

const pickType = (trackType: string | undefined): string => {
  const t = trackType?.trim();
  if (t) return t;
  return "Hike";
};

const parseTrackPointsFromSegment = (segment: unknown): ValidTrackPoint[] => {
  const seg = segment as { trkpt?: unknown };
  const rawPoints = asArray(seg.trkpt);
  const valid: ValidTrackPoint[] = [];

  for (const raw of rawPoints) {
    const pt = raw as Record<string, unknown>;
    const lat = parseLat(pt.lat);
    const lon = parseLon(pt.lon);
    const ele = parseEle(pt.ele);
    const time = parseTime(pt.time);
    if (lat === null || lon === null || ele === null || time === null) continue;

    valid.push({
      lat,
      lon,
      ele,
      time,
      speedMps: extractSpeedMps(pt.extensions),
    });
  }

  return valid;
};

export const parseGpxFromString = (
  raw: string,
  filename = "upload.gpx"
): ParsedGpxActivity => {
  assertSafeGpxXml(raw);

  let doc: unknown;
  try {
    doc = parser.parse(raw);
  } catch {
    throw new GpxParseError("Could not parse GPX XML.");
  }

  const root = doc as Record<string, unknown>;
  if (!root.gpx) {
    throw new GpxParseError("File is not a GPX document (missing <gpx> root).");
  }

  const gpx = root.gpx as Record<string, unknown>;
  const metadata = gpx.metadata as Record<string, unknown> | undefined;
  const metadataName =
    typeof metadata?.name === "string" ? metadata.name : undefined;
  const metadataTime = parseTime(metadata?.time);

  const tracks = asArray(gpx.trk as unknown);
  if (tracks.length === 0) {
    throw new GpxParseError("GPX file has no tracks.");
  }

  const track = tracks[0] as Record<string, unknown>;
  const trackName = typeof track.name === "string" ? track.name : undefined;
  const trackType = typeof track.type === "string" ? track.type : undefined;

  const segments = asArray(track.trkseg);
  if (segments.length === 0) {
    throw new GpxParseError("GPX track has no segments.");
  }

  const segmentPoints = segments.map(parseTrackPointsFromSegment);
  const allValid = segmentPoints.flat();

  if (allValid.length < 2) {
    throw new GpxParseError(
      "Not enough valid trackpoints to draw a route (need at least two)."
    );
  }

  const distance = segmentPoints.reduce(
    (sum, seg) => sum + sumSegmentDistance(seg),
    0
  );
  const totalElevGain = segmentPoints.reduce(
    (sum, seg) => sum + (seg.length >= 2 ? sumElevationGain(seg) : 0),
    0
  );

  const firstTime = allValid[0].time;
  const lastTime = allValid[allValid.length - 1].time;
  const elapsedTime = Math.max(
    0,
    Math.round((lastTime.getTime() - firstTime.getTime()) / 1000)
  );
  const movingTime = computeMovingTimeSeconds(allValid);

  const startDate = firstTime ?? metadataTime ?? new Date();

  const latlngData: [number, number][] = allValid.map((p) => [p.lat, p.lon]);
  const altitudeData = allValid.map((p) => p.ele);
  const timeData = allValid.map((p) => Math.round(p.time.getTime() / 1000));
  const speedData = allValid.map((p) => p.speedMps ?? 0);

  const gpsData: GpxStreamShape = {
    latlng: { data: latlngData },
    altitude: { data: altitudeData },
    time: { data: timeData },
    speed: { data: speedData },
  };

  return {
    sourceId: computeGpxSourceId(allValid),
    name: pickName(trackName, metadataName, filename),
    type: pickType(trackType),
    startDate,
    distance,
    movingTime,
    elapsedTime,
    totalElevGain,
    gpsData,
    validPointCount: allValid.length,
  };
};

export const parseGpxFromBuffer = (
  buffer: Buffer,
  filename = "upload.gpx"
): ParsedGpxActivity => {
  if (buffer.byteLength > MAX_GPX_FILE_BYTES) {
    throw new GpxParseError(
      `GPX file is too large (max ${MAX_GPX_FILE_BYTES / (1024 * 1024)} MiB).`
    );
  }
  const raw = buffer.toString("utf8");
  return parseGpxFromString(raw, filename);
};
