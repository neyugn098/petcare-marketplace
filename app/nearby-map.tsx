"use client";

import { useEffect } from "react";
import { divIcon } from "leaflet";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { Partner } from "./types";

function Recenter({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo(position, 14, { duration: 1.2 }); }, [map, position]);
  return null;
}

export default function NearbyMap({ partners, userLocation }: { partners: Partner[]; userLocation: [number, number] | null }) {
  const center: [number, number] = userLocation ?? [10.7769, 106.7009];
  return <MapContainer center={center} zoom={13} scrollWheelZoom className="leaflet-map" aria-label="Bản đồ thú y và pet shop gần bạn">
    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Recenter position={userLocation} />
    {userLocation && <CircleMarker center={userLocation} radius={9} pathOptions={{ color: "#ffffff", weight: 4, fillColor: "#4385ff", fillOpacity: 1 }}><Popup>Vị trí hiện tại của bạn</Popup></CircleMarker>}
    {partners.map((partner, index) => <Marker key={partner.id} position={[partner.latitude, partner.longitude]} icon={divIcon({ className: "pawly-map-marker-wrap", html: `<div class="pawly-map-marker ${partner.open_now ? "open" : "closed"}">${index + 1}</div>`, iconSize: [38, 44], iconAnchor: [19, 42] })}><Popup><div className="map-popup"><b>{partner.name}</b><span>{partner.open_now ? "Đang mở" : "Đã đóng"}</span><small>{partner.address}</small></div></Popup></Marker>)}
  </MapContainer>;
}
