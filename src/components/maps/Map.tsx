import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type MapProps = {
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  onMapReady?: (map: L.Map) => void;
};

export default function Map({ center = { lat: 21.1702, lng: 72.8311 }, zoom = 5, className, onMapReady }: MapProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Initialize map
    mapRef.current = L.map(ref.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
      wheelPxPerZoomLevel: 60,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapRef.current);

    if (onMapReady) onMapReady(mapRef.current);

    return () => {
      try {
        mapRef.current && mapRef.current.remove();
      } catch (e) {
        // ignore
      }
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView([center.lat, center.lng], zoom);
  }, [center.lat, center.lng, zoom]);

  return <div ref={ref} className={className ?? "w-full h-64 rounded-lg"} />;
}
