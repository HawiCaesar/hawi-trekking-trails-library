import { useEffect, useRef } from "react";

interface Props {
  coords: [number, number][];
}

export default function ActivityMap({ coords }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current || coords.length === 0) return;

    // Dynamically import Leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      import("leaflet/dist/leaflet.css");

      const map = L.map(mapRef.current!).setView(coords[0], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      const polyline = L.polyline(coords, { color: "#f97316", weight: 3 }).addTo(map);
      map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

      // Start and end markers
      L.circleMarker(coords[0], { radius: 6, color: "#16a34a", fillColor: "#16a34a", fillOpacity: 1 }).addTo(map);
      L.circleMarker(coords[coords.length - 1], { radius: 6, color: "#dc2626", fillColor: "#dc2626", fillOpacity: 1 }).addTo(map);

      return () => {
        map.remove();
      };
    });
  }, [coords]);

  return <div ref={mapRef} style={{ height: "400px", width: "100%" }} className="rounded-lg z-0" />;
}
