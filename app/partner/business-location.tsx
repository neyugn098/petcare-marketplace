"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { locateDevice, locationErrorMessage, validCoordinates, type Coordinates } from "../location";
const Map = dynamic(() => import("../nearby-map"), { ssr: false });
export default function BusinessLocation({ latitude = "", longitude = "" }: { latitude?: string; longitude?: string }) {
  const [lat, setLat] = useState(latitude), [lng, setLng] = useState(longitude);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const position: Coordinates | null = lat !== "" && lng !== "" && validCoordinates(Number(lat), Number(lng)) ? [Number(lat), Number(lng)] : null;
  const pick = (point: Coordinates) => { setLat(point[0].toFixed(6)); setLng(point[1].toFixed(6)); setError(""); };
  const locate = async () => {
    if (!navigator.geolocation) { setError("Hãy chọn vị trí cơ sở trên bản đồ."); return; }
    setBusy(true); setError("");
    try { const p = await locateDevice(navigator.geolocation); pick([p.coords.latitude, p.coords.longitude]); }
    catch (e) { setError(locationErrorMessage((e as GeolocationPositionError).code)); }
    finally { setBusy(false); }
  };
  return <div className="business-location wide"><h3>Vị trí cơ sở trên bản đồ</h3><p>Nhập địa chỉ phía trên rồi bấm đúng vị trí cơ sở trên bản đồ. Địa chỉ và ghim cần cùng một nơi; hệ thống dùng ghim để tính khoảng cách.</p><button type="button" disabled={busy} onClick={() => void locate()}>{busy ? "Đang định vị…" : "Dùng vị trí thiết bị (khi đang ở cơ sở)"}</button><button type="button" onClick={event => { const address = new FormData(event.currentTarget.form!).get("address"); if (typeof address === "string" && address.trim()) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank", "noopener,noreferrer"); else setError("Nhập địa chỉ cơ sở trước khi tra cứu."); }}>Tra địa chỉ trên Google Maps ↗</button><p>Có thể tra địa chỉ rồi bấm chuột phải lên vị trí trong Google Maps để lấy vĩ độ, kinh độ và nhập bên dưới. Khi tra cứu, địa chỉ cơ sở được gửi cho Google.</p><div className="coordinate-fields"><label>Vĩ độ<input name="latitude" value={lat} onChange={e => setLat(e.target.value)} type="number" step="any" min="-90" max="90" required /></label><label>Kinh độ<input name="longitude" value={lng} onChange={e => setLng(e.target.value)} type="number" step="any" min="-180" max="180" required /></label></div><div style={{ height: 320 }}><Map partners={[]} userLocation={position} picking={!busy} onPick={pick}/></div><p role="status">{position ? "Đã chọn ghim. Kiểm tra vị trí trước khi lưu hồ sơ." : "Chưa chọn vị trí — bản đồ đang ở khu vực tham khảo."}</p>{error && <p role="alert">{error}</p>}</div>;
}
