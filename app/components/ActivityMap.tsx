import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { CircleMarker, Map } from "leaflet";

interface Props {
  coords: [number, number][];
}

export interface ActivityMapHandle {
  setHoverCoord: (coord: [number, number] | null) => void;
}

const ActivityMap = forwardRef<ActivityMapHandle, Props>(function ActivityMap({ coords }, ref) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const hoverMarkerRef = useRef<CircleMarker | null>(null);

  useImperativeHandle(ref, () => ({
    setHoverCoord(coord) {
      const map = mapInstanceRef.current;
      if (!map) return;

      if (coord) {
        if (hoverMarkerRef.current) {
          hoverMarkerRef.current.setLatLng(coord);
        } else {
          hoverMarkerRef.current = L.circleMarker(coord, {
            radius: 7,
            color: "#fff",
            fillColor: "#f97316",
            fillOpacity: 1,
            weight: 2,
          }).addTo(map);
        }
      } else {
        if (hoverMarkerRef.current) {
          hoverMarkerRef.current.remove();
          hoverMarkerRef.current = null;
        }
      }
    },
  }));

  useEffect(() => {
    if (!mapRef.current || coords.length === 0) return;

    const map = L.map(mapRef.current).setView(coords[0], 13);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    const polyline = L.polyline(coords, { color: "#f97316", weight: 3 }).addTo(map);
    map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

    L.circleMarker(coords[0], { radius: 6, color: "#16a34a", fillColor: "#16a34a", fillOpacity: 1 }).addTo(map);
    L.circleMarker(coords[coords.length - 1], { radius: 6, color: "#dc2626", fillColor: "#dc2626", fillOpacity: 1 }).addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      hoverMarkerRef.current = null;
    };
  }, [coords]);

  return <div ref={mapRef} style={{ height: "400px", width: "100%" }} className="rounded-lg z-0" />;
});

export default ActivityMap;
