/* Auth endpoints require full navigation; QR images are generated data URLs. */
/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { catalogProducts } from "./catalog";
import NearbyView from "./nearby-view";
import { BRAND, FALLBACK_DATA } from "./config";
import { formatVietnamDate, formatVietnamDateTime, formatVietnamTime, formatVnd, getVietnamDateParts } from "./format";
import type { AppData, Order, Partner, Pet, Product } from "./types";

type View = "shop" | "nearby" | "pets" | "appointments" | "orders";
type Delivery = { recipientName: string; recipientPhone: string; shippingAddress: string; paymentMethod: string };
type CheckoutOrder = { id: string; orderCode: string; total: number; status: string };

const money = formatVnd;
const dateText = formatVietnamDate;
const dateTimeText = formatVietnamDateTime;
const SIGN_IN_PATH = "/auth/signin?return_to=%2F";
const SIGN_OUT_PATH = "/auth/signout?return_to=%2F";
const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
const CATEGORY_FILTERS: Record<string, string[]> = {
  "Tất cả": [],
  "Thực phẩm": ["Thức ăn", "Thực phẩm"],
  "Thời trang": ["Phụ kiện", "Thời trang"],
  "Sức khỏe": ["Chăm sóc", "Thuốc thú y", "Sức khỏe"],
  "Đồ chơi": ["Đồ chơi"],
};
const CATEGORY_CARDS = [
  { id: "Thực phẩm", icon: "🥣", title: "Thực phẩm", text: "Pate, hạt, snack theo nhu cầu mỗi bé" },
  { id: "Thời trang", icon: "🧣", title: "Boss thời trang", text: "Áo, yếm, phụ kiện dạo phố" },
  { id: "Sức khỏe", icon: "✚", title: "Sức khỏe", text: "Chăm sóc, vệ sinh và đồ thú y" },
  { id: "Đồ chơi", icon: "🧸", title: "Đồ chơi", text: "Giải trí, vận động, giảm stress" },
];
const productInCategory = (product: Product, selected: string) => selected === "Tất cả" || (CATEGORY_FILTERS[selected] ?? [selected]).includes(product.category);

