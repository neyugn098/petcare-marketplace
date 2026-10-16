import records from "../data/thu-duc-locations.json";
import type { Partner } from "./types";
import { validCoordinates } from "./location";
const locations: Array<{ id: string; name: string; type: string; address: string; latitude: number | null; longitude: number | null; source?: string; note?: string }> = records;
export const pendingDirectoryLocations = locations.filter(p => p.latitude === null || p.longitude === null);
export const directoryLocations: Partner[] = records.filter(p => p.latitude !== null && p.longitude !== null && validCoordinates(p.latitude, p.longitude)).map(p => ({
  id: p.id, name: p.name, type: p.type as Partner["type"], address: p.address,
  latitude: p.latitude!, longitude: p.longitude!, phone: "", rating: 0, review_count: 0,
  open_now: 0, accepting_appointments: 0, hours: "Liên hệ cơ sở để xác nhận giờ hoạt động",
  services: p.type === "shop" ? "Pet shop" : "Thú y", distance_km: 0, verified: 0,
  directory_source: p.source,
}));
export function nearbyLocations(partners: Partner[], type: "vet" | "shop") {
  return [...partners.filter(p => p.verified), ...directoryLocations].filter(p => (p.type === type || p.type === "both") && validCoordinates(p.latitude, p.longitude));
}
