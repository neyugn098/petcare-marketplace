"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import dynamic from "next/dynamic";
import { BRAND, FALLBACK_DATA, PAYMENT_CONFIG } from "./config";
import { formatVietnamDate, formatVietnamDateTime, formatVietnamTime, formatVnd, getVietnamDateParts } from "./format";
import type { AppData, Order, Partner, Pet, Product } from "./types";

type View = "shop" | "nearby" | "pets" | "appointments" | "orders";
type CheckoutOrder = { id: string; orderCode: string; total: number; status: string };
const NearbyMap = dynamic(() => import("./nearby-map"), { ssr: false, loading: () => <div className="map-loading">Đang tải bản đồ...</div> });

const money = formatVnd;
const dateText = formatVietnamDate;
const dateTimeText = formatVietnamDateTime;
const SIGN_IN_PATH = "/signin-with-chatgpt?return_to=%2F";
const SIGN_OUT_PATH = "/signout-with-chatgpt?return_to=%2F";
const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();

function mergeData(payload: Partial<AppData>): AppData {
  return {
    ...FALLBACK_DATA,
    ...payload,
    products: payload.products?.length ? payload.products : FALLBACK_DATA.products,
    partners: payload.partners?.length ? payload.partners : FALLBACK_DATA.partners,
    pets: payload.pets ?? [],
    appointments: payload.appointments ?? [],
    vaccinations: payload.vaccinations ?? [],
    medicalRecords: payload.medicalRecords ?? [],
    partnerRoles: payload.partnerRoles ?? [],
    partnerAppointments: payload.partnerAppointments ?? [],
    partnerProducts: payload.partnerProducts ?? [],
    partnerPets: payload.partnerPets ?? [],
    orders: payload.orders ?? [],
    partnerOrders: payload.partnerOrders ?? [],
  };
}