function mergeData(payload: Partial<AppData>): AppData {
  return {
    ...FALLBACK_DATA,
    ...payload,
    products: payload.products ?? [],
    partners: payload.partners ?? [],
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
  const [data, setData] = useState<AppData>({ ...FALLBACK_DATA, products: [], actor: initialActor, requiresSignIn: !initialActor });
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
  const categories = Object.keys(CATEGORY_FILTERS);
  const filteredProducts = useMemo(() => catalogProducts(data.products).filter((product) => {
    const needle = normalizeSearch(search);
    const matchesCategory = Boolean(needle) || productInCategory(product, category);
    const haystack = normalizeSearch(`${product.name} ${product.category} ${product.description} ${product.partner_name ?? ""} ${product.partner_address ?? ""}`);
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
    const product = data.products.find(p => p.id === id);
    if (!product || product.is_sample || !product.active || product.stock < 1) return;
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

  const beginCheckout = async (delivery: Delivery) => {
    if (!data.actor) { setCartOpen(false); setAuthPrompt(true); return; }
    if (!cartLines.length || checkoutBusy) return;
    setCheckoutBusy(true);
    try {
      const response = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createOrder", ...delivery, items: cartLines.map((line) => ({ productId: line.product.id, quantity: line.quantity })) }) });
      const body = await response.json() as CheckoutOrder & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Không thể tạo đơn hàng");
      setCartOpen(false);
      if (body.status === "cod_pending") {
        setCart({}); setView("orders"); setToast("Đã đặt hàng COD. Bạn thanh toán khi nhận hàng.");
      } else { setCheckoutOrder(body); setCheckoutOpen(true); }
      await reload();
    } catch (caught) { setToast(caught instanceof Error ? caught.message : "Không thể tạo đơn hàng"); }
    finally { setCheckoutBusy(false); }
  };

  const actorInitials = data.actor?.fullName.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]?.toUpperCase()).join("") || "TK";
  const openCategory = (id: string) => {
    setCategory(id);
    setView("shop");
    window.requestAnimationFrame(() => document.getElementById("best-sellers")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

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
          <button className={view === "nearby" ? "active" : ""} onClick={() => navigate("nearby")}>Gần bạn</button>
          <button className={view === "pets" ? "active" : ""} onClick={() => navigate("pets")}>Hồ sơ pet</button>
          <button className={view === "appointments" ? "active" : ""} onClick={() => navigate("appointments")}>Lịch khám</button>
        </nav>
        <div className="header-actions">
          <a className="partner-link" href="/partner">Dành cho đối tác</a>
          <button className="icon-button" onClick={() => navigate("appointments")} aria-label="Lịch khám">♡</button>
          <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Giỏ hàng có ${cartCount} sản phẩm`}>Túi <b>{cartCount}</b></button>
          {data.actor ? <div className="account-session"><button className="avatar-button" aria-label="Mở thông tin phiên đăng nhập" aria-expanded={accountOpen} onClick={() => setAccountOpen((value) => !value)}>{actorInitials}</button>{accountOpen && <div className="account-menu"><b>{data.actor.fullName}</b><small>{data.actor.email}</small><span>🔒 {data.actor.isDemo ? "Phiên demo cục bộ" : "Tài khoản PetCare đã đồng bộ"}</span><button onClick={() => { setAccountOpen(false); navigate("orders"); }}>Đơn hàng của tôi</button>{data.actor.isDemo ? <button onClick={() => setAccountOpen(false)}>Đóng</button> : <form action={SIGN_OUT_PATH} method="post"><button type="submit">Đăng xuất</button></form>}</div>}</div> : <div className="guest-auth"><a className="account-login" href={SIGN_IN_PATH}>Đăng nhập</a><a className="account-register" href={SIGN_IN_PATH}>Đăng ký</a></div>}
        </div>
      </header>
      <section className="section-wrap category-showcase top-category-nav" aria-label="Danh mục chính">
        {CATEGORY_CARDS.map((item) => <button key={item.id} className={view === "shop" && category === item.id ? "active" : ""} onClick={() => openCategory(item.id)}>
          <span>{item.icon}</span>
          <b>{item.title}</b>
          <small>{item.text}</small>
        </button>)}
      </section>

      <main>
        {view === "shop" && <ShopView products={filteredProducts} categories={categories} category={category} setCategory={setCategory} addToCart={addToCart} onNearby={() => navigate("nearby")} />}
        {view === "nearby" && <NearbyView type={nearbyType} setType={setNearbyType} partners={nearbyPartners} onBook={requestBooking} />}
        {view === "pets" && (!data.actor ? <SignInGate title="Đăng nhập hoặc đăng ký để mở hồ sơ pet" text="Hồ sơ sức khỏe, QR và lịch tiêm chỉ hiển thị cho đúng chủ nuôi." /> : selectedPet ? <PetsView data={data} pet={selectedPet} selectedPetId={effectiveSelectedPetId} onSelectPet={setSelectedPetId} onShowQr={setQrPet} onBook={() => navigate("nearby")} onAdd={() => openPetForm()} onEdit={() => openPetForm(selectedPet)} onRotateQr={() => void rotatePetQr(selectedPet)} /> : <EmptyPets onAdd={() => openPetForm()} />)}
        {view === "appointments" && (data.actor ? <AppointmentsView data={data} onFindVet={() => navigate("nearby")} /> : <SignInGate title="Đăng nhập để xem lịch khám" text="PetCare cần xác nhận đúng chủ nuôi trước khi hiển thị lịch hẹn." />)}
        {view === "orders" && (data.actor ? <OrdersView orders={data.orders} onPay={(order) => { setCheckoutOrder({ id: order.id, orderCode: order.order_code, total: order.total_amount, status: order.status }); setCheckoutOpen(true); }} onShop={() => navigate("shop")} /> : <SignInGate title="Đăng nhập để xem đơn hàng" text="Đơn hàng và trạng thái thanh toán chỉ hiển thị cho đúng tài khoản." />)}
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

      {cartOpen && <CartDrawer lines={cartLines} total={cartTotal} busy={checkoutBusy} onClose={() => setCartOpen(false)} onChange={(id, delta) => setCart((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + delta) }))} onCheckout={(delivery) => void beginCheckout(delivery)} />}
      {bookingPartner && <BookingModal partner={bookingPartner} pets={data.pets} onClose={() => setBookingPartner(null)} onSuccess={async () => { setBookingPartner(null); setToast("Đã gửi yêu cầu. Phòng khám sẽ xác nhận sớm!"); await reload(); setView("appointments"); }} />}
      {qrPet && <QrModal pet={qrPet} onClose={() => setQrPet(null)} />}
      {checkoutOpen && checkoutOrder && <CheckoutModal order={checkoutOrder} onClose={() => setCheckoutOpen(false)} onSuccess={async () => { setCheckoutOpen(false); setCheckoutOrder(null); setCart({}); setToast("Đơn hàng đang chờ cửa hàng đối soát thanh toán."); await reload(); setView("orders"); }} />}
      {petFormOpen && <PetFormModal pet={petFormPet} onClose={() => { setPetFormOpen(false); setPetFormPet(null); }} onSuccess={async () => { setPetFormOpen(false); setPetFormPet(null); setToast(petFormPet ? "Đã cập nhật hồ sơ của bé." : "Đã tạo hồ sơ mới và cấp QR riêng cho bé."); await reload(); }} />}
      {authPrompt && <ModalShell title="Đăng nhập để đặt lịch" onClose={() => setAuthPrompt(false)} className="auth-prompt-modal"><div className="auth-shield">🔒</div><p>Đăng nhập giúp phòng khám nhận đúng hồ sơ pet và ngăn người khác đặt lịch thay bạn.</p><a className="primary-button small" href={SIGN_IN_PATH}>Đăng nhập</a><button className="text-button" onClick={() => setAuthPrompt(false)}>Tiếp tục xem trước</button></ModalShell>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function ShopView({ products, categories, category, setCategory, addToCart, onNearby }: { products: Product[]; categories: string[]; category: string; setCategory: (value: string) => void; addToCart: (id: string) => void; onNearby: () => void }) {
  const [shop, setShop] = useState("all");
  const [sort, setSort] = useState("suggested");
  const shops = [...new Set(products.map(p => p.partner_name).filter((name): name is string => Boolean(name)))];
  const visibleProducts = products.filter(p => shop === "all" || p.partner_name === shop).sort((a,b) => sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : 0);
  return <>
    <section className="hero section-wrap">
      <div className="hero-copy">
        <span className="eyebrow">Tụi mình chọn kỹ, boss mê ly</span>
        <h1 className="petcare-title">PetCare</h1>
        <p className="hero-tagline">Đầy túi quà, đầy ắp yêu thương. Từ bữa ăn ngon đến chăm sóc sức khỏe, mọi điều tốt nhất cho bé đều ở đây.</p>
        <div className="hero-actions"><a href="#best-sellers" className="primary-button">Xem gợi ý <span>→</span></a><button className="text-button" onClick={onNearby}>Tìm thú y gần tôi <span>⌖</span></button></div>
        <div className="trust-row"><span>Ảnh sản phẩm thực tế</span><span>Giá tham khảo có nguồn</span></div>
      </div>
      <div className="hero-art" aria-label="Miso đang vui bên quà tặng">
        <div className="hero-blob"><img className="hero-pet pet-photo" src="/images/pets/golden-retriever.jpg" alt="Chó Golden Retriever với bộ lông vàng" width={900} height={900} fetchPriority="high" /><span className="spark spark-one">✦</span><span className="spark spark-two">♥</span></div>
        <div className="floating-card float-food"><span>🥣</span><div><b>Bữa ngon mỗi ngày</b><small>Đủ dinh dưỡng</small></div></div>
        <div className="floating-card float-care"><span>✚</span><div><b>Chăm sóc gần bạn</b><small>Đặt lịch trong 1 phút</small></div></div>
      </div>
    </section>

    <section className="benefit-strip section-wrap"><div><span>♢</span><b>Ảnh thực tế</b><small>Xem rõ từng sản phẩm</small></div><div><span>⚡</span><b>Giá có nguồn</b><small>Đối chiếu tại cửa hàng</small></div><div><span>♧</span><b>Chọn theo từng bé</b><small>Gợi ý đúng nhu cầu</small></div><div><span>♡</span><b>Thông tin shop</b><small>Tên và địa chỉ rõ ràng</small></div></section>

    <section className="section-wrap product-section" id="best-sellers">
      <div className="section-heading"><div><span className="eyebrow">Khám phá theo nhu cầu của bé</span><h2>Gợi ý hôm nay</h2></div><span className="catalog-count">{visibleProducts.length} sản phẩm</span></div>
      <aside className="owner-shop-notice"><strong>SẢN PHẨM CỦA CHÍNH CHỦ TRANG WEB</strong><p>Áo quần chó mèo do PetCare bán trực tiếp · Giá 30.000–70.000đ · Đặt hàng và thanh toán khi nhận hàng (COD). Ảnh minh họa kiểu dáng.</p></aside><div className="catalog-notice"><b>Khám phá sản phẩm từ các shop</b><p>Các thẻ “Tham khảo” dùng ảnh thật và giá niêm yết có nguồn; các mẫu mới được cập nhật ngày 26/10/2026. Shop chưa đăng bán trên PetCare; giá có thể thay đổi và chưa xác nhận tồn kho từng chi nhánh. Bạn có thể xem giá tại nguồn, chưa đặt hàng các món này trong ứng dụng.</p></div><div className="category-row">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="catalog-toolbar"><label>Cửa hàng<select value={shop} onChange={e => setShop(e.target.value)}><option value="all">Tất cả cửa hàng</option>{shops.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label>Sắp xếp<select value={sort} onChange={e => setSort(e.target.value)}><option value="suggested">Gợi ý</option><option value="low">Giá thấp đến cao</option><option value="high">Giá cao đến thấp</option></select></label></div><div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={() => addToCart(product.id)} />)}</div>
      {!visibleProducts.length && <div className="empty-state"><span>⌕</span><h3>Chưa thấy món phù hợp</h3><p>Thử từ khóa hoặc nhóm sản phẩm khác nhé.</p></div>}
    </section>

    <section className="section-wrap care-banner"><div><span className="eyebrow">PetCare 360</span><h2>Không chỉ mua sắm.<br/>Còn là bình an.</h2><p>Xem cơ sở đang mở, đặt lịch và giữ hồ sơ sức khỏe của bé trong một nơi.</p><button className="light-button" onClick={onNearby}>Khám phá gần bạn →</button></div><div className="care-orbit"><img className="care-pet pet-photo" src="/images/pets/golden-outdoors.jpg" alt="Chó Golden Retriever vui chơi ngoài trời" width={700} height={700} loading="lazy" /><i>✚</i><i>⌖</i><i>♡</i></div></section>
  </>;
}

function SignInGate({ title, text }: { title: string; text: string }) {
  return <section className="section-wrap account-gate"><span>🔒</span><h1>{title}</h1><p>{text}</p><a className="primary-button" href={SIGN_IN_PATH}>Đăng nhập <span>→</span></a><small>Đăng nhập bằng username và mật khẩu, hoặc tài khoản Google.</small></section>;
}

function EmptyPets({ onAdd }: { onAdd: () => void }) {
  return <section className="section-wrap account-gate"><span>🐾</span><h1>Tạo hồ sơ cho bé đầu tiên</h1><p>Lưu thông tin cơ bản, lịch tiêm và cấp QR an toàn riêng cho từng bé.</p><button className="primary-button" onClick={onAdd}>+ Tạo hồ sơ pet</button></section>;
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <article className={`product-card marketplace-card ${product.is_sample ? "sample-card" : ""}`}>
    <div className={`product-visual tone-${product.visual_tone}`}>
      {product.image_url && !imageFailed ? <img src={product.image_url} alt={product.name} loading="lazy" width={400} height={400} onError={() => setImageFailed(true)} /> : <span>{product.visual}</span>}
      {product.badge && <b>{product.badge}</b>}
    </div>
    <div className="product-info">{product.is_owner_product && <strong className="owner-product-label">Sản phẩm của chính chủ trang web</strong>}<small>{product.category}</small><h3>{product.name}</h3>
      {!product.is_sample && <p>{product.description}</p>}
      {!product.is_sample && product.sold > 0 && <div className="rating-line"><span>{product.rating > 0 ? `★ ${product.rating}` : ""}</span><i>Đã bán {product.sold}</i></div>}
      <div className="price-line"><div>{product.is_owner_draft ? <small>Giá đề xuất · Chưa mở bán</small> : product.is_sample && <small>Giá tham khảo</small>}<strong>{money(product.price)}</strong>{product.original_price && <del>{money(product.original_price)}</del>}</div>{!product.is_sample && !product.is_owner_draft && <button onClick={onAdd} aria-label={`Thêm ${product.name} vào giỏ`}>+</button>}</div>
      <div className="product-seller"><b>▣ {product.partner_name || "Cửa hàng PetCare"}</b><span>⌖ {product.partner_address || "Địa chỉ đang cập nhật"}</span></div>
      {product.is_owner_draft && <p className="owner-draft-status">Ảnh minh họa · Chờ cập nhật tồn kho</p>}{product.is_sample && <a className="product-source" href={product.source_url} target="_blank" rel="noreferrer">Xem tại shop ↗</a>}
    </div>
  </article>;
}

function PetsView({ data, pet, selectedPetId, onSelectPet, onShowQr, onBook, onAdd, onEdit, onRotateQr }: { data: AppData; pet: Pet; selectedPetId: string; onSelectPet: (id: string) => void; onShowQr: (pet: Pet) => void; onBook: () => void; onAdd: () => void; onEdit: () => void; onRotateQr: () => void }) {
  const vaccinations = data.vaccinations.filter((item) => item.pet_id === pet.id);
  const records = data.medicalRecords.filter((item) => item.pet_id === pet.id);
  const nextVaccine = vaccinations.find((item) => item.status === "overdue") ?? vaccinations.find((item) => item.status === "due") ?? vaccinations[0];
  const upcomingAppointment = data.appointments.filter((item) => item.pet_id === pet.id && item.status !== "cancelled").sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
  const age = Math.max(0, new Date().getFullYear() - new Date(pet.date_of_birth).getFullYear());
  return <section className="section-wrap pets-page">
    <div className="pet-page-head"><div><span className="eyebrow">Sổ sức khỏe điện tử</span><h1>Hồ sơ của các bé</h1></div><button className="primary-button small" onClick={onAdd}>+ Thêm hồ sơ</button></div>
    <div className="pet-selector">{data.pets.map((item) => <button key={item.id} className={selectedPetId === item.id ? "active" : ""} onClick={() => onSelectPet(item.id)}><span>{item.avatar}</span><b>{item.name}</b><small>{item.breed}</small></button>)}<button className="add-pet" onClick={onAdd}><span>+</span><b>Thêm bé</b></button></div>
    <div className="pet-dashboard">
      <aside className="pet-profile-card"><div className="pet-avatar-large">{pet.avatar}<i>✓</i></div><h2>{pet.name}</h2><p>{pet.breed} · {pet.sex}</p><div className="pet-stats"><div><b>{age}</b><small>Tuổi</small></div><div><b>{pet.weight_kg}</b><small>Kg</small></div><div><b>{pet.blood_type ?? "—"}</b><small>Nhóm máu</small></div></div><div className="info-list"><span><i>⌁</i><b>Microchip</b><em>{pet.microchip ?? "Chưa có"}</em></span><span><i>!</i><b>Dị ứng</b><em>{pet.allergies || "Không ghi nhận"}</em></span><span><i>♡</i><b>Ghi chú</b><em>{pet.notes}</em></span></div><div className="pet-profile-actions"><button className="secondary-button" onClick={onEdit}>Chỉnh sửa hồ sơ</button><button className="qr-button" onClick={() => onShowQr(pet)}>▦ Hiện QR hồ sơ</button><button className="pet-rotate-qr" onClick={onRotateQr}>Thu hồi & tạo QR mới</button></div><small className="privacy-note">QR chỉ chia sẻ thông tin an toàn khi khẩn cấp</small></aside>
      <div className="health-content">
        <div className="health-summary">
          <div><span className="summary-icon mint">✓</span><p><small>Tình trạng sức khỏe</small><b>{records[0]?.diagnosis ?? "Ổn định"}</b><em>{records[0] ? `Cập nhật ${dateText(records[0].visited_at)}` : "Chưa có cảnh báo mới"}</em></p></div>
          <div className={nextVaccine?.status === "overdue" ? "urgent" : ""}><span className={`summary-icon ${nextVaccine?.status === "overdue" ? "danger" : "peach"}`}>♢</span><p><small>{nextVaccine?.status === "overdue" ? "Vaccine cần chú ý" : "Mũi sắp tới"}</small><b>{nextVaccine?.vaccine_name ?? "Chưa có lịch tiêm"}</b><em>{nextVaccine?.next_due_at ? `Hạn ${dateText(nextVaccine.next_due_at)}` : "Thêm hồ sơ tiêm để theo dõi"}</em></p></div>
          <div><span className="summary-icon blue">▣</span><p><small>Lịch khám gần nhất</small><b>{upcomingAppointment ? formatVietnamTime(upcomingAppointment.scheduled_at) : "Chưa có lịch"}</b><em>{upcomingAppointment ? `${dateText(upcomingAppointment.scheduled_at)} · ${upcomingAppointment.partner_name}` : "Đặt lịch với cơ sở gần bạn"}</em></p></div>
          <button onClick={onBook}>Đặt lịch tái khám →</button>
        </div>
        <section className="record-panel"><div className="panel-heading"><div><h2>Lịch sử tiêm phòng</h2><p>Thông tin được xác nhận bởi cơ sở thú y</p></div><span className="verified-label">✓ Đã xác thực</span></div><div className="timeline">{vaccinations.map((item) => <div className="timeline-row" key={item.id}><span className={item.status}/><div><b>{item.vaccine_name}</b><small>{item.dose} · Lô {item.batch_number}</small></div><p><b>{dateText(item.administered_at)}</b><small>{item.provider_name}</small></p><em className={`vaccine-status ${item.status}`}>{item.status === "completed" ? "Đã tiêm" : item.status === "due" ? "Sắp đến hạn" : "Quá hạn"}</em></div>)}</div></section>
        <section className="record-panel"><div className="panel-heading"><div><h2>Lịch sử khám bệnh</h2><p>Tự động cập nhật sau mỗi lần khám</p></div></div>{records.map((record) => <article className="medical-card" key={record.id}><div className="medical-date"><b>{new Date(record.visited_at).getDate()}</b><span>THG {new Date(record.visited_at).getMonth() + 1}</span></div><div><h3>{record.diagnosis}</h3><p>{record.treatment}</p><div className="medical-meta"><span>✚ {record.partner_name}</span><span>♙ {record.clinician}</span></div>{record.prescription && <small><b>Đơn thuốc:</b> {record.prescription}</small>}</div><button aria-label="Xem chi tiết hồ sơ">›</button></article>)}</section>
      </div>
    </div>
  </section>;
}

function AppointmentsView({ data, onFindVet }: { data: AppData; onFindVet: () => void }) {
  return <section className="section-wrap appointments-page"><div className="pet-page-head"><div><span className="eyebrow">Theo dõi từ lúc gửi đến khi khám</span><h1>Lịch khám của bé</h1></div><button className="primary-button small" onClick={onFindVet}>+ Đặt lịch mới</button></div><div className="appointment-grid">{data.appointments.map((item) => { const when = getVietnamDateParts(item.scheduled_at); return <article className="appointment-card" key={item.id}><div className="appointment-date"><b>{when?.day ?? "—"}</b><span>Tháng {when?.month ?? "—"}</span><small>{formatVietnamTime(item.scheduled_at)}</small></div><div className="appointment-content"><div><span className={`appointment-status ${item.status}`}>{item.status === "pending" ? "Chờ duyệt" : item.status === "confirmed" ? "Đã xác nhận" : item.status === "completed" ? "Đã khám" : "Đã hủy"}</span><h2>{item.reason}</h2><p>{item.partner_name}</p></div><div className="appointment-pet"><span>{data.pets.find((pet) => pet.id === item.pet_id)?.avatar ?? "🐾"}</span><p><b>{item.pet_name}</b><small>{item.note}</small></p></div><div className="appointment-actions"><button className="secondary-button">Xem chi tiết</button><a className="text-button" href={`tel:${data.partners.find((partner) => partner.id === item.partner_id)?.phone ?? ""}`}>Gọi phòng khám</a></div></div></article>; })}{!data.appointments.length && <div className="empty-state"><span>▣</span><h3>Chưa có lịch khám</h3><p>Tìm cơ sở đang mở và chọn giờ phù hợp cho bé.</p><button className="primary-button small" onClick={onFindVet}>Tìm thú y gần tôi</button></div>}</div></section>;
}

function OrdersView({ orders, onShop, onPay }: { orders: Order[]; onShop: () => void; onPay: (order: Order) => void }) {
  const labels: Record<Order["status"], string> = { pending_payment: "Chờ thanh toán", payment_review: "Chờ đối soát", paid: "Đã thanh toán", cancelled: "Đã hủy", fulfilled: "Đã hoàn tất", cod_pending: "COD · Chờ shop xác nhận", cod_shipping: "COD · Đang giao hàng" };
  return <section className="section-wrap orders-page"><div className="pet-page-head"><div><span className="eyebrow">Theo dõi thanh toán và giao hàng</span><h1>Đơn hàng của tôi</h1></div><button className="primary-button small" onClick={onShop}>Tiếp tục mua sắm</button></div><div className="customer-orders">{orders.map((order) => <article key={order.id}><header><div><small>Mã đơn</small><b>{order.order_code}</b></div><span className={`order-status ${order.status}`}>{labels[order.status]}</span></header><p>{order.partner_name}</p>{order.payment_method === "cod" && <p>Thanh toán khi nhận hàng · {order.recipient_name} · {order.recipient_phone}<br/>{order.shipping_address}</p>}<div className="order-lines">{order.items?.map((item) => <span key={item.id}><b>{item.product_name}</b><em>{item.quantity} × {money(item.unit_price)}</em></span>)}</div><footer><small>{dateTimeText(order.created_at)}</small><strong>{money(order.total_amount)}</strong></footer>{order.status === "pending_payment" && <button className="primary-button" onClick={() => onPay(order)}>Xem hướng dẫn thanh toán</button>}</article>)}{!orders.length && <div className="empty-state"><span>◇</span><h3>Chưa có đơn hàng</h3><p>Sản phẩm bạn mua sẽ được lưu và đồng bộ với cửa hàng tại đây.</p><button className="primary-button small" onClick={onShop}>Khám phá cửa hàng</button></div>}</div></section>;
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

function CartDrawer({ lines, total, busy, onClose, onChange, onCheckout }: { lines: Array<{ product: Product; quantity: number }>; total: number; busy: boolean; onClose: () => void; onChange: (id: string, delta: number) => void; onCheckout: (delivery: Delivery) => void }) {
  const [recipientName,setRecipientName] = useState("");
  const [recipientPhone,setRecipientPhone] = useState("");
  const [shippingAddress,setShippingAddress] = useState("");
  const cod = lines.length > 0 && lines.every(l=>l.product.cod_enabled);
  const valid = !cod || (recipientName.trim().length >= 2 && /^(0|\+84)[0-9]{9,10}$/.test(recipientPhone.trim()) && shippingAddress.trim().length >= 10);
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><aside className="cart-drawer"><div className="modal-head"><div><span className="eyebrow">Quà cho boss</span><h2>Túi hàng của bạn</h2></div><button onClick={onClose}>×</button></div><div className="cart-lines">{lines.map(({ product, quantity }) => <div className="cart-line" key={product.id}><span className={`tone-${product.visual_tone}`}>{product.visual}</span><div><b>{product.name}</b><small>{money(product.price)}</small><div className="quantity"><button onClick={() => onChange(product.id, -1)}>−</button><b>{quantity}</b><button onClick={() => onChange(product.id, 1)}>+</button></div></div></div>)}{!lines.length && <div className="empty-state compact"><span>🛍️</span><h3>Túi hàng đang trống</h3><p>Chọn vài món boss mê nhé.</p></div>}</div><div className="cart-summary">{cod && <div className="cod-delivery"><h3>Thông tin nhận hàng</h3><label>Họ tên người nhận<input autoComplete="name" value={recipientName} onChange={e=>setRecipientName(e.target.value)} maxLength={120}/></label><label>Số điện thoại<input type="tel" autoComplete="tel" value={recipientPhone} onChange={e=>setRecipientPhone(e.target.value)} maxLength={25}/></label><label>Địa chỉ nhận hàng<textarea autoComplete="street-address" value={shippingAddress} onChange={e=>setShippingAddress(e.target.value)} maxLength={500}/></label><p>Thanh toán khi nhận hàng (COD). Shop xác nhận phí vận chuyển trước khi giao.</p></div>}<span>Tạm tính <b>{money(total)}</b></span><span>Phí giao hàng <b>{"Chưa bao gồm — shop xác nhận riêng"}</b></span><hr/><span className="cart-total">Tổng cộng <b>{money(total)}</b></span><button className="primary-button checkout" disabled={!lines.length || busy || !valid} onClick={()=>onCheckout({recipientName,recipientPhone,shippingAddress,paymentMethod:cod?"cod":"transfer"})}>{busy ? "Đang tạo đơn..." : cod ? "Đặt hàng COD →" : "Tạo đơn & thanh toán →"}</button><small>Thông tin nhận hàng chỉ dành cho bạn và cửa hàng.</small></div></aside></div>;
}

function QrModal({ pet, onClose }: { pet: Pet; onClose: () => void }) {
  const [src, setSrc] = useState("");
  useEffect(() => { void QRCode.toDataURL(`${window.location.origin}/pet/${encodeURIComponent(pet.qr_token)}`, { width: 340, margin: 2, color: { dark: "#17253d", light: "#ffffff" }, errorCorrectionLevel: "H" }).then(setSrc); }, [pet.qr_token]);
  return <ModalShell title={`QR hồ sơ của ${pet.name}`} onClose={onClose} className="qr-modal"><div className="qr-pet"><span>{pet.avatar}</span><div><b>{pet.name}</b><small>{pet.breed} · {pet.sex}</small></div></div><div className="qr-box">{src ? <img src={src} alt={`Mã QR mở hồ sơ an toàn của ${pet.name}`} /> : <div className="qr-loading">Đang tạo QR...</div>}</div><p>Quét để xem thẻ khẩn cấp, tình trạng tiêm phòng và cách liên hệ với chủ nuôi. Microchip được che bớt để bảo vệ riêng tư.</p><div className="privacy-pill">🔒 Liên kết riêng · Có thể thu hồi</div></ModalShell>;
}

function CheckoutModal({ order, onClose, onSuccess }: { order: CheckoutOrder; onClose: () => void; onSuccess: () => void }) {
  const [payment, setPayment] = useState<{bank:{bank:string;accountName:string;accountNumber:string}|null;payable:boolean}|null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { let current=true; void fetch('/api/payment?order='+encodeURIComponent(order.id)).then(async r=>{if(!r.ok)throw Error('Chưa thể tải thông tin thanh toán.');return r.json();}).then(p=>{if(current)setPayment(p);}).catch(()=>{if(current)setError('Chưa thể tải thông tin thanh toán.');});return ()=>{current=false;}; }, [order.id]);
  const paymentSent = async () => { if(!payment?.payable)return;setBusy(true); setError(""); try { const response = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "markOrderPaymentSent", orderId: order.id }) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error ?? "Không thể cập nhật thanh toán"); onSuccess(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể cập nhật thanh toán"); } finally { setBusy(false); } };
  return <ModalShell title="Thanh toán chuyển khoản" onClose={onClose} className="checkout-modal"><div className="payment-total"><small>Giá trị hàng hóa</small><b>{money(order.total)}</b><span>Mã đơn {order.orderCode}</span></div>{payment?.bank ? <div className="bank-info"><span>Ngân hàng <b>{payment.bank.bank}</b></span><span>Số tài khoản <b>{payment.bank.accountNumber}</b></span><span>Chủ tài khoản <b>{payment.bank.accountName}</b></span><span>Nội dung <b>{order.orderCode}</b></span></div> : <p className="location-warning">{payment ? "Shop chưa xác nhận thông tin nhận tiền. Đơn đã lưu; vui lòng chưa chuyển khoản." : "Đang tải thông tin thanh toán…"}</p>}<p className="payment-note">Chuyển đúng số tiền và ghi mã đơn. Sau khi bạn báo đã chuyển, shop sẽ đối soát trước khi xác nhận thanh toán; ứng dụng không tự xác nhận tiền từ ngân hàng.</p>{error && <p className="form-error">{error}</p>}<button className="primary-button checkout" disabled={busy || !payment?.payable} onClick={() => void paymentSent()}>{busy ? "Đang gửi..." : "Tôi đã chuyển khoản — gửi đối soát"}</button></ModalShell>;
}

