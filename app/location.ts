export type Coordinates = [number, number];
export function validCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}
export function distanceKm(from: Coordinates, to: Coordinates) {
  const rad = (n: number) => n * Math.PI / 180;
  const a = Math.sin(rad(to[0] - from[0]) / 2) ** 2 + Math.cos(rad(from[0])) * Math.cos(rad(to[0])) * Math.sin(rad(to[1] - from[1]) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
export function locationErrorMessage(code: number) {
  if (code === 1) return "Quyền vị trí đang bị chặn. Bật Vị trí trong cài đặt quyền của trang rồi thử lại, hoặc chọn điểm trên bản đồ. Nếu dùng trình duyệt trong ứng dụng, hãy mở trang bằng Chrome, Edge hoặc Safari.";
  if (code === 3) return "Thiết bị lấy vị trí quá lâu. Thử lại hoặc chọn điểm trên bản đồ.";
  return "Thiết bị chưa xác định được vị trí. Kiểm tra dịch vụ vị trí của máy hoặc chọn điểm trên bản đồ.";
}
export async function locateDevice(geolocation: Pick<Geolocation, "getCurrentPosition">): Promise<GeolocationPosition> {
  const read = (highAccuracy: boolean) => new Promise<GeolocationPosition>((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 15000 : 10000, maximumAge: highAccuracy ? 0 : 60000 });
  });
  try { return await read(false); }
  catch (error) {
    if ((error as GeolocationPositionError).code === 1) throw error;
    return read(true);
  }
}