export default function CustomerApp({ initialActor }: { initialActor: AppData["actor"] }) {
  const [view, setView] = useState<View>("shop");
  const [data, setData] = useState<AppData>({ ...FALLBACK_DATA, actor: initialActor, requiresSignIn: !initialActor });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [nearbyType, setNearbyType] = useState<"vet" | "shop">("vet");
  const [selectedPetId, setSelectedPetId] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [bookingPartner, setBookingPartner] = useState<Partner | null>(null);
  const [qrPet, setQrPet] = useState<Pet | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutOrder, setCheckoutOrder] = useState<CheckoutOrder | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [petFormOpen, setPetFormOpen] = useState(false);
  const [petFormPet, setPetFormPet] = useState<Pet | null>(null);
  const [authPrompt, setAuthPrompt] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [toast, setToast] = useState("");

  const reload = async () => {
    try {
      const response = await fetch("/api/app", { cache: "no-store" });
      if (!response.ok) return;
      setData(mergeData(await response.json() as Partial<AppData>));
    } catch { /* Dữ liệu dự phòng vẫn giữ cho giao diện hoạt động. */ }
  };

  // Data is loaded after hydration so per-user records are never embedded in a shared HTML snapshot.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const effectiveSelectedPetId = data.pets.some((pet) => pet.id === selectedPetId) ? selectedPetId : (data.pets[0]?.id ?? "");
  const selectedPet = data.pets.find((pet) => pet.id === effectiveSelectedPetId) ?? data.pets[0];
  const categories = ["Tất cả", "Thức ăn", "Phụ kiện", "Đồ chơi", "Chăm sóc"];
  const filteredProducts = useMemo(() => data.products.filter((product) => {
    const needle = normalizeSearch(search);
    const matchesCategory = Boolean(needle) || category === "Tất cả" || product.category === category;
    const haystack = normalizeSearch(`${product.name} ${product.category} ${product.description}`);
    return matchesCategory && (!needle || haystack.includes(needle));
  }), [category, data.products, search]);
  const searchSuggestions = normalizeSearch(search) ? filteredProducts.slice(0, 5) : [];
  const nearbyPartners = data.partners.filter((partner) => nearbyType === "vet" ? partner.type !== "shop" : partner.type !== "vet");
  const cartLines = Object.entries(cart).map(([id, quantity]) => ({ product: data.products.find((item) => item.id === id), quantity })).filter((line): line is { product: Product; quantity: number } => Boolean(line.product));
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  const navigate = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addToCart = (id: string) => {
    setCart((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
    setToast("Đã thêm vào giỏ — boss sắp có quà rồi! 🐾");
  };

  const selectSearchProduct = (product: Product) => {
    setSearch(product.name);
    setCategory("Tất cả");
    setView("shop");
    window.requestAnimationFrame(() => document.getElementById("best-sellers")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const requestBooking = (partner: Partner) => {
    if (!data.actor) { setAuthPrompt(true); return; }
    setBookingPartner(partner);
  };

  const openPetForm = (pet: Pet | null = null) => {
    setPetFormPet(pet);
    setPetFormOpen(true);
  };

  const rotatePetQr = async (pet: Pet) => {
    if (!window.confirm(`Tạo QR mới cho ${pet.name}? QR cũ sẽ ngừng hoạt động ngay.`)) return;
    try {
      const response = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rotatePetQr", petId: pet.id }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Không thể tạo lại QR");
      setQrPet(null);
      await reload();
      setToast("Đã cấp QR mới; QR cũ đã bị thu hồi.");
    } catch (caught) { setToast(caught instanceof Error ? caught.message : "Không thể tạo lại QR"); }
  };

  const beginCheckout = async () => {
    if (!data.actor) { setCartOpen(false); setAuthPrompt(true); return; }
    if (!cartLines.length || checkoutBusy) return;
    setCheckoutBusy(true);
    try {
      const response = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createOrder", items: cartLines.map((line) => ({ productId: line.product.id, quantity: line.quantity })) }) });
      const body = await response.json() as CheckoutOrder & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Không thể tạo đơn hàng");
      setCheckoutOrder(body);
      setCartOpen(false);
      setCheckoutOpen(true);
      await reload();
    } catch (caught) { setToast(caught instanceof Error ? caught.message : "Không thể tạo đơn hàng"); }
    finally { setCheckoutBusy(false); }
  };

  const actorInitials = data.actor?.fullName.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]?.toUpperCase()).join("") || "TK";

  return (
    <div className="site-shell">
      <div className="announcement"><span>Đổi trả trong 7 ngày</span><span>Tư vấn thú y 7:00–22:00</span></div>
      <header className="main-header">
        <button className="brand" onClick={() => navigate("shop")} aria-label="Về trang mua sắm">
          <span className="brand-mark">P</span><span>{BRAND.name}</span><i>care & shop</i>
        </button>
        <div className="global-search">
          <span>⌕</span>
          <input value={search} onChange={(event) => { setSearch(event.target.value); if (event.target.value.trim()) setCategory("Tất cả"); }} onFocus={() => setView("shop")} onKeyDown={(event) => { if (event.key === "Enter" && searchSuggestions[0]) selectSearchProduct(searchSuggestions[0]); }} placeholder="Tìm thức ăn, đồ chơi, phụ kiện..." aria-label="Tìm sản phẩm" aria-controls="search-suggestions" autoComplete="off" />
          <kbd>⌘ K</kbd>
          {normalizeSearch(search) && <div className="search-suggestions" id="search-suggestions" role="listbox" aria-label="Gợi ý sản phẩm">{searchSuggestions.map((product) => <button key={product.id} role="option" aria-selected="false" onMouseDown={(event) => event.preventDefault()} onClick={() => selectSearchProduct(product)}><span>{product.visual}</span><p><b>{product.name}</b><small>{product.category} · {money(product.price)}</small></p></button>)}{!searchSuggestions.length && <p className="search-no-result">Không tìm thấy sản phẩm phù hợp.</p>}</div>}
        </div>
        <nav className="desktop-nav" aria-label="Điều hướng chính">
          <button className={view === "shop" ? "active" : ""} onClick={() => navigate("shop")}>Cửa hàng</button>
          <button className={view === "nearby" ? "active" : ""} onClick={() => navigate("nearby")}>Gần bạn</button>
          <button className={view === "pets" ? "active" : ""} onClick={() => navigate("pets")}>Hồ sơ pet</button>
        </nav>
        <div className="header-actions">
          <a className="partner-link" href="/partner">Dành cho đối tác</a>
          <button className="icon-button" onClick={() => navigate("appointments")} aria-label="Lịch khám">♡</button>
          <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Giỏ hàng có ${cartCount} sản phẩm`}>Túi <b>{cartCount}</b></button>
          {data.actor ? <div className="account-session"><button className="avatar-button" aria-label="Mở thông tin phiên đăng nhập" aria-expanded={accountOpen} onClick={() => setAccountOpen((value) => !value)}>{actorInitials}</button>{accountOpen && <div className="account-menu"><b>{data.actor.fullName}</b><small>{data.actor.email}</small><span>🔒 {data.actor.isDemo ? "Phiên demo cục bộ" : "Tài khoản PetCare đã đồng bộ"}</span><button onClick={() => { setAccountOpen(false); navigate("orders"); }}>Đơn hàng của tôi</button>{data.actor.isDemo ? <button onClick={() => setAccountOpen(false)}>Đóng</button> : <a href={SIGN_OUT_PATH}>Đăng xuất</a>}</div>}</div> : <div className="guest-auth"><a className="account-login" href={SIGN_IN_PATH}>Đăng nhập</a><a className="account-register" href={SIGN_IN_PATH}>Đăng ký</a></div>}
        </div>
      </header>

      <main>
        {view === "shop" && <ShopView products={filteredProducts} categories={categories} category={category} setCategory={setCategory} addToCart={addToCart} onNearby={() => navigate("nearby")} />}
        {view === "nearby" && <NearbyView type={nearbyType} setType={setNearbyType} partners={nearbyPartners} onBook={requestBooking} />}
        {view === "pets" && (!data.actor ? <SignInGate title="Đăng nhập hoặc đăng ký để mở hồ sơ pet" text="Hồ sơ sức khỏe, QR và lịch tiêm chỉ hiển thị cho đúng chủ nuôi." /> : selectedPet ? <PetsView data={data} pet={selectedPet} selectedPetId={effectiveSelectedPetId} onSelectPet={setSelectedPetId} onShowQr={setQrPet} onBook={() => navigate("nearby")} onAdd={() => openPetForm()} onEdit={() => openPetForm(selectedPet)} onRotateQr={() => void rotatePetQr(selectedPet)} /> : <EmptyPets onAdd={() => openPetForm()} />)}
        {view === "appointments" && (data.actor ? <AppointmentsView data={data} onFindVet={() => navigate("nearby")} /> : <SignInGate title="Đăng nhập để xem lịch khám" text="PetCare cần xác nhận đúng chủ nuôi trước khi hiển thị lịch hẹn." />)}
        {view === "orders" && (data.actor ? <OrdersView orders={data.orders} onShop={() => navigate("shop")} /> : <SignInGate title="Đăng nhập để xem đơn hàng" text="Đơn hàng và trạng thái thanh toán chỉ hiển thị cho đúng tài khoản." />)}
      </main>

      <footer className="site-footer">
        <div><button className="brand footer-brand" onClick={() => navigate("shop")}><span className="brand-mark">P</span><span>PetCare</span></button><p>Một nơi cho mọi điều boss cần — khỏe hơn, vui hơn, gần bạn hơn.</p></div>
        <div><b>Hỗ trợ</b><span>{BRAND.supportPhone}</span><span>{BRAND.supportEmail}</span></div>
        <div><b>An tâm mua sắm</b><span>Đối tác đã xác minh</span><span>Thanh toán bảo mật</span></div>
      </footer>

      <nav className="mobile-nav" aria-label="Điều hướng di động">
        <button className={view === "shop" ? "active" : ""} onClick={() => navigate("shop")}><span>⌂</span>Mua sắm</button>
        <button className={view === "nearby" ? "active" : ""} onClick={() => navigate("nearby")}><span>⌖</span>Gần bạn</button>
        <button className={view === "pets" ? "active" : ""} onClick={() => navigate("pets")}><span>🐾</span>Hồ sơ</button>
        <button className={view === "appointments" ? "active" : ""} onClick={() => navigate("appointments")}><span>▣</span>Lịch khám</button>
        <button className={view === "orders" ? "active" : ""} onClick={() => navigate("orders")}><span>◇</span>Đơn hàng</button>
      </nav>

      {cartOpen && <CartDrawer lines={cartLines} total={cartTotal} busy={checkoutBusy} onClose={() => setCartOpen(false)} onChange={(id, delta) => setCart((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + delta) }))} onCheckout={() => void beginCheckout()} />}
      {bookingPartner && <BookingModal partner={bookingPartner} pets={data.pets} onClose={() => setBookingPartner(null)} onSuccess={async () => { setBookingPartner(null); setToast("Đã gửi yêu cầu. Phòng khám sẽ xác nhận sớm!"); await reload(); setView("appointments"); }} />}
      {qrPet && <QrModal pet={qrPet} onClose={() => setQrPet(null)} />}
      {checkoutOpen && checkoutOrder && <CheckoutModal order={checkoutOrder} onClose={() => setCheckoutOpen(false)} onSuccess={async () => { setCheckoutOpen(false); setCheckoutOrder(null); setCart({}); setToast("Đơn hàng đang chờ cửa hàng đối soát thanh toán."); await reload(); setView("orders"); }} />}
      {petFormOpen && <PetFormModal pet={petFormPet} onClose={() => { setPetFormOpen(false); setPetFormPet(null); }} onSuccess={async () => { setPetFormOpen(false); setPetFormPet(null); setToast(petFormPet ? "Đã cập nhật hồ sơ của bé." : "Đã tạo hồ sơ mới và cấp QR riêng cho bé."); await reload(); }} />}
      {authPrompt && <ModalShell title="Đăng nhập để đặt lịch" onClose={() => setAuthPrompt(false)} className="auth-prompt-modal"><div className="auth-shield">🔒</div><p>Đăng nhập giúp phòng khám nhận đúng hồ sơ pet và ngăn người khác đặt lịch thay bạn.</p><a className="primary-button small" href={SIGN_IN_PATH}>Đăng nhập an toàn</a><button className="text-button" onClick={() => setAuthPrompt(false)}>Tiếp tục xem trước</button></ModalShell>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function ShopView({ products, categories, category, setCategory, addToCart, onNearby }: { products: Product[]; categories: string[]; category: string; setCategory: (value: string) => void; addToCart: (id: string) => void; onNearby: () => void }) {
  return <>
    <section className="hero section-wrap">
      <div className="hero-copy">
        <span className="eyebrow">Tụi mình chọn kỹ, boss mê ly</span>
        <h1>Đầy túi quà,<br/><em>đầy ắp yêu thương.</em></h1>
        <p>Từ bữa ăn ngon đến chăm sóc sức khỏe — mọi điều tốt nhất cho bé đều ở đây.</p>
        <div className="hero-actions"><a href="#best-sellers" className="primary-button">Mua ngay <span>→</span></a><button className="text-button" onClick={onNearby}>Tìm thú y gần tôi <span>⌖</span></button></div>
        <div className="trust-row"><span>★ 4.9/5 từ 12K+ sen</span><span>✓ Đối tác xác minh</span></div>
      </div>
      <div className="hero-art" aria-label="Miso đang vui bên quà tặng">
        <div className="hero-blob"><div className="hero-pet">🐶</div><span className="spark spark-one">✦</span><span className="spark spark-two">♥</span></div>
        <div className="floating-card float-food"><span>🥣</span><div><b>Bữa ngon mỗi ngày</b><small>Đủ dinh dưỡng</small></div></div>
        <div className="floating-card float-care"><span>✚</span><div><b>Chăm sóc gần bạn</b><small>Đặt lịch trong 1 phút</small></div></div>
      </div>
    </section>

    <section className="benefit-strip section-wrap"><div><span>♢</span><b>Hàng chính hãng</b><small>Đổi trả dễ dàng</small></div><div><span>⚡</span><b>Giao nhanh 2H</b><small>Nội thành TP.HCM</small></div><div><span>♧</span><b>Chọn theo từng bé</b><small>Gợi ý đúng nhu cầu</small></div><div><span>♡</span><b>Tích điểm Paw+</b><small>Càng yêu càng lời</small></div></section>

    <section className="section-wrap product-section" id="best-sellers">
      <div className="section-heading"><div><span className="eyebrow">Boss mê nhất tuần này</span><h2>Đang được săn đón</h2></div><button className="text-button">Xem tất cả <span>→</span></button></div>
      <div className="category-row">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} onAdd={() => addToCart(product.id)} />)}</div>
      {!products.length && <div className="empty-state"><span>⌕</span><h3>Chưa thấy món phù hợp</h3><p>Thử từ khóa hoặc nhóm sản phẩm khác nhé.</p></div>}
    </section>

    <section className="section-wrap care-banner"><div><span className="eyebrow">PetCare 360</span><h2>Không chỉ mua sắm.<br/>Còn là bình an.</h2><p>Xem cơ sở đang mở, đặt lịch và giữ hồ sơ sức khỏe của bé trong một nơi.</p><button className="light-button" onClick={onNearby}>Khám phá gần bạn →</button></div><div className="care-orbit"><span className="care-pet">🐕</span><i>✚</i><i>⌖</i><i>♡</i></div></section>
  </>;
}

function SignInGate({ title, text }: { title: string; text: string }) {
  return <section className="section-wrap account-gate"><span>🔒</span><h1>{title}</h1><p>{text}</p><a className="primary-button" href={SIGN_IN_PATH}>Tiếp tục đăng nhập / đăng ký <span>→</span></a><small>Phiên đăng nhập do nền tảng bảo vệ; PetCare không lưu mật khẩu.</small></section>;
}

function EmptyPets({ onAdd }: { onAdd: () => void }) {
  return <section className="section-wrap account-gate"><span>🐾</span><h1>Tạo hồ sơ cho bé đầu tiên</h1><p>Lưu thông tin cơ bản, lịch tiêm và cấp QR an toàn riêng cho từng bé.</p><button className="primary-button" onClick={onAdd}>+ Tạo hồ sơ pet</button></section>;
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return <article className="product-card">
    <div className={`product-visual tone-${product.visual_tone}`}><span>{product.visual}</span>{product.badge && <b>{product.badge}</b>}<button aria-label={`Yêu thích ${product.name}`}>♡</button></div>
    <div className="product-info"><small>{product.category}</small><h3>{product.name}</h3><p>{product.description}</p><div className="rating-line"><span>★ {product.rating}</span><i>Đã bán {product.sold > 999 ? `${(product.sold / 1000).toFixed(1)}K` : product.sold}</i></div><div className="price-line"><div><strong>{money(product.price)}</strong>{product.original_price && <del>{money(product.original_price)}</del>}</div><button onClick={onAdd} aria-label={`Thêm ${product.name} vào giỏ`}>+</button></div></div>
  </article>;
}

function NearbyView({ type, setType, partners, onBook }: { type: "vet" | "shop"; setType: (value: "vet" | "shop") => void; partners: Partner[]; onBook: (partner: Partner) => void }) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState("");
  const [locationConsentOpen, setLocationConsentOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const distance = (partner: Partner) => {
    if (!userLocation) return partner.distance_km;
    const toRad = (value: number) => value * Math.PI / 180;
    const [lat1, lon1] = userLocation;
    const a = Math.sin(toRad(partner.latitude - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(partner.latitude)) * Math.sin(toRad(partner.longitude - lon1) / 2) ** 2;
    return Math.round((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 10) / 10;
  };
  const sortedPartners = [...partners].sort((a, b) => distance(a) - distance(b));
  const locate = () => {
    setLocationError("");
    if (!navigator.geolocation) { setLocationError("Thiết bị không hỗ trợ định vị."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => { setUserLocation([position.coords.latitude, position.coords.longitude]); setLocating(false); },
      (error) => {
        setLocating(false);
        setLocationError(error.code === error.PERMISSION_DENIED ? "Bạn chưa cho phép dùng vị trí. Có thể bật lại trong cài đặt của trình duyệt." : "Chưa thể lấy vị trí. Vui lòng thử lại.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 },
    );
  };
  return <><section className="section-wrap nearby-page">
    <div className="page-heading"><span className="eyebrow">Cập nhật trực tiếp từ đối tác</span><h1>Chăm bé, ngay gần bạn.</h1><p>Chỉ đường đến cơ sở phù hợp và biết chính xác nơi nào đang hoạt động.</p></div>
    <div className="segmented"><button className={type === "vet" ? "active" : ""} onClick={() => setType("vet")}>✚ Thú y gần nhất</button><button className={type === "shop" ? "active" : ""} onClick={() => setType("shop")}>♧ Pet shop gần nhất</button></div>
    <div className="nearby-layout">
      <div className="partner-list">{sortedPartners.map((partner, index) => <article className="partner-card" key={partner.id}><div className="partner-number">{index + 1}</div><div className="partner-main"><div className="partner-title"><h3>{partner.name} {partner.verified ? <span title="Đã xác minh">✓</span> : null}</h3><span className={partner.open_now ? "status-open" : "status-closed"}>{partner.open_now ? "Đang mở" : "Đã đóng"}</span></div><p>{partner.address}</p><div className="partner-meta"><span>★ {partner.rating} ({partner.review_count})</span><span>⌖ {distance(partner)} km</span><span>{partner.hours}</span></div><div className="service-tags">{partner.services.split("|").map((service) => <span key={service}>{service}</span>)}</div><div className="partner-actions"><a className="secondary-button" href={`https://www.google.com/maps/dir/?api=1&destination=${partner.latitude},${partner.longitude}`} target="_blank" rel="noreferrer">Chỉ đường</a>{type === "vet" && <button className="primary-button small" onClick={() => onBook(partner)} disabled={!partner.accepting_appointments}>{partner.accepting_appointments ? "Đặt lịch khám" : "Chưa nhận lịch"}</button>}</div></div></article>)}</div>
      <div className="map-card real-map"><NearbyMap partners={sortedPartners} userLocation={userLocation}/><button className="map-locate" onClick={() => userLocation ? locate() : setLocationConsentOpen(true)} disabled={locating}>⌖ {locating ? "Đang lấy vị trí..." : userLocation ? "Cập nhật vị trí" : "Dùng vị trí của tôi"}</button>{locationError && <span className="map-location-error">{locationError}</span>}<div className="map-legend"><span><i className="open-dot"/> Đang mở</span><span><i className="closed-dot"/> Đã đóng</span></div></div>
    </div>
  </section>{locationConsentOpen && <ModalShell title="Cho phép PetCare dùng vị trí?" onClose={() => setLocationConsentOpen(false)} className="location-consent-modal"><div className="location-consent-icon">⌖</div><p>PetCare chỉ dùng tọa độ hiện tại để xếp hạng thú y và pet shop gần bạn. Vị trí được tính ngay trên thiết bị, không gửi lên máy chủ và không lưu vào hồ sơ.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setLocationConsentOpen(false)}>Không dùng</button><button className="primary-button small" onClick={() => { setLocationConsentOpen(false); locate(); }}>Cho phép và tìm gần tôi</button></div><small className="secure-note">Bạn có thể thu hồi quyền vị trí bất cứ lúc nào trong cài đặt trình duyệt.</small></ModalShell>}</>;
}

