"use client";

import mapboxgl, { type GeoJSONSource, type Map } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, LineString, Point } from "geojson";

interface Props {
  coords: [number, number][];
}

type CameraMode = "follow" | "overview";
type Coordinate = [number, number];

interface RoutePosition {
  coordinate: Coordinate;
  completedCoordinates: Coordinate[];
  endIndex: number;
}

interface CompletedRouteCache {
  endIndex: number;
  coordinates: Coordinate[];
}

interface PlaybackMapState {
  smoothedBearingRef: { current: number | null };
  smoothedCenterRef: { current: Coordinate | null };
  completedRouteCacheRef: { current: CompletedRouteCache | null };
  lastCompletedRouteEndIndexRef: { current: number | null };
  lastCompletedRouteUpdateTimeRef: { current: number };
}

const PLAYBACK_DURATION_MS = 45_000;
const CAMERA_LOOK_AHEAD_METERS = 50;
const BEARING_SMOOTHING_FACTOR = 0.08;
const CENTER_SMOOTHING_FACTOR = 0.15;
const PLAYBACK_UI_MIN_INTERVAL_MS = 66;
const PLAYBACK_UI_PROGRESS_THRESHOLD = 0.002;
const COMPLETED_ROUTE_UPDATE_INTERVAL_MS = 100;

const createLineFeature = (coordinates: Coordinate[]): Feature<LineString> => ({
  type: "Feature",
  properties: {},
  geometry: { type: "LineString", coordinates },
});

const createPointFeature = (coordinate: Coordinate): Feature<Point> => ({
  type: "Feature",
  properties: {},
  geometry: { type: "Point", coordinates: coordinate },
});

