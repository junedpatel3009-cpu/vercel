import React, { useEffect, useState } from "react";

type Suggestion = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: any;
};

export default function SearchLocation({
  onSelect,
  placeholder = "Search address, city, postal code...",
}: {
  onSelect: (item: Suggestion) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`,
        );
        const data = await res.json();
        setSuggestions(data || []);
      } catch (e) {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(id);
  }, [query]);

  return (
    <div className="relative">
      <input
        className="w-full rounded-md border px-3 py-2"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {suggestions.length ? (
        <div className="absolute left-0 right-0 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-white" style={{ zIndex: 9999 }}>
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              onClick={() => {
                onSelect(s);
                setQuery(s.display_name);
                setSuggestions([]);
              }}
              className="block w-full px-3 py-2 text-left hover:bg-slate-50"
            >
              {s.display_name}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? <div className="text-sm text-muted-foreground mt-1">Searching...</div> : null}
    </div>
  );
}