function PetsView({ data, pet, selectedPetId, onSelectPet, onShowQr, onBook, onAdd, onEdit, onRotateQr }: { data: AppData; pet: Pet; selectedPetId: string; onSelectPet: (id: string) => void; onShowQr: (pet: Pet) => void; onBook: () => void; onAdd: () => void; onEdit: () => void; onRotateQr: () => void }) {
  const vaccinations = data.vaccinations.filter((item) => item.pet_id === pet.id);
  const records = data.medicalRecords.filter((item) => item.pet_id === pet.id);
  const age = Math.max(0, new Date().getFullYear() - new Date(pet.date_of_birth).getFullYear());
  return <section className="section-wrap pets-page">
    <div className="pet-page-head"><div><span className="eyebrow">Sổ sức khỏe điện tử</span><h1>Hồ sơ của các bé</h1></div><button className="primary-button small" onClick={onAdd}>+ Thêm hồ sơ</button></div>
    <div className="pet-selector">{data.pets.map((item) => <button key={item.id} className={selectedPetId === item.id ? "active" : ""} onClick={() => onSelectPet(item.id)}><span>{item.avatar}</span><b>{item.name}</b><small>{item.breed}</small></button>)}<button className="add-pet" onClick={onAdd}><span>+</span><b>Thêm bé</b></button></div>
    <div className="pet-dashboard">
      <aside className="pet-profile-card"><div className="pet-avatar-large">{pet.avatar}<i>✓</i></div><h2>{pet.name}</h2><p>{pet.breed} · {pet.sex}</p><div className="pet-stats"><div><b>{age}</b><small>Tuổi</small></div><div><b>{pet.weight_kg}</b><small>Kg</small></div><div><b>{pet.blood_type ?? "—"}</b><small>Nhóm máu</small></div></div><div className="info-list"><span><i>⌁</i><b>Microchip</b><em>{pet.microchip ?? "Chưa có"}</em></span><span><i>!</i><b>Dị ứng</b><em>{pet.allergies || "Không ghi nhận"}</em></span><span><i>♡</i><b>Ghi chú</b><em>{pet.notes}</em></span></div><div className="pet-profile-actions"><button className="secondary-button" onClick={onEdit}>Chỉnh sửa hồ sơ</button><button className="qr-button" onClick={() => onShowQr(pet)}>▦ Hiện QR hồ sơ</button><button className="pet-rotate-qr" onClick={onRotateQr}>Thu hồi & tạo QR mới</button></div><small className="privacy-note">QR chỉ chia sẻ thông tin an toàn khi khẩn cấp</small></aside>
      <div className="health-content">
        <div className="health-summary"><div><span className="summary-icon mint">✓</span><p><small>Tình trạng sức khỏe</small><b>Ổn định</b><em>Cập nhật từ Happy Paws</em></p></div><div><span className="summary-icon peach">♢</span><p><small>Mũi sắp tới</small><b>Vaccine 7 bệnh</b><em>Hạn {dateText("2026-09-12")}</em></p></div><button onClick={onBook}>Đặt lịch tái khám →</button></div>
        <section className="record-panel"><div className="panel-heading"><div><h2>Lịch sử tiêm phòng</h2><p>Thông tin được xác nhận bởi cơ sở thú y</p></div><span className="verified-label">✓ Đã xác thực</span></div><div className="timeline">{vaccinations.map((item) => <div className="timeline-row" key={item.id}><span className={item.status}/><div><b>{item.vaccine_name}</b><small>{item.dose} · Lô {item.batch_number}</small></div><p><b>{dateText(item.administered_at)}</b><small>{item.provider_name}</small></p><em className={`vaccine-status ${item.status}`}>{item.status === "completed" ? "Đã tiêm" : item.status === "due" ? "Sắp đến hạn" : "Quá hạn"}</em></div>)}</div></section>
        <section className="record-panel"><div className="panel-heading"><div><h2>Lịch sử khám bệnh</h2><p>Tự động cập nhật sau mỗi lần khám</p></div></div>{records.map((record) => <article className="medical-card" key={record.id}><div className="medical-date"><b>{new Date(record.visited_at).getDate()}</b><span>THG {new Date(record.visited_at).getMonth() + 1}</span></div><div><h3>{record.diagnosis}</h3><p>{record.treatment}</p><div className="medical-meta"><span>✚ {record.partner_name}</span><span>♙ {record.clinician}</span></div>{record.prescription && <small><b>Đơn thuốc:</b> {record.prescription}</small>}</div><button aria-label="Xem chi tiết hồ sơ">›</button></article>)}</section>
      </div>
    </div>
  </section>;
}

