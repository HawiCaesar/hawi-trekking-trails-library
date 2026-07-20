import "leaflet/dist/leaflet.css";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { ActivityMapHandle } from "~/components/ActivityMap.types";

interface Props {
  coords: [number, number][];
}

type LeafletModule = typeof import("leaflet");
type LeafletMap = ReturnType<LeafletModule["map"]>;
type LeafletCircleMarker = ReturnType<LeafletModule["circleMarker"]>;

const ActivityMap = forwardRef<ActivityMapHandle, Props>(function ActivityMap({ coords }, ref) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const hoverMarkerRef = useRef<LeafletCircleMarker | null>(null);
  const leafletModuleRef = useRef<LeafletModule | null>(null);

  useImperativeHandle(ref, () => ({
    setHoverCoord(coord) {
      const map = mapInstanceRef.current;
      const leafletModule = leafletModuleRef.current;
      if (!map || !leafletModule) return;

      if (coord) {
        if (hoverMarkerRef.current) {
          hoverMarkerRef.current.setLatLng(coord);
        } else {
          hoverMarkerRef.current = leafletModule.circleMarker(coord, {
            radius: 7,
            color: "#fff",
            fillColor: "#f97316",
            fillOpacity: 1,
            weight: 2,
          }).addTo(map);
        }
      } else if (hoverMarkerRef.current) {
        hoverMarkerRef.current.remove();
        hoverMarkerRef.current = null;
      }
    },
  }));

  useEffect(() => {
    if (!mapRef.current || coords.length === 0) return;

    let cancelled = false;
    let map: LeafletMap | null = null;

    const initializeMap = async () => {
      const leafletModule = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      leafletModuleRef.current = leafletModule;
      const { default: L } = leafletModule;

      map = L.map(mapRef.current).setView(coords[0], 13);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      const polyline = L.polyline(coords, { color: "#f97316", weight: 3 }).addTo(map);
      map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

      L.circleMarker(coords[0], { radius: 6, color: "#16a34a", fillColor: "#16a34a", fillOpacity: 1 }).addTo(map);
      L.circleMarker(coords[coords.length - 1], { radius: 6, color: "#dc2626", fillColor: "#dc2626", fillOpacity: 1 }).addTo(map);
    };

    void initializeMap();

    return () => {
      cancelled = true;
      map?.remove();
      mapInstanceRef.current = null;
      hoverMarkerRef.current = null;
      leafletModuleRef.current = null;
    };
  }, [coords]);

  return <div ref={mapRef} style={{ height: "400px", width: "100%" }} className="rounded-lg z-0" />;
});

export default ActivityMap;
