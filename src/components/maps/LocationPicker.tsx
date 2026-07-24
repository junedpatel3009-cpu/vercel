import React, { useEffect, useRef, useState } from "react";
import SearchLocation from "./SearchLocation";

type LocationData = {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
};

export default function LocationPicker({
  initial, 
  onChange,
}: {
  initial?: { lat: number; lng: number };
  onChange: (data: LocationData) => void;
}) {
  const mapRef = useRef<any | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<any | null>(null);
  const leafletRef = useRef<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!containerRef.current) return;

    (async () => {
      try {
        const leafletModule = await import("leaflet");
        await import("leaflet/dist/leaflet.css");
        const L = (leafletModule && (leafletModule.default ?? leafletModule)) as any;
        if (!mounted) return;
        leafletRef.current = L;
        mapRef.current = L.map(containerRef.current, { center: [21.1702, 72.8311], zoom: 5 });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(mapRef.current);

        mapRef.current.on("click", async (e: any) => {
          const { lat, lng } = e.latlng;
          placeMarker(lat, lng);
          await reverseGeocode(lat, lng);
        });

        if (initial) {
          mapRef.current.setView([initial.lat, initial.lng], 13);
          placeMarker(initial.lat, initial.lng, true);
          reverseGeocode(initial.lat, initial.lng);
        }
      } catch (err) {
        // Fail silently — map will not initialize in SSR or if leaflet isn't available.
        // Caller should still be able to use search to pick locations.
      }
    })();

    return () => {
      mounted = false;
      try {
        mapRef.current && mapRef.current.remove();
      } catch {}
    };
  }, []);

  function placeMarker(lat: number, lng: number, center = true) {
    if (!mapRef.current) return;
    const L = leafletRef.current;
    if (!L) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
      markerRef.current.on("dragend", async (ev: any) => {
        const p = ev.target.getLatLng();
        await reverseGeocode(p.lat, p.lng);
      });
    }

    if (center) {
      mapRef.current.setView([lat, lng], 13, { animate: true });
    }
  }

  async function reverseGeocode(lat: number, lon: number) {
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`,
      );
      const data = await res.json();
      const addr = data?.display_name ?? "";
      const address = data?.address || {};
      const payload: LocationData = {
        latitude: lat,
        longitude: lon,
        address: addr,
        city: address.city || address.town || address.village || null,
        state: address.state || null,
        country: address.country || null,
        postalCode: address.postcode || null,
      };
      onChange(payload);
    } catch (e) {
      onChange({ latitude: lat, longitude: lon, address: null });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <SearchLocation
        onSelect={(item) => {
          const lat = Number(item.lat);
          const lon = Number(item.lon);
          placeMarker(lat, lon);
          reverseGeocode(lat, lon);
        }}
      />

      <div ref={containerRef} className="w-full h-64 rounded-md border" />
      {loading ? <div className="text-sm text-muted-foreground">Resolving address...</div> : null}
    </div>
  );
}
