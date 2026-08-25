"use server";

import { geocodeAddress, routeThrough, optimiseOrder, Coord, RouteResult } from "@/lib/routing";

export type StopInput = { id: number; address: string };

export type GeocodedStop = { id: number; coord: Coord };

/** Geocode all stops; returns coords keyed by inspection id (stops that fail are omitted). */
export async function geocodeStops(stops: StopInput[]): Promise<GeocodedStop[]> {
  const out: GeocodedStop[] = [];
  // Sequential: Nominatim's usage policy allows ~1 req/s; cache makes repeats free.
  for (const s of stops) {
    const coord = await geocodeAddress(s.address);
    if (coord) out.push({ id: s.id, coord });
  }
  return out;
}

export async function computeRoute(stops: (StopInput & { coord: Coord })[]): Promise<RouteResult | null> {
  return routeThrough(stops.map((s) => s.coord));
}

/** Returns the stop ids in travel-optimised order (first stop stays fixed as the day's start). */
export async function optimiseStopOrder(stops: (StopInput & { coord: Coord })[]): Promise<number[] | null> {
  const order = await optimiseOrder(stops.map((s) => s.coord));
  return order ? order.map((i) => stops[i].id) : null;
}