function AppointmentsView({ data, onFindVet }: { data: AppData; onFindVet: () => void }) {
  return <section className="section-wrap appointments-page"><div className="pet-page-head"><div><span className="eyebrow">Theo dõi từ lúc gửi đến khi khám</span><h1>Lịch khám của bé</h1></div><button className="primary-button small" onClick={onFindVet}>+ Đặt lịch mới</button></div><div className="appointment-grid">{data.appointments.map((item) => { const when = getVietnamDateParts(item.scheduled_at); return <article className="appointment-card" key={item.id}><div className="appointment-date"><b>{when?.day ?? "—"}</b><span>Tháng {when?.month ?? "—"}</span><small>{formatVietnamTime(item.scheduled_at)}</small></div><div className="appointment-content"><div><span className={`appointment-status ${item.status}`}>{item.status === "pending" ? "Chờ duyệt" : item.status === "confirmed" ? "Đã xác nhận" : item.status === "completed" ? "Đã khám" : "Đã hủy"}</span><h2>{item.reason}</h2><p>{item.partner_name}</p></div><div className="appointment-pet"><span>{data.pets.find((pet) => pet.id === item.pet_id)?.avatar ?? "🐾"}</span><p><b>{item.pet_name}</b><small>{item.note}</small></p></div><div className="appointment-actions"><button className="secondary-button">Xem chi tiết</button><a className="text-button" href={`tel:${data.partners.find((partner) => partner.id === item.partner_id)?.phone ?? ""}`}>Gọi phòng khám</a></div></div></article>; })}{!data.appointments.length && <div className="empty-state"><span>▣</span><h3>Chưa có lịch khám</h3><p>Tìm cơ sở đang mở và chọn giờ phù hợp cho bé.</p><button className="primary-button small" onClick={onFindVet}>Tìm thú y gần tôi</button></div>}</div></section>;
}

