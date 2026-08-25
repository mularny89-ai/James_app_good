"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Coord } from "@/lib/routing";

type MapStop = { id: number; jobNumber: string; address: string; coord: Coord; color: string; waypoint?: "start" | "end" };

function numberedIcon(n: number, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color || "#34368b"};color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function officeIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="background:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid #6b7280;box-shadow:0 1px 4px rgba(0,0,0,.4)">🏢</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitBounds({ stops, geometry }: { stops: MapStop[]; geometry: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = geometry.length ? geometry : stops.map((s) => [s.coord.lat, s.coord.lng]);
    if (pts.length === 0) return;
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
  }, [stops, geometry, map]);
  return null;
}

export default function RouteMap({ stops, geometry }: { stops: MapStop[]; geometry: [number, number][] }) {
  const centre: [number, number] = stops.length ? [stops[0].coord.lat, stops[0].coord.lng] : [-28.0167, 153.4]; // Gold Coast default
  return (
    <MapContainer center={centre} zoom={11} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {stops.map((s, i) => (
        <Marker key={s.id} position={[s.coord.lat, s.coord.lng]} icon={s.waypoint ? officeIcon() : numberedIcon(i + 1, s.color)}>
          <Popup>
            <strong>{s.waypoint ? `🏢 ${s.waypoint === "start" ? "Day start" : "Day end"} — ` : `${i + 1}. ${s.jobNumber ? `${s.jobNumber} — ` : ""}`}{s.address}</strong>
          </Popup>
        </Marker>
      ))}
      {geometry.length > 0 && <Polyline positions={geometry} pathOptions={{ color: "#34368b", weight: 5, opacity: 0.75 }} />}
      <FitBounds stops={stops} geometry={geometry} />
    </MapContainer>
  );
}
