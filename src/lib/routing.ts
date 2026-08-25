import { db } from "@/lib/db";

// Free, key-less services: Nominatim (geocoding) + OSRM (driving routes).
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org";
const UA = { "User-Agent": "MellanPracticeManager/1.0 (route planner)" };

export type Coord = { lat: number; lng: number };

export function normaliseAddress(a: string): string {
  return a.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Geocode an address, using the DB cache first. Returns null when not found. */
export async function geocodeAddress(address: string): Promise<Coord | null> {
  const key = normaliseAddress(address);
  if (!key) return null;
  const cached = await db.geocodeCache.findUnique({ where: { address: key } });
  if (cached) return { lat: cached.lat, lng: cached.lng };

  const q = /australia/i.test(key) ? key : `${key}, Australia`;
  try {
    const res = await fetch(`${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=1`, {
      headers: UA,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (!data.length) return null;
    const coord = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    await db.geocodeCache.create({ data: { address: key, ...coord } }).catch(() => {});
    return coord;
  } catch {
    return null;
  }
}

export type RouteLeg = { distanceKm: number; durationMin: number };
export type RouteResult = {
  legs: RouteLeg[]; // legs[i] = travel from stop i → stop i+1
  totalDistanceKm: number;
  totalDurationMin: number;
  geometry: [number, number][]; // [lat, lng] polyline points
};

/** Driving route through the given waypoints in order. */
export async function routeThrough(points: Coord[]): Promise<RouteResult | null> {
  if (points.length < 2) return { legs: [], totalDistanceKm: 0, totalDurationMin: 0, geometry: [] };
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  try {
    const res = await fetch(`${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson`, {
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    const r = data.routes?.[0];
    if (!r) return null;
    return {
      legs: r.legs.map((l: any) => ({ distanceKm: l.distance / 1000, durationMin: l.duration / 60 })),
      totalDistanceKm: r.distance / 1000,
      totalDurationMin: r.duration / 60,
      geometry: r.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
    };
  } catch {
    return null;
  }
}

/** Order of waypoints minimising total travel (OSRM trip solver; round=false keeps the given start fixed). */
export async function optimiseOrder(points: Coord[]): Promise<number[] | null> {
  if (points.length < 3) return points.map((_, i) => i);
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  try {
    const res = await fetch(`${OSRM}/trip/v1/driving/${coords}?source=first&roundtrip=false`, {
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (!data.waypoints) return null;
    const order = new Array<number>(points.length);
    data.waypoints.forEach((w: any, originalIdx: number) => {
      order[w.waypoint_index] = originalIdx;
    });
    return order;
  } catch {
    return null;
  }
}

export function fmtKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function fmtMins(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** "09:00" + minutes → "10:25" */
export function addMinutesToTime(t: string, mins: number): string {
  const [h, m] = t.split(":").map(Number);
  const total = (((h * 60 + m + Math.round(mins)) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Anticipated-traffic multiplier for a leg departing at the given local time.
 * OSRM times are free-flow; peak hours (07:00–09:29, 15:30–18:29) get a
 * heavier loading, everything else a light buffer.
 */
export function trafficMultiplier(departTime: string): number {
  const [h, m] = departTime.split(":").map(Number);
  const mins = h * 60 + m;
  const peak = (mins >= 420 && mins < 570) || (mins >= 930 && mins < 1110);
  return peak ? 1.3 : 1.1;
}