const getDistanceInMeters = ([longitudeA, latitudeA]: Coordinate, [longitudeB, latitudeB]: Coordinate) => {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const getBearing = ([longitudeA, latitudeA]: Coordinate, [longitudeB, latitudeB]: Coordinate) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const toDegrees = (radians: number) => (radians * 180) / Math.PI;
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const latitudeARadians = toRadians(latitudeA);
  const latitudeBRadians = toRadians(latitudeB);
  const y = Math.sin(longitudeDelta) * Math.cos(latitudeBRadians);
  const x =
    Math.cos(latitudeARadians) * Math.sin(latitudeBRadians) -
    Math.sin(latitudeARadians) * Math.cos(latitudeBRadians) * Math.cos(longitudeDelta);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

const interpolateCoordinate = (start: Coordinate, end: Coordinate, progress: number): Coordinate => [
  start[0] + (end[0] - start[0]) * progress,
  start[1] + (end[1] - start[1]) * progress,
];

const getProgressWithDistanceOffset = (progress: number, totalDistance: number, offsetMeters: number) => (
  totalDistance === 0 ? progress : Math.min(1, progress + offsetMeters / totalDistance)
);

const getRoutePosition = (
  routeCoordinates: Coordinate[],
  cumulativeDistances: number[],
  totalDistance: number,
  progress: number,
): RoutePosition | null => {
  if (routeCoordinates.length === 0) return null;
  if (routeCoordinates.length === 1 || totalDistance === 0) {
    return {
      coordinate: routeCoordinates[0],
      completedCoordinates: [routeCoordinates[0]],
      endIndex: 0,
    };
  }

  const targetDistance = totalDistance * progress;
  const segmentIndex = cumulativeDistances.findIndex((distance) => distance >= targetDistance);
  const endIndex = segmentIndex === -1 ? routeCoordinates.length - 1 : segmentIndex;
  const startIndex = Math.max(0, endIndex - 1);
  const segmentStartDistance = cumulativeDistances[startIndex];
  const segmentDistance = cumulativeDistances[endIndex] - segmentStartDistance;
  const segmentProgress = segmentDistance === 0 ? 0 : (targetDistance - segmentStartDistance) / segmentDistance;
  const coordinate = interpolateCoordinate(routeCoordinates[startIndex], routeCoordinates[endIndex], segmentProgress);

  return {
    coordinate,
    completedCoordinates: [...routeCoordinates.slice(0, endIndex), coordinate],
    endIndex,
  };
};

const getCompletedRouteCoordinates = (
  routeCoordinates: Coordinate[],
  endIndex: number,
  coordinate: Coordinate,
  completedRouteCacheRef: { current: CompletedRouteCache | null },
  forceRebuild: boolean,
): Coordinate[] => {
  if (forceRebuild || !completedRouteCacheRef.current || endIndex < completedRouteCacheRef.current.endIndex) {
    const coordinates = [...routeCoordinates.slice(0, endIndex), coordinate];
    completedRouteCacheRef.current = { endIndex, coordinates };
    return coordinates;
  }

  const cache = completedRouteCacheRef.current;

  if (endIndex > cache.endIndex) {
    cache.coordinates.pop();
    for (let index = cache.endIndex; index < endIndex; index += 1) {
      cache.coordinates.push(routeCoordinates[index]);
    }
    cache.endIndex = endIndex;
  }

  if (cache.coordinates.length === 0) {
    cache.coordinates.push(coordinate);
  } else {
    cache.coordinates[cache.coordinates.length - 1] = coordinate;
  }

  return cache.coordinates;
};

const getSmoothedBearing = (currentBearing: number | null, targetBearing: number) => {
  if (currentBearing === null) return targetBearing;

  const shortestAngle = ((targetBearing - currentBearing + 540) % 360) - 180;
  return (currentBearing + shortestAngle * BEARING_SMOOTHING_FACTOR + 360) % 360;
};

const getSmoothedCoordinate = (current: Coordinate | null, target: Coordinate): Coordinate => {
  if (!current) return target;

  return [
    current[0] + (target[0] - current[0]) * CENTER_SMOOTHING_FACTOR,
    current[1] + (target[1] - current[1]) * CENTER_SMOOTHING_FACTOR,
  ];
};

const resetPlaybackMapState = (playbackMapState: PlaybackMapState) => {
  playbackMapState.smoothedBearingRef.current = null;
  playbackMapState.smoothedCenterRef.current = null;
  playbackMapState.completedRouteCacheRef.current = null;
  playbackMapState.lastCompletedRouteEndIndexRef.current = null;
  playbackMapState.lastCompletedRouteUpdateTimeRef.current = 0;
};

const fitMapToRoute = (map: Map, routeCoordinates: Coordinate[]) => {
  const bounds = new mapboxgl.LngLatBounds(routeCoordinates[0], routeCoordinates[0]);
  routeCoordinates.forEach((coordinate) => bounds.extend(coordinate));
  map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
};

const applyPlaybackToMap = (
  map: Map,
  routeCoordinates: Coordinate[],
  cumulativeDistances: number[],
  totalDistance: number,
  progress: number,
  cameraMode: CameraMode,
  playbackMapState: PlaybackMapState,
  options: {
    smoothFollowCamera: boolean;
    forceRebuildCompletedRoute: boolean;
    frameTime?: number;
  },
) => {
  const routePosition = getRoutePosition(routeCoordinates, cumulativeDistances, totalDistance, progress);
  if (!routePosition) return;

  const lookAheadProgress = getProgressWithDistanceOffset(
    progress,
    totalDistance,
    CAMERA_LOOK_AHEAD_METERS,
  );
  const lookAheadRoutePosition = getRoutePosition(
    routeCoordinates,
    cumulativeDistances,
    totalDistance,
    lookAheadProgress,
  );

  const completedRouteSource = map.getSource("completed-route") as GeoJSONSource | undefined;
  const hikerSource = map.getSource("hiker") as GeoJSONSource | undefined;
  if (!completedRouteSource || !hikerSource) return;

  const completedCoordinates = getCompletedRouteCoordinates(
    routeCoordinates,
    routePosition.endIndex,
    routePosition.coordinate,
    playbackMapState.completedRouteCacheRef,
    options.forceRebuildCompletedRoute,
  );

  const frameTime = options.frameTime ?? performance.now();
  const endIndexChanged = playbackMapState.lastCompletedRouteEndIndexRef.current !== routePosition.endIndex;
  const completedRouteIntervalElapsed =
    frameTime - playbackMapState.lastCompletedRouteUpdateTimeRef.current >= COMPLETED_ROUTE_UPDATE_INTERVAL_MS;
  const shouldUpdateCompletedRoute =
    options.forceRebuildCompletedRoute || endIndexChanged || completedRouteIntervalElapsed;

  if (shouldUpdateCompletedRoute) {
    completedRouteSource.setData(createLineFeature(completedCoordinates));
    playbackMapState.lastCompletedRouteEndIndexRef.current = routePosition.endIndex;
    playbackMapState.lastCompletedRouteUpdateTimeRef.current = frameTime;
  }

  hikerSource.setData(createPointFeature(routePosition.coordinate));

  if (cameraMode === "overview") {
    playbackMapState.smoothedBearingRef.current = null;
    playbackMapState.smoothedCenterRef.current = null;
    return;
  }

  if (!lookAheadRoutePosition) return;

  const targetBearing = getBearing(routePosition.coordinate, lookAheadRoutePosition.coordinate);
  const nextBearing = getSmoothedBearing(playbackMapState.smoothedBearingRef.current, targetBearing);
  playbackMapState.smoothedBearingRef.current = nextBearing;

  const cameraCenter = options.smoothFollowCamera
    ? getSmoothedCoordinate(playbackMapState.smoothedCenterRef.current, routePosition.coordinate)
    : routePosition.coordinate;

  playbackMapState.smoothedCenterRef.current = cameraCenter;

  map.jumpTo({
    center: cameraCenter,
    bearing: nextBearing,
    zoom: 15,
    pitch: 68,
  });
};

export default function ActivityFlyoverMap({ coords }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const playbackProgressRef = useRef(0);
  const smoothedBearingRef = useRef<number | null>(null);
  const smoothedCenterRef = useRef<Coordinate | null>(null);
  const completedRouteCacheRef = useRef<CompletedRouteCache | null>(null);
  const lastCompletedRouteEndIndexRef = useRef<number | null>(null);
  const lastCompletedRouteUpdateTimeRef = useRef(0);

  const playbackMapState = useMemo<PlaybackMapState>(
    () => ({
      smoothedBearingRef,
      smoothedCenterRef,
      completedRouteCacheRef,
      lastCompletedRouteEndIndexRef,
      lastCompletedRouteUpdateTimeRef,
    }),
    [],
  );
  const [isMapReady, setIsMapReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [cameraMode, setCameraMode] = useState<CameraMode>("follow");
  const [mapError, setMapError] = useState<string | null>(null);

  const routeCoordinates = useMemo<Coordinate[]>(
    () => coords
      .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude))
      .map(([latitude, longitude]) => [longitude, latitude]),
    [coords],
  );

  const cumulativeDistances = useMemo(() => {
    const distances = [0];

    for (let index = 1; index < routeCoordinates.length; index += 1) {
      const previous = routeCoordinates[index - 1];
      const current = routeCoordinates[index];
      distances.push(distances[index - 1] + getDistanceInMeters(previous, current));
    }

    return distances;
  }, [routeCoordinates]);

  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1] ?? 0;

  useEffect(() => {
    resetPlaybackMapState(playbackMapState);
  }, [playbackMapState, routeCoordinates]);

  useEffect(() => {
    playbackProgressRef.current = playbackProgress;
  }, [playbackProgress]);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (!token) {
      setMapError("Mapbox is not configured. Add VITE_MAPBOX_ACCESS_TOKEN to your environment.");
      return;
    }
    if (!mapContainerRef.current || routeCoordinates.length === 0) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: routeCoordinates[0],
      zoom: 13,
      pitch: 60,
      bearing: 0,
      attributionControl: true,
    });
    mapRef.current = map;

    const handleMapError = () => {
      setMapError("Mapbox could not load. Check the access token and its allowed URL restrictions.");
    };

    map.on("error", handleMapError);
    map.on("style.load", () => {
      map.addSource("terrain", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: "terrain", exaggeration: 1.2 });
      map.addSource("route", { type: "geojson", data: createLineFeature(routeCoordinates) });
      map.addSource("completed-route", { type: "geojson", data: createLineFeature([routeCoordinates[0]]) });
      map.addSource("hiker", { type: "geojson", data: createPointFeature(routeCoordinates[0]) });
      map.addSource("start", { type: "geojson", data: createPointFeature(routeCoordinates[0]) });
      map.addSource("end", { type: "geojson", data: createPointFeature(routeCoordinates[routeCoordinates.length - 1]) });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#334155", "line-width": 4, "line-opacity": 0.7 },
      });
      map.addLayer({
        id: "completed-route",
        type: "line",
        source: "completed-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#f97316", "line-width": 5, "line-opacity": 1 },
      });
      map.addLayer({
        id: "hiker",
        type: "circle",
        source: "hiker",
        paint: {
          "circle-radius": 7,
          "circle-color": "#f97316",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "start",
        type: "circle",
        source: "start",
        paint: {
          "circle-radius": 5,
          "circle-color": "#16a34a",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "end",
        type: "circle",
        source: "end",
        paint: {
          "circle-radius": 5,
          "circle-color": "#dc2626",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      fitMapToRoute(map, routeCoordinates);
      setIsMapReady(true);
    });

    return () => {
      map.off("error", handleMapError);
      map.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, [routeCoordinates]);

  useEffect(() => {
    if (isPlaying) return;

    const map = mapRef.current;
    if (!map || !isMapReady) return;

    applyPlaybackToMap(
      map,
      routeCoordinates,
      cumulativeDistances,
      totalDistance,
      playbackProgress,
      cameraMode,
      playbackMapState,
      { smoothFollowCamera: false, forceRebuildCompletedRoute: true },
    );
  }, [
    cameraMode,
    cumulativeDistances,
    isMapReady,
    isPlaying,
    playbackProgress,
    routeCoordinates,
    totalDistance,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || cameraMode !== "overview") return;

    fitMapToRoute(map, routeCoordinates);
  }, [cameraMode, isMapReady, routeCoordinates]);

  useEffect(() => {
    if (!isPlaying) return;

    let lastFrameTime = performance.now();
    let lastUiUpdateTime = 0;
    let lastUiProgress = playbackProgressRef.current;

    const animate = (frameTime: number) => {
      const elapsedSinceLastFrame = frameTime - lastFrameTime;
      lastFrameTime = frameTime;
      const progressIncrease = (elapsedSinceLastFrame * playbackSpeed) / PLAYBACK_DURATION_MS;
      const nextProgress = Math.min(1, playbackProgressRef.current + progressIncrease);

      playbackProgressRef.current = nextProgress;

      const map = mapRef.current;
      if (map && isMapReady) {
        applyPlaybackToMap(
          map,
          routeCoordinates,
          cumulativeDistances,
          totalDistance,
          nextProgress,
          cameraMode,
          playbackMapState,
          { smoothFollowCamera: cameraMode === "follow", forceRebuildCompletedRoute: false, frameTime },
        );
      }

      const reachedEnd = nextProgress >= 1;
      const shouldUpdateUi =
        reachedEnd
        || frameTime - lastUiUpdateTime >= PLAYBACK_UI_MIN_INTERVAL_MS
        || Math.abs(nextProgress - lastUiProgress) >= PLAYBACK_UI_PROGRESS_THRESHOLD;

      if (shouldUpdateUi) {
        lastUiUpdateTime = frameTime;
        lastUiProgress = nextProgress;
        setPlaybackProgress(nextProgress);
      }

      if (reachedEnd) {
        setIsPlaying(false);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [
    cameraMode,
    cumulativeDistances,
    isMapReady,
    isPlaying,
    playbackSpeed,
    playbackMapState,
    routeCoordinates,
    totalDistance,
  ]);

  const handleTogglePlayback = () => {
    if (playbackProgress >= 1) {
      playbackProgressRef.current = 0;
      setPlaybackProgress(0);
      resetPlaybackMapState(playbackMapState);
    }
    setIsPlaying((currentIsPlaying) => {
      if (currentIsPlaying) {
        setPlaybackProgress(playbackProgressRef.current);
      }
      return !currentIsPlaying;
    });
  };

  const handleRestart = () => {
    playbackProgressRef.current = 0;
    setPlaybackProgress(0);
    resetPlaybackMapState(playbackMapState);
    setIsPlaying(true);
  };

  const handleProgressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextProgress = Number(event.target.value) / 100;
    playbackProgressRef.current = nextProgress;
    setPlaybackProgress(nextProgress);
    resetPlaybackMapState(playbackMapState);
  };

  if (routeCoordinates.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-950 dark:border-gray-700">
      <div className="relative h-[480px]">
        <div ref={mapContainerRef} className="h-full w-full" />
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 p-6 text-center text-sm text-white">
            {mapError}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 bg-white p-4 dark:bg-gray-800 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTogglePlayback}
            className="rounded bg-orange-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            aria-label={isPlaying ? "Pause flyover" : "Play flyover"}
            disabled={!isMapReady}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={handleRestart}
            className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800"
            disabled={!isMapReady}
          >
            Restart
          </button>
        </div>

        <label className="flex min-w-0 flex-1 items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
          <span className="sr-only">Flyover progress</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(playbackProgress * 100)}
            onChange={handleProgressChange}
            className="w-full accent-orange-500"
            disabled={!isMapReady}
          />
          <span className="w-10 text-right tabular-nums">{Math.round(playbackProgress * 100)}%</span>
        </label>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="flyover-speed">Flyover speed</label>
          <select
            id="flyover-speed"
            value={playbackSpeed}
            onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
            className="rounded border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
          <button
            type="button"
            onClick={() => setCameraMode((currentMode) => currentMode === "follow" ? "overview" : "follow")}
            className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800"
            aria-pressed={cameraMode === "follow"}
          >
            {cameraMode === "follow" ? "Following route" : "Overview"}
          </button>
        </div>
      </div>
      <p className="bg-white px-4 pb-4 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        Playback is simulated from route distance; it does not represent the hike&apos;s actual pace or pauses.
      </p>
    </div>
  );
}
