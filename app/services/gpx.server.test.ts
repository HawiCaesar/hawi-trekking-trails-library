import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeGpxSourceId,
  GpxParseError,
  parseGpxFromString,
} from "./gpx.server";

const fixturePath = path.join(
  process.cwd(),
  "gpx-fixtures/workout-2026-10-26_08-54-Walking-sigiria___started_late_though.gpx"
);

const loadFixture = () => readFileSync(fixturePath, "utf8");

describe("FitoTrack GPX fixture", () => {
  it("extracts metadata, type, streams, metrics, and deterministic sourceId", () => {
    const raw = loadFixture();
    const parsed = parseGpxFromString(
      raw,
      "workout-2026-10-26_08-54-Walking-sigiria___started_late_though.gpx"
    );

    expect(parsed.name).toBe("sigiria - started late though");
    expect(parsed.type).toBe("walking");
    expect(parsed.validPointCount).toBe(322);
    expect(parsed.gpsData.latlng.data).toHaveLength(322);
    expect(parsed.gpsData.altitude.data).toHaveLength(322);
    expect(parsed.gpsData.time?.data).toHaveLength(322);
    expect(parsed.gpsData.speed?.data).toHaveLength(322);

    const first = parsed.gpsData.latlng.data[0];
    expect(first[0]).toBeCloseTo(-1.2419630633667111, 5);
    expect(first[1]).toBeCloseTo(36.807933105155826, 5);
    expect(parsed.gpsData.altitude.data[0]).toBeCloseTo(1690.4381212242859, 2);

    expect(parsed.distance).toBeGreaterThan(500);
    expect(parsed.elapsedTime).toBeGreaterThan(60);
    expect(parsed.movingTime).toBeGreaterThan(0);
    expect(parsed.movingTime).toBeLessThanOrEqual(parsed.elapsedTime);
    expect(parsed.totalElevGain).toBeGreaterThan(0);
    expect(parsed.startDate.toISOString()).toBe("2026-10-26T05:54:55.350Z");

    const reparsed = parseGpxFromString(raw, "renamed-export.gpx");
    expect(reparsed.sourceId).toBe(parsed.sourceId);
    expect(reparsed.sourceId).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("GPX validation edge cases", () => {
  it("skips isolated invalid points but keeps a usable route", () => {
    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Partial</name><trkseg>
    <trkpt lat="0" lon="0"><ele>100</ele><time>2026-01-01T00:00:00Z</time></trkpt>
    <trkpt lat="bad" lon="0"><ele>100</ele><time>2026-01-01T00:01:00Z</time></trkpt>
    <trkpt lat="0" lon="0.001"><ele>101</ele><time>2026-01-01T00:02:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;
    const parsed = parseGpxFromString(xml, "partial.gpx");
    expect(parsed.validPointCount).toBe(2);
  });

  it("rejects tracks with fewer than two valid points", () => {
    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="bad" lon="0"><ele>1</ele><time>2026-01-01T00:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;
    expect(() => parseGpxFromString(xml)).toThrow(GpxParseError);
  });

  it("sums distance per segment without bridging gaps", () => {
    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="0" lon="0"><ele>100</ele><time>2026-01-01T00:00:00Z</time></trkpt>
    <trkpt lat="0" lon="0.001"><ele>100</ele><time>2026-01-01T00:01:00Z</time></trkpt>
  </trkseg>
  <trkseg>
    <trkpt lat="1" lon="1"><ele>200</ele><time>2026-01-01T01:00:00Z</time></trkpt>
    <trkpt lat="1" lon="1.001"><ele>200</ele><time>2026-01-01T01:01:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;
    const parsed = parseGpxFromString(xml);
    const singleSeg = parseGpxFromString(`<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="0" lon="0"><ele>100</ele><time>2026-01-01T00:00:00Z</time></trkpt>
    <trkpt lat="0" lon="0.001"><ele>100</ele><time>2026-01-01T00:01:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`);
    expect(parsed.distance).toBeCloseTo(singleSeg.distance * 2, -1);
    expect(parsed.gpsData.latlng.data).toHaveLength(4);
  });

  it("rejects DOCTYPE payloads", () => {
    expect(() =>
      parseGpxFromString('<!DOCTYPE gpx [<!ENTITY x "y">]><gpx></gpx>')
    ).toThrow(GpxParseError);
  });

  it("hashes route geometry, not filename", () => {
    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="0" lon="0"><ele>10</ele><time>2026-01-01T00:00:00Z</time></trkpt>
    <trkpt lat="0" lon="0.001"><ele>11</ele><time>2026-01-01T00:01:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;
    const a = parseGpxFromString(xml, "a.gpx");
    const b = parseGpxFromString(xml.replace(/\s+/g, " "), "b.gpx");
    expect(a.sourceId).toBe(b.sourceId);
  });
});

describe("computeGpxSourceId", () => {
  it("is stable for identical canonical points", () => {
    const points = [
      {
        lat: 1,
        lon: 2,
        ele: 3,
        time: new Date("2026-01-01T00:00:00.000Z"),
        speedMps: null,
      },
      {
        lat: 1.000001,
        lon: 2.000001,
        ele: 3.5,
        time: new Date("2026-01-01T00:01:00.000Z"),
        speedMps: 1,
      },
    ];
    expect(computeGpxSourceId(points)).toBe(computeGpxSourceId(points));
  });
});
