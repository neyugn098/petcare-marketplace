"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { nearbyLocations, pendingDirectoryLocations } from "./directory-locations";
import type { Partner } from "./types";
import { distanceKm, locateDevice, locationErrorMessage, validCoordinates, type Coordinates } from "./location";
const NearbyMap = dynamic(() => import("./nearby-map"), { ssr: false, loading: () => <div className="map-loading">Đang tải bản đồ...</div> });

export default function NearbyView({ type, setType, partners, onBook }: { type: "vet" | "shop"; setType: (value: "vet" | "shop") => void; partners: Partner[]; onBook: (partner: Partner) => void }) {
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState("");
  const [locating, setLocating] = useState(false);
  const [picking, setPicking] = useState(false);
  const [source, setSource] = useState<"device" | "manual">("device");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const activeRequest = useRef(0);
  useEffect(() => () => { activeRequest.current++; }, []);
  const distance = (partner: Partner) => userLocation ? distanceKm(userLocation, [partner.latitude, partner.longitude]) : null;
  const sortedPartners = nearbyLocations(partners, type).sort((a, b) => userLocation ? distance(a)! - distance(b)! : a.name.localeCompare(b.name, "vi"));
  const locate = async () => {
    const requestId = ++activeRequest.current;
    setLocationError(""); setPicking(false);
    if (!window.isSecureContext) { setLocationError("Định vị cần HTTPS hoặc localhost. Bạn có thể chọn điểm trên bản đồ."); return; }
    if (!navigator.geolocation) { setLocationError("Trình duyệt không hỗ trợ định vị. Hãy chọn điểm trên bản đồ."); return; }
    setLocating(true);
    try {
      const position = await locateDevice(navigator.geolocation);
      if (requestId !== activeRequest.current) return;
      const { latitude, longitude, accuracy } = position.coords;
      if (!validCoordinates(latitude, longitude)) throw { code: 2 };
      setUserLocation([latitude, longitude]); setAccuracy(accuracy); setSource("device");
    } catch (error) {
      if (requestId === activeRequest.current) setLocationError(locationErrorMessage((error as GeolocationPositionError).code));
    } finally { if (requestId === activeRequest.current) setLocating(false); }
  };
  const pick = (position: Coordinates) => {
    activeRequest.current++; setLocating(false); setUserLocation(position); setSource("manual"); setAccuracy(null); setPicking(false); setLocationError("");
  };
  const searchQuery = `${type === "vet" ? "phòng khám thú y" : "pet shop"} ${userLocation ? `gần ${userLocation.join(",")}` : "gần tôi"}`;
  return <section className="section-wrap nearby-page">
    <div className="page-heading"><span className="eyebrow">Tìm cơ sở chăm sóc thú cưng</span><h1>Chăm bé, ngay gần bạn.</h1><p>Dùng vị trí của bạn hoặc chọn một điểm trên bản đồ để sắp xếp cơ sở theo khoảng cách.</p></div>
    <div className="segmented"><button className={type === "vet" ? "active" : ""} onClick={() => setType("vet")}>✚ Thú y</button><button className={type === "shop" ? "active" : ""} onClick={() => setType("shop")}>♧ Pet shop</button></div>
    <div className="location-toolbar">
      <button className="primary-button small" onClick={() => void locate()} disabled={locating}>⌖ {locating ? "Đang lấy vị trí…" : userLocation ? "Cập nhật vị trí của tôi" : "Dùng vị trí của tôi"}</button>
      <button className="secondary-button" aria-pressed={picking} onClick={() => { activeRequest.current++; setLocating(false); setPicking(!picking); }}> {picking ? "Hủy chọn điểm" : "Chọn điểm trên bản đồ"}</button>
      <a className="secondary-button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`} target="_blank" rel="noreferrer">Tìm thêm trên Google Maps ↗</a>
    </div>
    <p className="location-status" role="status">{picking ? "Chạm hoặc bấm vào bản đồ để chọn vị trí tìm kiếm." : userLocation ? `${source === "manual" ? "Đang tìm quanh điểm bạn chọn" : "Đã lấy vị trí thiết bị"}${accuracy !== null ? ` (độ chính xác khoảng ${Math.round(accuracy)} m)` : ""}. Khoảng cách là đường chim bay.` : "Chưa có vị trí — chưa tính khoảng cách. Bản đồ đang hiển thị khu vực tham khảo."}</p>
    {locationError && <p className="location-warning" role="alert">{locationError}</p>}
    <p className="location-status">Cơ sở tham khảo được tổng hợp từ địa chỉ công khai, chưa phải đối tác được PetCare xác minh; chưa hỗ trợ đặt lịch trong ứng dụng. Hãy liên hệ cơ sở trước khi đến.</p><div className="nearby-layout">
      <div className="partner-list">{!sortedPartners.length && <div className="nearby-empty"><h2>Chưa có cơ sở {type === "vet" ? "thú y" : "pet shop"} trên PetCare</h2><p>Danh sách này chỉ gồm đối tác đã được PetCare xác minh. Dùng “Tìm thêm trên Google Maps” để tìm các cơ sở khác; đặt lịch PetCare chỉ áp dụng cho đối tác trong danh sách.</p></div>}{sortedPartners.map((partner, index) => { const isNearest = Boolean(userLocation && index === 0); return <article className={`partner-card ${isNearest ? "nearest-card" : ""}`} key={partner.id}><div className="partner-number">{index + 1}</div><div className="partner-main"><div className="partner-title"><h3>{partner.name} {partner.verified ? <span title="Đã xác minh">✓</span> : null}</h3><span className={partner.open_now ? "status-open" : "status-closed"}>{partner.directory_source ? "Cơ sở tham khảo" : partner.open_now ? "Đang mở" : "Đã đóng"}</span></div>{isNearest && <strong className="nearest-badge">Gần bạn nhất trong danh sách</strong>}<p>{partner.address}</p><div className="partner-meta">{!partner.directory_source && <span>★ {partner.rating} ({partner.review_count})</span>}<span>{userLocation ? `⌖ ${distance(partner)!.toFixed(1)} km` : "Chưa tính khoảng cách"}</span><span>{partner.hours}</span></div><div className="service-tags">{partner.services.split("|").map(service => <span key={service}>{service}</span>)}</div><div className="partner-actions">{partner.directory_source && <a className="secondary-button" href={partner.directory_source} target="_blank" rel="noreferrer">Nguồn địa chỉ ↗</a>}<a className="secondary-button" href={`https://www.google.com/maps/dir/?api=1&destination=${partner.latitude},${partner.longitude}${userLocation ? `&origin=${userLocation.join(",")}` : ""}`} target="_blank" rel="noreferrer">Chỉ đường</a>{type === "vet" && !partner.directory_source && <button className="primary-button small" onClick={() => onBook(partner)} disabled={!partner.accepting_appointments}>{partner.accepting_appointments ? "Đặt lịch khám" : "Chưa nhận lịch"}</button>}</div></div></article>; })}</div>
      <div className="map-card real-map"><NearbyMap partners={sortedPartners} userLocation={userLocation} picking={picking} onPick={pick}/><div className="map-legend"><span><i className="open-dot"/> Đang mở</span><span><i className="closed-dot"/> Đã đóng / chưa rõ giờ</span></div></div>
    </div>
    {pendingDirectoryLocations.some(p => p.type === type) && <details className="nearby-pending"><summary>Địa chỉ chờ xác nhận vị trí ({pendingDirectoryLocations.filter(p => p.type === type).length})</summary><p>Các địa chỉ này chưa có ghim và không tham gia xếp hạng khoảng cách.</p>{pendingDirectoryLocations.filter(p => p.type === type).map(p => <article key={p.id}><b>{p.name}</b><p>{p.address}</p><p>{p.note}</p><a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.address}`)}`}>Tra cứu trên Google Maps ↗</a></article>)}</details>}<p className="location-privacy">Vị trí dùng để tính khoảng cách trên thiết bị, không lưu vào hồ sơ PetCare. Nhà cung cấp bản đồ nhận khu vực bản đồ bạn xem. Khi mở Google Maps, điểm tìm kiếm hoặc chỉ đường sẽ được gửi cho Google.</p>
  </section>;
}
