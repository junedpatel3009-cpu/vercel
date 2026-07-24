export function formatApproximateLocation(
  location: string | null | undefined,
  fallback = "Location not added",
) {
  const rawLocation = location?.trim();

  if (!rawLocation) {
    return fallback;
  }

  const parts = rawLocation
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return parts.slice(-3).join(", ");
  }

  if (parts.length >= 2) {
    return parts.join(", ");
  }

  return rawLocation.replace(
    /^\s*(?:house|flat|apt|apartment|unit|door|plot|no\.?)?\s*#?\d+[A-Za-z/-]*\s+/i,
    "",
  );
}

export function formatApproximateCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined,
) {
  if (lat == null || lng == null) {
    return "";
  }

  return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
}