function OrdersView({ orders, onShop }: { orders: Order[]; onShop: () => void }) {
  const labels: Record<Order["status"], string> = { pending_payment: "Chờ thanh toán", payment_review: "Chờ đối soát", paid: "Đã thanh toán", cancelled: "Đã hủy", fulfilled: "Đã hoàn tất" };
  return <section className="section-wrap orders-page"><div className="pet-page-head"><div><span className="eyebrow">Theo dõi thanh toán và giao hàng</span><h1>Đơn hàng của tôi</h1></div><button className="primary-button small" onClick={onShop}>Tiếp tục mua sắm</button></div><div className="customer-orders">{orders.map((order) => <article key={order.id}><header><div><small>Mã đơn</small><b>{order.order_code}</b></div><span className={`order-status ${order.status}`}>{labels[order.status]}</span></header><p>{order.partner_name}</p><div className="order-lines">{order.items?.map((item) => <span key={item.id}><b>{item.product_name}</b><em>{item.quantity} × {money(item.unit_price)}</em></span>)}</div><footer><small>{dateTimeText(order.created_at)}</small><strong>{money(order.total_amount)}</strong></footer></article>)}{!orders.length && <div className="empty-state"><span>◇</span><h3>Chưa có đơn hàng</h3><p>Sản phẩm bạn mua sẽ được lưu và đồng bộ với cửa hàng tại đây.</p><button className="primary-button small" onClick={onShop}>Khám phá cửa hàng</button></div>}</div></section>;
}

