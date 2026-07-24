import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function StaticMap({
  lat,
  lng,
  zoom = 13,
  className,
}: {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    mapRef.current = L.map(ref.current, { center: [lat, lng], zoom, dragging: false, zoomControl: false, doubleClickZoom: false, scrollWheelZoom: false, touchZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapRef.current);

    L.marker([lat, lng]).addTo(mapRef.current);

    return () => mapRef.current && mapRef.current.remove();
  }, [lat, lng, zoom]);

  return <div ref={ref} className={className ?? "w-full h-48 rounded-md"} />;
}
