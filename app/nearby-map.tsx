"use client";

import { useEffect } from "react";
import { divIcon } from "leaflet";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Partner } from "./types";

function Recenter({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo(position, 14, { duration: 1.2 }); }, [map, position]);
  return null;
}

function FitLocations({ partners, userLocation }: { partners: Partner[]; userLocation: [number, number] | null }) {
  const map = useMap();
  const signature = partners.map(p => p.latitude + "," + p.longitude).sort().join(";");
  useEffect(() => {
    if (!userLocation && signature) {
      const points = signature.split(";").map(p => p.split(",").map(Number) as [number, number]);
      map.fitBounds(points, { padding: [30, 30], maxZoom: 14 });
    }
  }, [map, signature, userLocation]);
  return null;
}

function PickPosition({ picking, onPick }: { picking: boolean; onPick: (position: [number, number]) => void }) {
  const map = useMapEvents({ click(event) { if (picking) onPick([event.latlng.lat, event.latlng.lng]); } });
  useEffect(() => { map.getContainer().style.cursor = picking ? "crosshair" : ""; }, [map, picking]);
  return null;
}

export default function NearbyMap({ partners, userLocation, picking, onPick }: { partners: Partner[]; userLocation: [number, number] | null; picking: boolean; onPick: (position: [number, number]) => void }) {
  const center: [number, number] = userLocation ?? (partners[0] ? [partners[0].latitude, partners[0].longitude] : [10.7769, 106.7009]);
  return <MapContainer center={center} zoom={13} scrollWheelZoom className="leaflet-map" aria-label="Bản đồ thú y và pet shop gần bạn">
    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Recenter position={userLocation} /><FitLocations partners={partners} userLocation={userLocation} />
    <PickPosition picking={picking} onPick={onPick} />
    {userLocation && <CircleMarker center={userLocation} radius={9} pathOptions={{ color: "#ffffff", weight: 4, fillColor: "#4385ff", fillOpacity: 1 }}><Popup>Vị trí dùng để tìm kiếm</Popup></CircleMarker>}
    {partners.map((partner, index) => <Marker key={partner.id} position={[partner.latitude, partner.longitude]} icon={divIcon({ className: "pawly-map-marker-wrap", html: `<div class="pawly-map-marker ${userLocation && index === 0 ? "nearest" : partner.open_now ? "open" : "closed"}">${index + 1}</div>`, iconSize: [38, 44], iconAnchor: [19, 42] })}><Popup><div className="map-popup"><b>{partner.name}</b>{userLocation && index === 0 && <strong>Gần nhất trong danh sách</strong>}<span>{partner.directory_source ? "Cơ sở tham khảo · Chưa rõ giờ hoạt động" : partner.open_now ? "Đang mở" : "Đã đóng"}</span><small>{partner.address}</small></div></Popup></Marker>)}
  </MapContainer>;
}