function ModalShell({ title, onClose, children, className = "" }: { title: string; onClose: () => void; children: React.ReactNode; className?: string }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div className={`modal-card ${className}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button onClick={onClose} aria-label="Đóng">×</button></div>{children}</div></div>;
}

function BookingModal({ partner, pets, onClose, onSuccess }: { partner: Partner; pets: Pet[]; onClose: () => void; onSuccess: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [minimumDateTime] = useState(() => new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget); const scheduled = String(form.get("scheduledAt") ?? "");
    try { const response = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createAppointment", partnerId: partner.id, petId: form.get("petId"), scheduledAt: new Date(scheduled).toISOString(), reason: form.get("reason"), note: form.get("note") }) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error ?? "Không thể đặt lịch"); onSuccess(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể đặt lịch"); } finally { setBusy(false); }
  };
  return <ModalShell title="Đặt lịch khám" onClose={onClose}><div className="booking-clinic"><span>✚</span><div><b>{partner.name}</b><small>{partner.address}</small></div><em>Đang nhận lịch</em></div><form className="booking-form" onSubmit={submit}><label>Bé cần khám<select name="petId" required>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name} · {pet.breed}</option>)}</select></label><label>Ngày và giờ<input name="scheduledAt" type="datetime-local" min={minimumDateTime} required /></label><label>Lý do khám<select name="reason" required><option>Khám tổng quát</option><option>Tiêm phòng</option><option>Khám da liễu</option><option>Tái khám</option><option>Khác</option></select></label><label>Ghi chú cho bác sĩ<textarea name="note" maxLength={500} placeholder="Triệu chứng, thời gian xuất hiện..." /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Để sau</button><button className="primary-button small" disabled={busy}>{busy ? "Đang gửi..." : "Gửi yêu cầu đặt lịch"}</button></div><small className="secure-note">🔒 Phòng khám chỉ thấy hồ sơ của bé sau khi bạn đặt lịch.</small></form></ModalShell>;
}

function PetFormModal({ pet, onClose, onSuccess }: { pet: Pet | null; onClose: () => void; onSuccess: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    try { const response = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: pet ? "updatePet" : "createPet", petId: pet?.id, petName: form.get("petName"), species: form.get("species"), breed: form.get("breed"), sex: form.get("sex"), dateOfBirth: form.get("dateOfBirth"), weightKg: Number(form.get("weightKg")), bloodType: form.get("bloodType"), microchip: form.get("microchip"), allergies: form.get("allergies"), petNotes: form.get("petNotes") }) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error ?? "Không thể lưu hồ sơ"); onSuccess(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể lưu hồ sơ"); } finally { setBusy(false); }
  };
  return <ModalShell title={pet ? `Chỉnh sửa hồ sơ · ${pet.name}` : "Thêm hồ sơ cho bé"} onClose={onClose}><form className="booking-form pet-form" onSubmit={submit}><label>Tên của bé<input name="petName" required maxLength={80} placeholder="Bông" defaultValue={pet?.name} /></label><label>Loài<select name="species" required defaultValue={pet?.species ?? "Chó"}><option>Chó</option><option>Mèo</option><option>Thỏ</option><option>Khác</option></select></label><label>Giống<input name="breed" required maxLength={100} placeholder="Poodle Toy" defaultValue={pet?.breed} /></label><label>Giới tính<select name="sex" required defaultValue={pet?.sex ?? "Đực"}><option>Đực</option><option>Cái</option><option>Chưa xác định</option></select></label><label>Ngày sinh<input name="dateOfBirth" type="date" max={new Date().toISOString().slice(0,10)} required defaultValue={pet?.date_of_birth} /></label><label>Cân nặng (kg)<input name="weightKg" type="number" min="0.1" max="250" step="0.1" required defaultValue={pet?.weight_kg} /></label><label>Nhóm máu<input name="bloodType" maxLength={40} defaultValue={pet?.blood_type ?? ""} placeholder="DEA 1.1-" /></label><label>Microchip<input name="microchip" maxLength={80} defaultValue={pet?.microchip ?? ""} /></label><label className="wide-field">Dị ứng<textarea name="allergies" maxLength={300} placeholder="Thực phẩm, thuốc, môi trường..." defaultValue={pet?.allergies} /></label><label className="wide-field">Ghi chú riêng tư<textarea name="petNotes" maxLength={500} placeholder="Tính cách, màu lông, đặc điểm dễ nhận ra" defaultValue={pet?.notes} /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button small" disabled={busy}>{busy ? "Đang lưu..." : pet ? "Lưu thay đổi" : "Tạo hồ sơ & QR"}</button></div><small className="secure-note">🔒 Ghi chú riêng tư không xuất hiện trên thẻ QR công khai.</small></form></ModalShell>;
}

function CartDrawer({ lines, total, busy, onClose, onChange, onCheckout }: { lines: Array<{ product: Product; quantity: number }>; total: number; busy: boolean; onClose: () => void; onChange: (id: string, delta: number) => void; onCheckout: () => void }) {
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><aside className="cart-drawer"><div className="modal-head"><div><span className="eyebrow">Quà cho boss</span><h2>Túi hàng của bạn</h2></div><button onClick={onClose}>×</button></div><div className="cart-lines">{lines.map(({ product, quantity }) => <div className="cart-line" key={product.id}><span className={`tone-${product.visual_tone}`}>{product.visual}</span><div><b>{product.name}</b><small>{money(product.price)}</small><div className="quantity"><button onClick={() => onChange(product.id, -1)}>−</button><b>{quantity}</b><button onClick={() => onChange(product.id, 1)}>+</button></div></div></div>)}{!lines.length && <div className="empty-state compact"><span>🛍️</span><h3>Túi hàng đang trống</h3><p>Chọn vài món boss mê nhé.</p></div>}</div><div className="cart-summary"><span>Tạm tính <b>{money(total)}</b></span><span>Phí giao hàng <b>{total >= 299000 ? "Miễn phí" : "Tính ở bước sau"}</b></span><hr/><span className="cart-total">Tổng cộng <b>{money(total)}</b></span><button className="primary-button checkout" disabled={!lines.length || busy} onClick={onCheckout}>{busy ? "Đang tạo đơn..." : "Tạo đơn & thanh toán →"}</button><small>🔒 Tổng tiền được backend tính lại từ database</small></div></aside></div>;
}

function QrModal({ pet, onClose }: { pet: Pet; onClose: () => void }) {
  const [src, setSrc] = useState("");
  useEffect(() => { void QRCode.toDataURL(`${window.location.origin}/pet/${encodeURIComponent(pet.qr_token)}`, { width: 340, margin: 2, color: { dark: "#17253d", light: "#ffffff" }, errorCorrectionLevel: "H" }).then(setSrc); }, [pet.qr_token]);
  return <ModalShell title={`QR hồ sơ của ${pet.name}`} onClose={onClose} className="qr-modal"><div className="qr-pet"><span>{pet.avatar}</span><div><b>{pet.name}</b><small>{pet.breed} · {pet.sex}</small></div></div><div className="qr-box">{src ? <img src={src} alt={`Mã QR mở hồ sơ an toàn của ${pet.name}`} /> : <div className="qr-loading">Đang tạo QR...</div>}</div><p>Quét để xem thẻ khẩn cấp, tình trạng tiêm phòng và cách liên hệ với chủ nuôi. Microchip được che bớt để bảo vệ riêng tư.</p><div className="privacy-pill">🔒 Liên kết riêng · Có thể thu hồi</div></ModalShell>;
}

function CheckoutModal({ order, onClose, onSuccess }: { order: CheckoutOrder; onClose: () => void; onSuccess: () => void }) {
  const [src, setSrc] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { const payload = `PETCARE|${PAYMENT_CONFIG.bankCode}|${PAYMENT_CONFIG.accountNumber.replace(/\s/g, "")}|${order.total}|${order.orderCode}`; void QRCode.toDataURL(payload, { width: 320, margin: 2, color: { dark: "#17253d", light: "#ffffff" } }).then(setSrc); }, [order.orderCode, order.total]);
  const paymentSent = async () => { setBusy(true); setError(""); try { const response = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "markOrderPaymentSent", orderId: order.id }) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error ?? "Không thể cập nhật thanh toán"); onSuccess(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể cập nhật thanh toán"); } finally { setBusy(false); } };
  return <ModalShell title="Thanh toán QR" onClose={onClose} className="checkout-modal"><div className="payment-total"><small>Số tiền do backend xác nhận</small><b>{money(order.total)}</b><span>Mã đơn {order.orderCode}</span></div><div className="qr-box payment">{src && <img src={src} alt="Mã QR thanh toán đơn hàng" />}</div><div className="bank-info"><span>Ngân hàng <b>{PAYMENT_CONFIG.bankCode}</b></span><span>Số tài khoản <b>{PAYMENT_CONFIG.accountNumber}</b></span><span>Chủ tài khoản <b>{PAYMENT_CONFIG.accountName}</b></span></div><p className="payment-note">Đơn đã được lưu trong database. Nút bên dưới chỉ báo “đã chuyển khoản”; cửa hàng hoặc webhook phải đối soát trước khi chuyển sang đã thanh toán.</p>{error && <p className="form-error">{error}</p>}<button className="primary-button checkout" disabled={busy} onClick={() => void paymentSent()}>{busy ? "Đang gửi..." : "Tôi đã chuyển khoản — gửi đối soát"}</button></ModalShell>;
}
