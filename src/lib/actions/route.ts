"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
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

export type ProposedTime = { id: number; startTime: string; endTime: string };

/** Persist traffic-adjusted times proposed by the route planner to the inspections. */
export async function applyRouteTimes(items: ProposedTime[]) {
  const inspections = await db.siteInspection.findMany({
    where: { id: { in: items.map((i) => i.id) } },
    select: { id: true, jobId: true, siteAddress: true, startTime: true, endTime: true },
  });
  const byId = new Map(inspections.map((i) => [i.id, i]));
  for (const it of items) {
    const cur = byId.get(it.id);
    if (!cur || (cur.startTime === it.startTime && cur.endTime === it.endTime)) continue;
    await db.siteInspection.update({
      where: { id: it.id },
      data: { startTime: it.startTime, endTime: it.endTime },
    });
    await logActivity(
      `Inspection at ${cur.siteAddress || "site"} retimed by route planner: ${cur.startTime}–${cur.endTime} → ${it.startTime}–${it.endTime}`,
      cur.jobId ? { jobId: cur.jobId } : {},
    );
  }
  revalidatePath("/inspections");
  revalidatePath("/inspections/route");
  revalidatePath("/calendar");
}
