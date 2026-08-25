"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { geocodeStops, computeRoute, optimiseStopOrder, applyRouteTimes } from "@/lib/actions/route";
import { fmtKm, fmtMins, addMinutesToTime, trafficMultiplier } from "@/lib/routing";
import type { Coord, RouteResult } from "@/lib/routing";

// Leaflet needs the window object — load the map client-side only.
const RouteMap = dynamic(() => import("@/components/RouteMap"), { ssr: false });

export type RouteStop = {
  id: number;
  jobNumber: string;
  address: string;
  clientName: string;
  typeName: string;
  startTime: string;
  endTime: string;
  status: string;
  color: string;
};

type StopState = RouteStop & { coord: Coord | null };

function stopDurationMin(s: RouteStop): number {
  const [h1, m1] = s.startTime.split(":").map(Number);
  const [h2, m2] = s.endTime.split(":").map(Number);
  const d = h2 * 60 + m2 - (h1 * 60 + m1);
  return d > 0 ? d : 60;
}

export default function RoutePlanner({ stops: initial, officeAddress }: { date: string; stops: RouteStop[]; officeAddress: string }) {
  const router = useRouter();
  const [stops, setStops] = useState<StopState[]>(initial.map((s) => ({ ...s, coord: null })));
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [geoErrors, setGeoErrors] = useState<string[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const geocodedRef = useRef(false);

  // Geocode every stop once on mount (cached server-side).
  useEffect(() => {
    if (geocodedRef.current || initial.length === 0) return;
    geocodedRef.current = true;
    setLoading(true);
    startTransition(async () => {
      const found = await geocodeStops(initial.map((s) => ({ id: s.id, address: s.address })));
      const byId = new Map(found.map((f) => [f.id, f.coord]));
      setStops(initial.map((s) => ({ ...s, coord: byId.get(s.id) ?? null })));
      setGeoErrors(initial.filter((s) => !byId.has(s.id)).map((s) => s.address || `(no address — inspection #${s.id})`));
      setLoading(false);
    });
  }, [initial]);

  // Merge refreshed server data (e.g. after Apply) into the current order without
  // clobbering coords or the user's drag arrangement; geocode any newly added stops.
  const initialRef = useRef(initial);
  useEffect(() => {
    if (initialRef.current === initial) return;
    initialRef.current = initial;
    const byId = new Map(initial.map((s) => [s.id, s]));
    const added: StopState[] = [];
    setStops((prev) => {
      const kept = prev.filter((s) => byId.has(s.id)).map((s) => ({ ...s, ...byId.get(s.id)!, coord: s.coord }));
      added.push(...initial.filter((s) => !prev.some((p) => p.id === s.id)).map((s) => ({ ...s, coord: null })));
      return [...kept, ...added];
    });
    if (added.length > 0) {
      startTransition(async () => {
        const found = await geocodeStops(added.map((s) => ({ id: s.id, address: s.address })));
        setStops((prev) => prev.map((s) => {
          const f = found.find((x) => x.id === s.id);
          return f ? { ...s, coord: f.coord } : s;
        }));
      });
    }
  }, [initial]);

  const located = useMemo(() => stops.filter((s) => s.coord) as (StopState & { coord: Coord })[], [stops]);

  // Recompute the driving route whenever the located order changes.
  useEffect(() => {
    if (located.length < 2) { setRoute(null); return; }
    let cancelled = false;
    setLoading(true);
    setApplied(false);
    computeRoute(located.map((s) => ({ id: s.id, address: s.address, coord: s.coord }))).then((r) => {
      if (!cancelled) { setRoute(r); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [located]);

  function optimise() {
    if (located.length < 3) return;
    setLoading(true);
    startTransition(async () => {
      const order = await optimiseStopOrder(located.map((s) => ({ id: s.id, address: s.address, coord: s.coord })));
      if (order) {
        const byId = new Map(stops.map((s) => [s.id, s]));
        const locatedOrder = order.map((id) => byId.get(id)!).filter(Boolean);
        const unlocated = stops.filter((s) => !s.coord);
        setStops([...locatedOrder, ...unlocated]);
      }
      setLoading(false);
    });
  }

  function drop(targetId: number) {
    if (dragId === null || dragId === targetId) return;
    const ids = stops.map((s) => s.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    setStops(ids.map((id) => stops.find((s) => s.id === id)!));
    setDragId(null);
    setOverId(null);
  }

  // Timeline: arrival/departure per stop using scheduled time of stop 1 + traffic-adjusted
  // travel + on-site durations. The proposed start/end times are what "Apply" writes back.
  const timeline = useMemo(() => {
    if (located.length === 0) return [];
    let clock = located[0].startTime;
    return located.map((s, i) => {
      const leg = i > 0 ? route?.legs[i - 1] : null;
      let legMin = 0;
      let peak = false;
      if (i > 0) {
        const mult = trafficMultiplier(clock); // clock = departure from previous stop
        peak = mult > 1.1;
        legMin = leg ? leg.durationMin * mult : 20;
        clock = addMinutesToTime(clock, legMin);
      }
      const arrive = clock;
      clock = addMinutesToTime(clock, stopDurationMin(s));
      return { id: s.id, arrive, depart: clock, leg, legMin, peak };
    });
  }, [located, route]);

  // Stops whose traffic-adjusted proposed times differ from what's currently scheduled.
  const pendingChanges = useMemo(
    () =>
      timeline
        .map((t) => {
          const s = located.find((x) => x.id === t.id)!;
          return { id: t.id, address: s.address, jobNumber: s.jobNumber, from: `${s.startTime}–${s.endTime}`, startTime: t.arrive, endTime: t.depart };
        })
        .filter((p) => {
          const s = located.find((x) => x.id === p.id)!;
          return s.startTime !== p.startTime || s.endTime !== p.endTime;
        }),
    [timeline, located],
  );

  function applyProposal() {
    setApplying(true);
    startTransition(async () => {
      await applyRouteTimes(pendingChanges.map((p) => ({ id: p.id, startTime: p.startTime, endTime: p.endTime })));
      setApplying(false);
      setApplied(true);
      router.refresh();
    });
  }

  const totalOnSite = located.reduce((sum, s) => sum + stopDurationMin(s), 0);
  const totalTravelBuffered = timeline.reduce((sum, t) => sum + t.legMin, 0);

  if (initial.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-ink-muted">
        No inspections scheduled for this date.{" "}
        <Link href="/inspections/new" className="link">Schedule one</Link> or pick another day above.
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Stop list / timeline */}
      <div className="flex w-96 shrink-0 flex-col overflow-y-auto">
        <div className="mb-2 flex items-center gap-2">
          <button className="btn-primary" onClick={optimise} disabled={loading || located.length < 3}>
            ✨ Best Route
          </button>
          {loading && <span className="text-xs text-ink-muted">Calculating…</span>}
        </div>

        {route && (
          <div className="card mb-2 p-3">
            <div className="grid grid-cols-3 gap-1 text-center">
              <div><div className="text-xs text-ink-muted">Distance</div><div className="font-semibold">{fmtKm(route.totalDistanceKm)}</div></div>
              <div><div className="text-xs text-ink-muted">Travel (traffic-adj.)</div><div className="font-semibold">{fmtMins(totalTravelBuffered)}</div></div>
              <div><div className="text-xs text-ink-muted">Total day</div><div className="font-semibold">{fmtMins(totalTravelBuffered + totalOnSite)}</div></div>
            </div>
            <div className="mt-1 text-center text-[10px] text-ink-muted">Free-flow {fmtMins(route.totalDurationMin)} · peak-hour legs loaded ×1.3, off-peak ×1.1</div>
          </div>
        )}

        {geoErrors.length > 0 && (
          <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
            Couldn&apos;t locate: {geoErrors.join("; ")}
          </div>
        )}

        <div className="text-xs text-ink-muted mb-1">Drag stops to reorder — the route recalculates automatically.</div>
        {stops.map((s, i) => {
          const t = timeline.find((x) => x.id === s.id);
          const isOver = overId === s.id && dragId !== s.id;
          return (
            <div key={s.id}>
              {t?.leg && (
                <div className="ml-6 border-l-2 border-dashed border-line py-1 pl-3 text-xs text-ink-muted">
                  🚗 {fmtKm(t.leg.distanceKm)} · {fmtMins(t.legMin)} in traffic
                  {t.peak && <span className="text-amber-600"> (peak)</span>}
                </div>
              )}
              <div
                draggable
                onDragStart={(e) => { setDragId(s.id); e.dataTransfer.effectAllowed = "move"; }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                onDragOver={(e) => { e.preventDefault(); setOverId(s.id); }}
                onDrop={(e) => { e.preventDefault(); drop(s.id); }}
                className={`card mb-1 cursor-grab p-2.5 active:cursor-grabbing ${dragId === s.id ? "opacity-40" : ""} ${isOver ? "ring-2 ring-inset ring-[var(--brand-primary)]" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: s.color || "var(--brand-primary)" }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      <Link href={`/inspections/${s.id}`} className="link">{s.jobNumber ? `${s.jobNumber} — ` : ""}{s.address || "(no address)"}</Link>
                    </div>
                    <div className="truncate text-xs text-ink-muted">
                      {s.typeName}{s.clientName ? ` · ${s.clientName}` : ""} · {s.startTime}–{s.endTime}
                      {!s.coord && <span className="text-amber-600"> · not located</span>}
                    </div>
                  </div>
                  {t && (
                    <div className="shrink-0 text-right text-xs text-ink-muted">
                      <div>arr {t.arrive}</div>
                      <div>dep {t.depart}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {officeAddress && <div className="mt-1 text-xs text-ink-muted">🏢 Day starts from: {officeAddress}</div>}

        {route && pendingChanges.length > 0 && (
          <div className="card mt-3 border-[var(--brand-primary)] p-3">
            <div className="mb-2 text-sm font-semibold">Proposed schedule <span className="font-normal text-xs text-ink-muted">(traffic-adjusted)</span></div>
            {pendingChanges.map((p) => (
              <div key={p.id} className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{p.jobNumber ? `${p.jobNumber} — ` : ""}{p.address}</span>
                <span className="shrink-0 text-ink-muted line-through">{p.from}</span>
                <span className="shrink-0 font-semibold">{p.startTime}–{p.endTime}</span>
              </div>
            ))}
            <button className="btn-primary mt-2 w-full" onClick={applyProposal} disabled={applying}>
              {applying ? "Applying…" : applied ? "Applied ✓ — Apply again" : `Apply proposed times to ${pendingChanges.length} inspection${pendingChanges.length === 1 ? "" : "s"}`}
            </button>
            <div className="mt-1 text-[10px] text-ink-muted">Updates the confirmed start/end times on each inspection and logs the change.</div>
          </div>
        )}
        {route && pendingChanges.length === 0 && located.length > 1 && (
          <div className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-800">
            ✓ Scheduled times already match the traffic-adjusted best schedule.
          </div>
        )}
      </div>

      {/* Map */}
      <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-line">
        <RouteMap stops={located} geometry={route?.geometry ?? []} />
      </div>
    </div>
  );
}
