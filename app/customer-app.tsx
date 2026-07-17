"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import dynamic from "next/dynamic";
import { BRAND, FALLBACK_DATA, PAYMENT_CONFIG } from "./config";
import { formatVietnamDate, formatVietnamDateTime, formatVietnamTime, formatVnd, getVietnamDateParts } from "./format";
import type { AppData, Order, Partner, Pet, Product } from "./types";

type View = "shop" | "nearby" | "pets" | "appointments" | "orders";
type CheckoutOrder = { id: string; orderCode: string; total: number; status: string };
const NearbyMap = dynamic(() => import("./nearby-map"), { ssr: false, loading: () => <div className="map-loading">Äang táº£i báº£n Ä‘á»“...</div> });

const money = formatVnd;
const dateText = formatVietnamDate;
const dateTimeText = formatVietnamDateTime;
const SIGN_IN_PATH = "/signin-with-chatgpt?return_to=%2F";
const SIGN_OUT_PATH = "/signout-with-chatgpt?return_to=%2F";
const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Ä‘/g, "d").replace(/Ä/g, "D").toLowerCase().trim();

function mergeData(payload: Partial<AppData>): AppData {
  return {
    ...FALLBACK_DATA,
    ...payload,
    products: payload.products ?? FALLBACK_DATA.products,
    partners: payload.partners ?? FALLBACK_DATA.partners,
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
  const [category, setCategory] = useState("Táº¥t cáº£");
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
    } catch { /* Dá»¯ liá»‡u dá»± phÃ²ng váº«n giá»¯ cho giao diá»‡n hoáº¡t Ä‘á»™ng. */ }
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
  const categories = ["Táº¥t cáº£", "Thá»©c Äƒn", "Phá»¥ kiá»‡n", "Äá»“ chÆ¡i", "ChÄƒm sÃ³c"];
  const filteredProducts = useMemo(() => data.products.filter((product) => {
    const needle = normalizeSearch(search);
    const matchesCategory = Boolean(needle) || category === "Táº¥t cáº£" || product.category === category;
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
    setToast("ÄÃ£ thÃªm vÃ o giá» â€” boss sáº¯p cÃ³ quÃ  rá»“i! ðŸ¾");
  };

  const selectSearchProduct = (product: Product) => {
    setSearch(product.name);
    setCategory("Táº¥t cáº£");
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
    if (!window.confirm(`Táº¡o QR má»›i cho ${pet.name}? QR cÅ© sáº½ ngá»«ng hoáº¡t Ä‘á»™ng ngay.`)) return;
    try {
      const response = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rotatePetQr", petId: pet.id }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "KhÃ´ng thá»ƒ táº¡o láº¡i QR");
      setQrPet(null);
      await reload();
      setToast("ÄÃ£ cáº¥p QR má»›i; QR cÅ© Ä‘Ã£ bá»‹ thu há»“i.");
    } catch (caught) { setToast(caught instanceof Error ? caught.message : "KhÃ´ng thá»ƒ táº¡o láº¡i QR"); }
  };

  const beginCheckout = async () => {
    if (!data.actor) { setCartOpen(false); setAuthPrompt(true); return; }
    if (!cartLines.length || checkoutBusy) return;
    setCheckoutBusy(true);
    try {
      const response = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createOrder", items: cartLines.map((line) => ({ productId: line.product.id, quantity: line.quantity })) }) });
      const body = await response.json() as CheckoutOrder & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "KhÃ´ng thá»ƒ táº¡o Ä‘Æ¡n hÃ ng");
      setCheckoutOrder(body);
      setCartOpen(false);
      setCheckoutOpen(true);
      await reload();
    } catch (caught) { setToast(caught instanceof Error ? caught.message : "KhÃ´ng thá»ƒ táº¡o Ä‘Æ¡n hÃ ng"); }
    finally { setCheckoutBusy(false); }
  };

  const actorInitials = data.actor?.fullName.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]?.toUpperCase()).join("") || "TK";

  return (
    <div className="site-shell">
      <div className="announcement"><span>Äá»•i tráº£ trong 7 ngÃ y</span><span>TÆ° váº¥n thÃº y 7:00â€“22:00</span></div>
      <header className="main-header">
        <button className="brand" onClick={() => navigate("shop")} aria-label="Vá» trang mua sáº¯m">
          <span className="brand-mark">P</span><span>{BRAND.name}</span><i>care & shop</i>
        </button>
        <div className="global-search">
          <span>âŒ•</span>
          <input value={search} onChange={(event) => { setSearch(event.target.value); if (event.target.value.trim()) setCategory("Táº¥t cáº£"); }} onFocus={() => setView("shop")} onKeyDown={(event) => { if (event.key === "Enter" && searchSuggestions[0]) selectSearchProduct(searchSuggestions[0]); }} placeholder="TÃ¬m thá»©c Äƒn, Ä‘á»“ chÆ¡i, phá»¥ kiá»‡n..." aria-label="TÃ¬m sáº£n pháº©m" aria-controls="search-suggestions" autoComplete="off" />
          <kbd>âŒ˜ K</kbd>
          {normalizeSearch(search) && <div className="search-suggestions" id="search-suggestions" role="listbox" aria-label="Gá»£i Ã½ sáº£n pháº©m">{searchSuggestions.map((product) => <button key={product.id} role="option" aria-selected="false" onMouseDown={(event) => event.preventDefault()} onClick={() => selectSearchProduct(product)}><span>{product.visual}</span><p><b>{product.name}</b><small>{product.category} Â· {money(product.price)}</small></p></button>)}{!searchSuggestions.length && <p className="search-no-result">KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m phÃ¹ há»£p.</p>}</div>}
        </div>
        <nav className="desktop-nav" aria-label="Äiá»u hÆ°á»›ng chÃ­nh">
          <button className={view === "shop" ? "active" : ""} onClick={() => navigate("shop")}>Cá»­a hÃ ng</button>
          <button className={view === "nearby" ? "active" : ""} onClick={() => navigate("nearby")}>Gáº§n báº¡n</button>
          <button className={view === "pets" ? "active" : ""} onClick={() => navigate("pets")}>Há»“ sÆ¡ pet</button>
        </nav>
        <div className="header-actions">
          <a className="partner-link" href="/partner">DÃ nh cho Ä‘á»‘i tÃ¡c</a>
          <button className="icon-button" onClick={() => navigate("appointments")} aria-label="Lá»‹ch khÃ¡m">â™¡</button>
          <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Giá» hÃ ng cÃ³ ${cartCount} sáº£n pháº©m`}>TÃºi <b>{cartCount}</b></button>
          {data.actor ? <div className="account-session"><button className="avatar-button" aria-label="Má»Ÿ thÃ´ng tin phiÃªn Ä‘Äƒng nháº­p" aria-expanded={accountOpen} onClick={() => setAccountOpen((value) => !value)}>{actorInitials}</button>{accountOpen && <div className="account-menu"><b>{data.actor.fullName}</b><small>{data.actor.email}</small><span>ðŸ”’ {data.actor.isDemo ? "PhiÃªn demo cá»¥c bá»™" : "TÃ i khoáº£n PetCare Ä‘Ã£ Ä‘á»“ng bá»™"}</span><button onClick={() => { setAccountOpen(false); navigate("orders"); }}>ÄÆ¡n hÃ ng cá»§a tÃ´i</button>{data.actor.isDemo ? <button onClick={() => setAccountOpen(false)}>ÄÃ³ng</button> : <a href={SIGN_OUT_PATH}>ÄÄƒng xuáº¥t</a>}</div>}</div> : <div className="guest-auth"><a className="account-login" href={SIGN_IN_PATH}>ÄÄƒng nháº­p</a><a className="account-register" href={SIGN_IN_PATH}>ÄÄƒng kÃ½</a></div>}
        </div>
      </header>

      <main>
        {view === "shop" && <ShopView products={filteredProducts} categories={categories} category={category} setCategory={setCategory} addToCart={addToCart} onNearby={() => navigate("nearby")} />}
        {view === "nearby" && <NearbyView type={nearbyType} setType={setNearbyType} partners={nearbyPartners} onBook={requestBooking} />}
        {view === "pets" && (!data.actor ? <SignInGate title="ÄÄƒng nháº­p hoáº·c Ä‘Äƒng kÃ½ Ä‘á»ƒ má»Ÿ há»“ sÆ¡ pet" text="Há»“ sÆ¡ sá»©c khá»e, QR vÃ  lá»‹ch tiÃªm chá»‰ hiá»ƒn thá»‹ cho Ä‘Ãºng chá»§ nuÃ´i." /> : selectedPet ? <PetsView data={data} pet={selectedPet} selectedPetId={effectiveSelectedPetId} onSelectPet={setSelectedPetId} onShowQr={setQrPet} onBook={() => navigate("nearby")} onAdd={() => openPetForm()} onEdit={() => openPetForm(selectedPet)} onRotateQr={() => void rotatePetQr(selectedPet)} /> : <EmptyPets onAdd={() => openPetForm()} />)}
        {view === "appointments" && (data.actor ? <AppointmentsView data={data} onFindVet={() => navigate("nearby")} /> : <SignInGate title="ÄÄƒng nháº­p Ä‘á»ƒ xem lá»‹ch khÃ¡m" text="PetCare cáº§n xÃ¡c nháº­n Ä‘Ãºng chá»§ nuÃ´i trÆ°á»›c khi hiá»ƒn thá»‹ lá»‹ch háº¹n." />)}
        {view === "orders" && (data.actor ? <OrdersView orders={data.orders} onShop={() => navigate("shop")} /> : <SignInGate title="ÄÄƒng nháº­p Ä‘á»ƒ xem Ä‘Æ¡n hÃ ng" text="ÄÆ¡n hÃ ng vÃ  tráº¡ng thÃ¡i thanh toÃ¡n chá»‰ hiá»ƒn thá»‹ cho Ä‘Ãºng tÃ i khoáº£n." />)}
      </main>

      <footer className="site-footer">
        <div><button className="brand footer-brand" onClick={() => navigate("shop")}><span className="brand-mark">P</span><span>PetCare</span></button><p>Má»™t nÆ¡i cho má»i Ä‘iá»u boss cáº§n â€” khá»e hÆ¡n, vui hÆ¡n, gáº§n báº¡n hÆ¡n.</p></div>
        <div><b>Há»— trá»£</b><span>{BRAND.supportPhone}</span><span>{BRAND.supportEmail}</span></div>
        <div><b>An tÃ¢m mua sáº¯m</b><span>Äá»‘i tÃ¡c Ä‘Ã£ xÃ¡c minh</span><span>Thanh toÃ¡n báº£o máº­t</span></div>
      </footer>

      <nav className="mobile-nav" aria-label="Äiá»u hÆ°á»›ng di Ä‘á»™ng">
        <button className={view === "shop" ? "active" : ""} onClick={() => navigate("shop")}><span>âŒ‚</span>Mua sáº¯m</button>
        <button className={view === "nearby" ? "active" : ""} onClick={() => navigate("nearby")}><span>âŒ–</span>Gáº§n báº¡n</button>
        <button className={view === "pets" ? "active" : ""} onClick={() => navigate("pets")}><span>ðŸ¾</span>Há»“ sÆ¡</button>
        <button className={view === "appointments" ? "active" : ""} onClick={() => navigate("appointments")}><span>â–£</span>Lá»‹ch khÃ¡m</button>
        <button className={view === "orders" ? "active" : ""} onClick={() => navigate("orders")}><span>â—‡</span>ÄÆ¡n hÃ ng</button>
      </nav>

      {cartOpen && <CartDrawer lines={cartLines} total={cartTotal} busy={checkoutBusy} onClose={() => setCartOpen(false)} onChange={(id, delta) => setCart((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + delta) }))} onCheckout={() => void beginCheckout()} />}
      {bookingPartner && <BookingModal partner={bookingPartner} pets={data.pets} onClose={() => setBookingPartner(null)} onSuccess={async () => { setBookingPartner(null); setToast("ÄÃ£ gá»­i yÃªu cáº§u. PhÃ²ng khÃ¡m sáº½ xÃ¡c nháº­n sá»›m!"); await reload(); setView("appointments"); }} />}
      {qrPet && <QrModal pet={qrPet} onClose={() => setQrPet(null)} />}
      {checkoutOpen && checkoutOrder && <CheckoutModal order={checkoutOrder} onClose={() => setCheckoutOpen(false)} onSuccess={async () => { setCheckoutOpen(false); setCheckoutOrder(null); setCart({}); setToast("ÄÆ¡n hÃ ng Ä‘ang chá» cá»­a hÃ ng Ä‘á»‘i soÃ¡t thanh toÃ¡n."); await reload(); setView("orders"); }} />}
      {petFormOpen && <PetFormModal pet={petFormPet} onClose={() => { setPetFormOpen(false); setPetFormPet(null); }} onSuccess={async () => { setPetFormOpen(false); setPetFormPet(null); setToast(petFormPet ? "ÄÃ£ cáº­p nháº­t há»“ sÆ¡ cá»§a bÃ©." : "ÄÃ£ táº¡o há»“ sÆ¡ má»›i vÃ  cáº¥p QR riÃªng cho bÃ©."); await ã½u¶‰žËkºwµçj¸­£…´ð½Àøð½‘¥Øøð½‘¥ØùíÉ•½É‘Ì¹µ…À ¡É•½É¤€ôø€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰µ•‘¥…°µ…Éˆ­•äõíÉ•½É¹¥‘ôøñ‘¥Ø±…ÍÍ9…µ”ô‰µ•‘¥…°µ‘…Ñ”ˆøñˆùí¹•Ü…Ñ”¡É•½É¹Ù¥Í¥Ñ•‘}…Ð¤¹•Ñ…Ñ” ¥ôð½ˆøñÍÁ…¸ùQ!í¹•Ü…Ñ”¡É•½É¹Ù¥Í¥Ñ•‘}…Ð¤¹•Ñ5½¹Ñ  ¤€¬€Åôð½ÍÁ…¸øð½‘¥Øøñ‘¥Øøñ ÌùíÉ•½É¹‘¥…¹½Í¥Íôð½ ÌøñÀùíÉ•½É¹ÑÉ•…Ñµ•¹Ñôð½Àøñ‘¥Ø±…ÍÍ9…µ”ô‰µ•‘¥…°µµ•Ñ„ˆøñÍÁ…¸ûŠrhíÉ•½É¹Á…ÉÑ¹•É}¹…µ•ôð½ÍÁ…¸øñÍÁ…¸ûŠfdíÉ•½É¹±¥¹¥¥…¹ôð½ÍÁ…¸øð½‘¥ØùíÉ•½É¹ÁÉ•ÍÉ¥ÁÑ¥½¸€˜˜€ñÍµ…±°øñˆûC…¸Ñ¡×†îEŒèð½ˆøíÉ•½É¹ÁÉ•ÍÉ¥ÁÑ¥½¹ôð½Íµ…±°ùôð½‘¥Øøñ‰ÕÑÑ½¸…É¥„µ±…‰•°ô‰a•´¡¤Ñ§†êýÐ£†îLÏ„ˆûŠèð½‰ÕÑÑ½¸øð½…ÉÑ¥±”ø¥ôð½Í•Ñ¥½¸ø(€€€€€€ð½‘¥Øø(€€€€ð½‘¥Øø(€€ð½Í•Ñ¥½¸øì)ô()™Õ¹Ñ¥½¸ÁÁ½¥¹Ñµ•¹ÑÍY¥•Ü¡ì‘…Ñ„°½¹¥¹‘Y•Ðôèì‘…Ñ„èÁÁ…Ñ„ì½¹¥¹‘Y•Ðè€ ¤€ôøÙ½¥ô¤ì(€É•ÑÕÉ¸€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µÝÉ…À…ÁÁ½¥¹Ñµ•¹ÑÌµÁ…”ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Á•ÐµÁ…”µ¡•…ˆøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùQ¡•¼“Õ¤Ó†î¬³éŒŸ†îµ¤ƒG†êý¸­¡¤­£…´ð½ÍÁ…¸øñ Äù3†î- ­£…´†î„‹¤ð½ Äøð½‘¥Øøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Íµ…±°ˆ½¹±¥¬õí½¹¥¹‘Y•Ñôø¬ƒC†êÝÐ³†î- ·†îm¤ð½‰ÕÑÑ½¸øð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰…ÁÁ½¥¹Ñµ•¹ÐµÉ¥ˆùí‘…Ñ„¹…ÁÁ½¥¹Ñµ•¹ÑÌ¹µ…À ¡¥Ñ•´¤€ôøì½¹ÍÐÝ¡•¸€ô•ÑY¥•Ñ¹…µ…Ñ•A…ÉÑÌ¡¥Ñ•´¹Í¡•‘Õ±•‘}…Ð¤ìÉ•ÑÕÉ¸€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰…ÁÁ½¥¹Ñµ•¹Ðµ…Éˆ­•äõí¥Ñ•´¹¥‘ôøñ‘¥Ø±…ÍÍ9…µ”ô‰…ÁÁ½¥¹Ñµ•¹Ðµ‘…Ñ”ˆøñˆùíÝ¡•¸ü¹‘…ä€üü€‹ŠP‰ôð½ˆøñÍÁ…¸ùQ£…¹œíÝ¡•¸ü¹µ½¹Ñ €üü€‹ŠP‰ôð½ÍÁ…¸øñÍµ…±°ùí™½Éµ…ÑY¥•Ñ¹…µQ¥µ”¡¥Ñ•´¹Í¡•‘Õ±•‘}…Ð¥ôð½Íµ…±°øð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰…ÁÁ½¥¹Ñµ•¹Ðµ½¹Ñ•¹Ðˆøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”õí…ÁÁ½¥¹Ñµ•¹ÐµÍÑ…ÑÕÌ€‘í¥Ñ•´¹ÍÑ…ÑÕÍõôùí¥Ñ•´¹ÍÑ…ÑÕÌ€ôôô€‰Á•¹‘¥¹œˆ€ü€‰£†ît‘Õç†îÐˆ€è¥Ñ•´¹ÍÑ…ÑÕÌ€ôôô€‰½¹™¥Éµ•ˆ€ü€‹CŒã…Œ¹£†êµ¸ˆ€è¥Ñ•´¹ÍÑ…ÑÕÌ€ôôô€‰½µÁ±•Ñ•ˆ€ü€‹CŒ­£…´ˆ€è€‹CŒ£†îä‰ôð½ÍÁ…¸øñ Èùí¥Ñ•´¹É•…Í½¹ôð½ ÈøñÀùí¥Ñ•´¹Á…ÉÑ¹•É}¹…µ•ôð½Àøð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰…ÁÁ½¥¹Ñµ•¹ÐµÁ•ÐˆøñÍÁ…¸ùí‘…Ñ„¹Á•ÑÌ¹™¥¹ ¡Á•Ð¤€ôøÁ•Ð¹¥€ôôô¥Ñ•´¹Á•Ñ}¥¤ü¹…Ù…Ñ…È€üü€‹Â~Bø‰ôð½ÍÁ…¸øñÀøñˆùí¥Ñ•´¹Á•Ñ}¹…µ•ôð½ˆøñÍµ…±°ùí¥Ñ•´¹¹½Ñ•ôð½Íµ…±°øð½Àøð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰…ÁÁ½¥¹Ñµ•¹Ðµ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆùa•´¡¤Ñ§†êýÐð½‰ÕÑÑ½¸øñ„±…ÍÍ9…µ”ô‰Ñ•áÐµ‰ÕÑÑ½¸ˆ¡É•˜õíÑ•°è‘í‘…Ñ„¹Á…ÉÑ¹•ÉÌ¹™¥¹ ¡Á…ÉÑ¹•È¤€ôøÁ…ÉÑ¹•È¹¥€ôôô¥Ñ•´¹Á…ÉÑ¹•É}¥¤ü¹Á¡½¹”€üü€ˆ‰õôù†î5¤Á£É¹œ­£…´ð½„øð½‘¥Øøð½‘¥Øøð½…ÉÑ¥±”øìô¥õì…‘…Ñ„¹…ÁÁ½¥¹Ñµ•¹ÑÌ¹±•¹Ñ €˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰•µÁÑäµÍÑ…Ñ”ˆøñÍÁ…¸ûŠZŒð½ÍÁ…¸øñ Ìù£Á„Ì³†î- ­£…´ð½ ÌøñÀùS±´„Ï†î|ƒE…¹œ·†î|Û€£†î5¸§†îtÁ£ä£†îÀ¡¼‹¤¸ð½Àøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Íµ…±°ˆ½¹±¥¬õí½¹¥¹‘Y•ÑôùS±´Ñ£èäŸ†ê¸ÓÑ¤ð½‰ÕÑÑ½¸øð½‘¥Øùôð½‘¥Øøð½Í•Ñ¥½¸øì)ô()™Õ¹Ñ¥½¸=É‘•ÉÍY¥•Ü¡ì½É‘•ÉÌ°½¹M¡½Àôèì½É‘•ÉÌè=É‘•Émtì½¹M¡½Àè€ ¤€ôøÙ½¥ô¤ì(€½¹ÍÐ±…‰•±ÌèI•½Éñ=É‘•Él‰ÍÑ…ÑÕÌ‰t°ÍÑÉ¥¹œø€ôìÁ•¹‘¥¹}Á…åµ•¹Ðè€‰£†îtÑ¡…¹ Ñ¿…¸ˆ°Á…åµ•¹Ñ}É•Ù¥•Üè€‰£†îtƒG†îE¤Í¿…Ðˆ°Á…¥è€‹CŒÑ¡…¹ Ñ¿…¸ˆ°…¹•±±•è€‹CŒ£†îäˆ°™Õ±™¥±±•è€‹CŒ¡¿¸Ó†ê•Ðˆôì(€É•ÑÕÉ¸€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µÝÉ…À½É‘•ÉÌµÁ…”ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Á•ÐµÁ…”µ¡•…ˆøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùQ¡•¼“Õ¤Ñ¡…¹ Ñ¿…¸Û€¥…¼£¹œð½ÍÁ…¸øñ ÄûC…¸£¹œ†î„ÓÑ¤ð½ Äøð½‘¥Øøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Íµ…±°ˆ½¹±¥¬õí½¹M¡½ÁôùQ§†êýÀÓ†î•ŒµÕ„Ï†ê½´ð½‰ÕÑÑ½¸øð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰ÕÍÑ½µ•Èµ½É‘•ÉÌˆùí½É‘•ÉÌ¹µ…À ¡½É‘•È¤€ôø€ñ…ÉÑ¥±”­•äõí½É‘•È¹¥‘ôøñ¡•…‘•Èøñ‘¥ØøñÍµ…±°ù7ŒƒG…¸ð½Íµ…±°øñˆùí½É‘•È¹½É‘•É}½‘•ôð½ˆøð½‘¥ØøñÍÁ…¸±…ÍÍ9…µ”õí½É‘•ÈµÍÑ…ÑÕÌ€‘í½É‘•È¹ÍÑ…ÑÕÍõôùí±…‰•±Ím½É‘•È¹ÍÑ…ÑÕÍuôð½ÍÁ…¸øð½¡•…‘•ÈøñÀùí½É‘•È¹Á…ÉÑ¹•É}¹…µ•ôð½Àøñ‘¥Ø±…ÍÍ9…µ”ô‰½É‘•Èµ±¥¹•Ìˆùí½É‘•È¹¥Ñ•µÌü¹µ…À ¡¥Ñ•´¤€ôø€ñÍÁ…¸­•äõí¥Ñ•´¹¥‘ôøñˆùí¥Ñ•´¹ÁÉ½‘ÕÑ}¹…µ•ôð½ˆøñ•´ùí¥Ñ•´¹ÅÕ…¹Ñ¥Ñåôƒ\íµ½¹•ä¡¥Ñ•´¹Õ¹¥Ñ}ÁÉ¥”¥ôð½•´øð½ÍÁ…¸ø¥ôð½‘¥Øøñ™½½Ñ•ÈøñÍµ…±°ùí‘…Ñ•Q¥µ•Q•áÐ¡½É‘•È¹É•…Ñ•‘}…Ð¥ôð½Íµ…±°øñÍÑÉ½¹œùíµ½¹•ä¡½É‘•È¹Ñ½Ñ…±}…µ½Õ¹Ð¥ôð½ÍÑÉ½¹œøð½™½½Ñ•Èøð½…ÉÑ¥±”ø¥õì…½É‘•ÉÌ¹±•¹Ñ €˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰•µÁÑäµÍÑ…Ñ”ˆøñÍÁ…¸ûŠ^ð½ÍÁ…¸øñ Ìù£Á„ÌƒG…¸£¹œð½ ÌøñÀùO†ê¸Á£†ê¥´‹†ê…¸µÕ„Ï†êôƒGÃ†îŒ³ÁÔÛ€ƒG†îM¹œ‹†îdÛ†îm¤†îµ„£¹œÓ†ê…¤ƒG‰ä¸ð½Àøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Íµ…±°ˆ½¹±¥¬õí½¹M¡½Áôù-£…´Á£„†îµ„£¹œð½‰ÕÑÑ½¸øð½‘¥Øùôð½‘¥Øøð½Í•Ñ¥½¸øì)ô()™Õ¹Ñ¥½¸5½‘…±M¡•±°¡ìÑ¥Ñ±”°½¹±½Í”°¡¥±‘É•¸°±…ÍÍ9…µ”€ô€ˆˆôèìÑ¥Ñ±”èÍÑÉ¥¹œì½¹±½Í”è€ ¤€ôøÙ½¥ì¡¥±‘É•¸èI•…Ð¹I•…Ñ9½‘”ì±…ÍÍ9…µ”üèÍÑÉ¥¹œô¤ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘…°µ‰…­‘É½Àˆ½¹5½ÕÍ•½Ý¸õì¡•Ù•¹Ð¤€ôøì¥˜€¡•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð€ôôô•Ù•¹Ð¹Ñ…É•Ð¤½¹±½Í” ¤ìõôøñ‘¥Ø±…ÍÍ9…µ”õíµ½‘…°µ…É€‘í±…ÍÍ9…µ•õôÉ½±”ô‰‘¥…±½œˆ…É¥„µµ½‘…°ô‰ÑÉÕ”ˆ…É¥„µ±…‰•°õíÑ¥Ñ±•ôøñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘…°µ¡•…ˆøñ ÈùíÑ¥Ñ±•ôð½ Èøñ‰ÕÑÑ½¸½¹±¥¬õí½¹±½Í•ô…É¥„µ±…‰•°ô‹CÍ¹œˆû\ð½‰ÕÑÑ½¸øð½‘¥Øùí¡¥±‘É•¹ôð½‘¥Øøð½‘¥Øøì)ô()™Õ¹Ñ¥½¸	½½­¥¹5½‘…°¡ìÁ…ÉÑ¹•È°Á•ÑÌ°½¹±½Í”°½¹MÕ•ÍÌôèìÁ…ÉÑ¹•ÈèA…ÉÑ¹•ÈìÁ•ÑÌèA•Ñmtì½¹±½Í”è€ ¤€ôøÙ½¥ì½¹MÕ•ÍÌè€ ¤€ôøÙ½¥ô¤ì(€½¹ÍÐm‰ÕÍä°Í•Ñ	ÕÍåt€ôÕÍ•MÑ…Ñ”¡™…±Í”¤ì½¹ÍÐm•ÉÉ½È°Í•ÑÉÉ½Ét€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍÐmµ¥¹¥µÕµ…Ñ•Q¥µ•t€ôÕÍ•MÑ…Ñ”  ¤€ôø¹•Ü…Ñ”¡…Ñ”¹¹½Ü ¤€¬€ÌØÀÀÀÀÀ¤¹Ñ½%M=MÑÉ¥¹œ ¤¹Í±¥” À°€ÄØ¤¤ì(€½¹ÍÐÍÕ‰µ¥Ð€ô…Íå¹Œ€¡•Ù•¹Ðè½ÉµÙ•¹Ðñ!Q51½Éµ±•µ•¹Ðø¤€ôøì(€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ìÍ•Ñ	ÕÍä¡ÑÉÕ”¤ìÍ•ÑÉÉ½È ˆˆ¤ì(€€€½¹ÍÐ™½É´€ô¹•Ü½Éµ…Ñ„¡•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¤ì½¹ÍÐÍ¡•‘Õ±•€ôMÑÉ¥¹œ¡™½É´¹•Ð ‰Í¡•‘Õ±•‘Ðˆ¤€üü€ˆˆ¤ì(€€€ÑÉäì½¹ÍÐÉ•ÍÁ½¹Í”€ô…Ý…¥Ð™•Ñ  ˆ½…Á¤½…ÁÀˆ°ìµ•Ñ¡½è€‰A=MPˆ°¡•…‘•ÉÌèì€‰½¹Ñ•¹ÐµQåÁ”ˆè€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆô°‰½‘äè)M=8¹ÍÑÉ¥¹¥™ä¡ì…Ñ¥½¸è€‰É•…Ñ•ÁÁ½¥¹Ñµ•¹Ðˆ°Á…ÉÑ¹•É%èÁ…ÉÑ¹•È¹¥°Á•Ñ%è™½É´¹•Ð ‰Á•Ñ%ˆ¤°Í¡•‘Õ±•‘Ðè¹•Ü…Ñ”¡Í¡•‘Õ±•¤¹Ñ½%M=MÑÉ¥¹œ ¤°É•…Í½¸è™½É´¹•Ð ‰É•…Í½¸ˆ¤°¹½Ñ”è™½É´¹•Ð ‰¹½Ñ”ˆ¤ô¤ô¤ì½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•ÍÁ½¹Í”¹©Í½¸ ¤…Ìì•ÉÉ½ÈüèÍÑÉ¥¹œôì¥˜€ …É•ÍÁ½¹Í”¹½¬¤Ñ¡É½Ü¹•ÜÉÉ½È¡‰½‘ä¹•ÉÉ½È€üü€‰-£Ñ¹œÑ£†îƒG†êÝÐ³†î- ˆ¤ì½¹MÕ•ÍÌ ¤ìô…Ñ €¡…Õ¡Ð¤ìÍ•ÑÉÉ½È¡…Õ¡Ð¥¹ÍÑ…¹•½˜ÉÉ½È€ü…Õ¡Ð¹µ•ÍÍ…”€è€‰-£Ñ¹œÑ£†îƒG†êÝÐ³†î- ˆ¤ìô™¥¹…±±äìÍ•Ñ	ÕÍä¡™…±Í”¤ìô(€ôì(€É•ÑÕÉ¸€ñ5½‘…±M¡•±°Ñ¥Ñ±”ô‹C†êÝÐ³†î- ­£…´ˆ½¹±½Í”õí½¹±½Í•ôøñ‘¥Ø±…ÍÍ9…µ”ô‰‰½½­¥¹œµ±¥¹¥ŒˆøñÍÁ…¸ûŠrhð½ÍÁ…¸øñ‘¥ØøñˆùíÁ…ÉÑ¹•È¹¹…µ•ôð½ˆøñÍµ…±°ùíÁ…ÉÑ¹•È¹…‘‘É•ÍÍôð½Íµ…±°øð½‘¥Øøñ•´ûA…¹œ¹£†êµ¸³†î- ð½•´øð½‘¥Øøñ™½É´±…ÍÍ9…µ”ô‰‰½½­¥¹œµ™½É´ˆ½¹MÕ‰µ¥ÐõíÍÕ‰µ¥Ñôøñ±…‰•°ù¤†ê¸­£…´ñÍ•±•Ð¹…µ”ô‰Á•Ñ%ˆÉ•ÅÕ¥É•ùíÁ•ÑÌ¹µ…À ¡Á•Ð¤€ôø€ñ½ÁÑ¥½¸­•äõíÁ•Ð¹¥‘ôÙ…±Õ”õíÁ•Ð¹¥‘ôùíÁ•Ð¹¹…µ•ôƒ
ÜíÁ•Ð¹‰É••‘ôð½½ÁÑ¥½¸ø¥ôð½Í•±•Ðøð½±…‰•°øñ±…‰•°ù9ŸäÛ€§†îtñ¥¹ÁÕÐ¹…µ”ô‰Í¡•‘Õ±•‘ÐˆÑåÁ”ô‰‘…Ñ•Ñ¥µ”µ±½…°ˆµ¥¸õíµ¥¹¥µÕµ…Ñ•Q¥µ•ôÉ•ÅÕ¥É•€¼øð½±…‰•°øñ±…‰•°ù3ô‘¼­£…´ñÍ•±•Ð¹…µ”ô‰É•…Í½¸ˆÉ•ÅÕ¥É•øñ½ÁÑ¥½¸ù-£…´Ó†îU¹œÅ×…Ðð½½ÁÑ¥½¸øñ½ÁÑ¥½¸ùQ§©´Á£É¹œð½½ÁÑ¥½¸øñ½ÁÑ¥½¸ù-£…´‘„±§†îÔð½½ÁÑ¥½¸øñ½ÁÑ¥½¸ùS…¤­£…´ð½½ÁÑ¥½¸øñ½ÁÑ¥½¸ù-£…Œð½½ÁÑ¥½¸øð½Í•±•Ðøð½±…‰•°øñ±…‰•°ù¡¤£è¡¼‹…ŒÏ¤ñÑ•áÑ…É•„¹…µ”ô‰¹½Ñ”ˆµ…á1•¹Ñ õìÔÀÁôÁ±…•¡½±‘•Èô‰QÉ§†îÔ£†î¥¹œ°Ñ£†îu¤¥…¸á×†ê•Ð¡§†î¸¸¸¸ˆ€¼øð½±…‰•°ùí•ÉÉ½È€˜˜€ñÀ±…ÍÍ9…µ”ô‰™½É´µ•ÉÉ½Èˆùí•ÉÉ½Éôð½Àùôñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘…°µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆ½¹±¥¬õí½¹±½Í•ôûC†îÍ…Ôð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Íµ…±°ˆ‘¥Í…‰±•õí‰ÕÍåôùí‰ÕÍä€ü€‹A…¹œŸ†îµ¤¸¸¸ˆ€è€‰†îµ¤ç©Ô†êÔƒG†êÝÐ³†î- ‰ôð½‰ÕÑÑ½¸øð½‘¥ØøñÍµ…±°±…ÍÍ9…µ”ô‰Í•ÕÉ”µ¹½Ñ”ˆûÂ~RHA£É¹œ­£…´£†î$Ñ£†ê•ä£†îLÏ„†î„‹¤Í…Ô­¡¤‹†ê…¸ƒG†êÝÐ³†î- ¸ð½Íµ…±°øð½™½É´øð½5½‘…±M¡•±°øì)ô()™Õ¹Ñ¥½¸A•Ñ½Éµ5½‘…°¡ìÁ•Ð°½¹±½Í”°½¹MÕ•ÍÌôèìÁ•ÐèA•Ðð¹Õ±°ì½¹±½Í”è€ ¤€ôøÙ½¥ì½¹MÕ•ÍÌè€ ¤€ôøÙ½¥ô¤ì(€½¹ÍÐm‰ÕÍä°Í•Ñ	ÕÍåt€ôÕÍ•MÑ…Ñ”¡™…±Í”¤ì½¹ÍÐm•ÉÉ½È°Í•ÑÉÉ½Ét€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€½¹ÍÐÍÕ‰µ¥Ð€ô…Íå¹Œ€¡•Ù•¹Ðè½ÉµÙ•¹Ðñ!Q51½Éµ±•µ•¹Ðø¤€ôøì(€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ìÍ•Ñ	ÕÍä¡ÑÉÕ”¤ìÍ•ÑÉÉ½È ˆˆ¤ì½¹ÍÐ™½É´€ô¹•Ü½Éµ…Ñ„¡•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¤ì(€€€ÑÉäì½¹ÍÐÉ•ÍÁ½¹Í”€ô…Ý…¥Ð™•Ñ  ˆ½…Á¤½…ÁÀˆ°ìµ•Ñ¡½è€‰A=MPˆ°¡•…‘•ÉÌèì€‰½¹Ñ•¹ÐµQåÁ”ˆè€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆô°‰½‘äè)M=8¹ÍÑÉ¥¹¥™ä¡ì…Ñ¥½¸èÁ•Ð€ü€‰ÕÁ‘…Ñ•A•Ðˆ€è€‰É•…Ñ•A•Ðˆ°Á•Ñ%èÁ•Ðü¹¥°Á•Ñ9…µ”è™½É´¹•Ð ‰Á•Ñ9…µ”ˆ¤°ÍÁ•¥•Ìè™½É´¹•Ð ‰ÍÁ•¥•Ìˆ¤°‰É••è™½É´¹•Ð ‰‰É••ˆ¤°Í•àè™½É´¹•Ð ‰Í•àˆ¤°‘…Ñ•=™	¥ÉÑ è™½É´¹•Ð ‰‘…Ñ•=™	¥ÉÑ ˆ¤°Ý•¥¡Ñ-œè9Õµ‰•È¡™½É´¹•Ð ‰Ý•¥¡Ñ-œˆ¤¤°‰±½½‘QåÁ”è™½É´¹•Ð ‰‰±½½‘QåÁ”ˆ¤°µ¥É½¡¥Àè™½É´¹•Ð ‰µ¥É½¡¥Àˆ¤°…±±•É¥•Ìè™½É´¹•Ð ‰…±±•É¥•Ìˆ¤°Á•Ñ9½Ñ•Ìè™½É´¹•Ð ‰Á•Ñ9½Ñ•Ìˆ¤ô¤ô¤ì½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•ÍÁ½¹Í”¹©Í½¸ ¤…Ìì•ÉÉ½ÈüèÍÑÉ¥¹œôì¥˜€ …É•ÍÁ½¹Í”¹½¬¤Ñ¡É½Ü¹•ÜÉÉ½È¡‰½‘ä¹•ÉÉ½È€üü€‰-£Ñ¹œÑ£†î³ÁÔ£†îLÏ„ˆ¤ì½¹MÕ•ÍÌ ¤ìô…Ñ €¡…Õ¡Ð¤ìÍ•ÑÉÉ½È¡…Õ¡Ð¥¹ÍÑ…¹•½˜ÉÉ½È€ü…Õ¡Ð¹µ•ÍÍ…”€è€‰-£Ñ¹œÑ£†î³ÁÔ£†îLÏ„ˆ¤ìô™¥¹…±±äìÍ•Ñ	ÕÍä¡™…±Í”¤ìô(€ôì(€É•ÑÕÉ¸€ñ5½‘…±M¡•±°Ñ¥Ñ±”õíÁ•Ð€ü£†î%¹ Ï†îµ„£†îLÏ„ƒ
Ü€‘íÁ•Ð¹¹…µ•õ€€è€‰Q£©´£†îLÏ„¡¼‹¤‰ô½¹±½Í”õí½¹±½Í•ôøñ™½É´±…ÍÍ9…µ”ô‰‰½½­¥¹œµ™½É´Á•Ðµ™½É´ˆ½¹MÕ‰µ¥ÐõíÍÕ‰µ¥Ñôøñ±…‰•°ùS©¸†î„‹¤ñ¥¹ÁÕÐ¹…µ”ô‰Á•Ñ9…µ”ˆÉ•ÅÕ¥É•µ…á1•¹Ñ õìàÁôÁ±…•¡½±‘•Èô‰Ñ¹œˆ‘•™…Õ±ÑY…±Õ”õíÁ•Ðü¹¹…µ•ô€¼øð½±…‰•°øñ±…‰•°ù1¿¤ñÍ•±•Ð¹…µ”ô‰ÍÁ•¥•ÌˆÉ•ÅÕ¥É•‘•™…Õ±ÑY…±Õ”õíÁ•Ðü¹ÍÁ•¥•Ì€üü€‰£Ì‰ôøñ½ÁÑ¥½¸ù£Ìð½½ÁÑ¥½¸øñ½ÁÑ¥½¸ù7¡¼ð½½ÁÑ¥½¸øñ½ÁÑ¥½¸ùQ£†î<ð½½ÁÑ¥½¸øñ½ÁÑ¥½¸ù-£…Œð½½ÁÑ¥½¸øð½Í•±•Ðøð½±…‰•°øñ±…‰•°ù§†îE¹œñ¥¹ÁÕÐ¹…µ”ô‰‰É••ˆÉ•ÅÕ¥É•µ…á1•¹Ñ õìÄÀÁôÁ±…•¡½±‘•Èô‰A½½‘±”Q½äˆ‘•™…Õ±ÑY…±Õ”õíÁ•Ðü¹‰É••‘ô€¼øð½±…‰•°øñ±…‰•°ù§†îm¤Óµ¹ ñÍ•±•Ð¹…µ”ô‰Í•àˆÉ•ÅÕ¥É•‘•™…Õ±ÑY…±Õ”õíÁ•Ðü¹Í•à€üü€‹C†îÅŒ‰ôøñ½ÁÑ¥½¸ûC†îÅŒð½½ÁÑ¥½¸øñ½ÁÑ¥½¸ù…¤ð½½ÁÑ¥½¸øñ½ÁÑ¥½¸ù£Á„ã…ŒƒG†î-¹ ð½½ÁÑ¥½¸øð½Í•±•Ðøð½±…‰•°øñ±…‰•°ù9ŸäÍ¥¹ ñ¥¹ÁÕÐ¹…µ”ô‰‘…Ñ•=™	¥ÉÑ ˆÑåÁ”ô‰‘…Ñ”ˆµ…àõí¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤¹Í±¥” À°ÄÀ¥ôÉ•ÅÕ¥É•‘•™…Õ±ÑY…±Õ”õíÁ•Ðü¹‘…Ñ•}½™}‰¥ÉÑ¡ô€¼øð½±…‰•°øñ±…‰•°ù‰¸»†êÝ¹œ€¡­œ¤ñ¥¹ÁÕÐ¹…µ”ô‰Ý•¥¡Ñ-œˆÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀ¸Äˆµ…àôˆÈÔÀˆÍÑ•ÀôˆÀ¸ÄˆÉ•ÅÕ¥É•‘•™…Õ±ÑY…±Õ”õíÁ•Ðü¹Ý•¥¡Ñ}­ô€¼øð½±…‰•°øñ±…‰•°ù9£Í´·…Ôñ¥¹ÁÕÐ¹…µ”ô‰‰±½½‘QåÁ”ˆµ…á1•¹Ñ õìÐÁô‘•™…Õ±ÑY…±Õ”õíÁ•Ðü¹‰±½½‘}ÑåÁ”€üü€ˆ‰ôÁ±…•¡½±‘•Èô‰€Ä¸Ä´ˆ€¼øð½±…‰•°øñ±…‰•°ù5¥É½¡¥Àñ¥¹ÁÕÐ¹…µ”ô‰µ¥É½¡¥Àˆµ…á1•¹Ñ õìàÁô‘•™…Õ±ÑY…±Õ”õíÁ•Ðü¹µ¥É½¡¥À€üü€ˆ‰ô€¼øð½±…‰•°øñ±…‰•°±…ÍÍ9…µ”ô‰Ý¥‘”µ™¥•±ˆù†î,ƒ†î¥¹œñÑ•áÑ…É•„¹…µ”ô‰…±±•É¥•Ìˆµ…á1•¹Ñ õìÌÀÁôÁ±…•¡½±‘•Èô‰Q£†îÅŒÁ£†ê¥´°Ñ¡×†îEŒ°·Ñ¤ÑËÃ†îu¹œ¸¸¸ˆ‘•™…Õ±ÑY…±Õ”õíÁ•Ðü¹…±±•É¥•Íô€¼øð½±…‰•°øñ±…‰•°±…ÍÍ9…µ”ô‰Ý¥‘”µ™¥•±ˆù¡¤£èÉ§©¹œÓÀñÑ•áÑ…É•„¹…µ”ô‰Á•Ñ9½Ñ•Ìˆµ…á1•¹Ñ õìÔÀÁôÁ±…•¡½±‘•Èô‰Sµ¹ … °·Ô³Ñ¹œ°ƒG†êÝŒƒE§†î´“†î¹£†êµ¸É„ˆ‘•™…Õ±ÑY…±Õ”õíÁ•Ðü¹¹½Ñ•Íô€¼øð½±…‰•°ùí•ÉÉ½È€˜˜€ñÀ±…ÍÍ9…µ”ô‰™½É´µ•ÉÉ½Èˆùí•ÉÉ½Éôð½Àùôñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘…°µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆ½¹±¥¬õí½¹±½Í•ôù#†îäð½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸Íµ…±°ˆ‘¥Í…‰±•õí‰ÕÍåôùí‰ÕÍä€ü€‹A…¹œ³ÁÔ¸¸¸ˆ€èÁ•Ð€ü€‰3ÁÔÑ¡…äƒG†îU¤ˆ€è€‰S†ê…¼£†îLÏ„€˜EH‰ôð½‰ÕÑÑ½¸øð½‘¥ØøñÍµ…±°±…ÍÍ9…µ”ô‰Í•ÕÉ”µ¹½Ñ”ˆûÂ~RH¡¤£èÉ§©¹œÓÀ­£Ñ¹œá×†ê•Ð¡§†î¸ÑË©¸Ñ£†êìEHÑ¹œ­¡…¤¸ð½Íµ…±°øð½™½É´øð½5½‘…±M¡•±°øì)ô()™Õ¹Ñ¥½¸…ÉÑÉ…Ý•È¡ì±¥¹•Ì°Ñ½Ñ…°°‰ÕÍä°½¹±½Í”°½¹¡…¹”°½¹¡•­½ÕÐôèì±¥¹•ÌèÉÉ…äñìÁÉ½‘ÕÐèAÉ½‘ÕÐìÅÕ…¹Ñ¥Ñäè¹Õµ‰•ÈôøìÑ½Ñ…°è¹Õµ‰•Èì‰ÕÍäè‰½½±•…¸ì½¹±½Í”è€ ¤€ôøÙ½¥ì½¹¡…¹”è€¡¥èÍÑÉ¥¹œ°‘•±Ñ„è¹Õµ‰•È¤€ôøÙ½¥ì½¹¡•­½ÕÐè€ ¤€ôøÙ½¥ô¤ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘É…Ý•Èµ‰…­‘É½Àˆ½¹5½ÕÍ•½Ý¸õì¡•Ù•¹Ð¤€ôøì¥˜€¡•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð€ôôô•Ù•¹Ð¹Ñ…É•Ð¤½¹±½Í” ¤ìõôøñ…Í¥‘”±…ÍÍ9…µ”ô‰…ÉÐµ‘É…Ý•Èˆøñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘…°µ¡•…ˆøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùE×€¡¼‰½ÍÌð½ÍÁ…¸øñ ÈùSé¤£¹œ†î„‹†ê…¸ð½ Èøð½‘¥Øøñ‰ÕÑÑ½¸½¹±¥¬õí½¹±½Í•ôû\ð½‰ÕÑÑ½¸øð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰…ÉÐµ±¥¹•Ìˆùí±¥¹•Ì¹µ…À ¡ìÁÉ½‘ÕÐ°ÅÕ…¹Ñ¥Ñäô¤€ôø€ñ‘¥Ø±…ÍÍ9…µ”ô‰…ÉÐµ±¥¹”ˆ­•äõíÁÉ½‘ÕÐ¹¥‘ôøñÍÁ…¸±…ÍÍ9…µ”õíÑ½¹”´‘íÁÉ½‘ÕÐ¹Ù¥ÍÕ…±}Ñ½¹•õôùíÁÉ½‘ÕÐ¹Ù¥ÍÕ…±ôð½ÍÁ…¸øñ‘¥ØøñˆùíÁÉ½‘ÕÐ¹¹…µ•ôð½ˆøñÍµ…±°ùíµ½¹•ä¡ÁÉ½‘ÕÐ¹ÁÉ¥”¥ôð½Íµ…±°øñ‘¥Ø±…ÍÍ9…µ”ô‰ÅÕ…¹Ñ¥Ñäˆøñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôø½¹¡…¹”¡ÁÉ½‘ÕÐ¹¥°€´Ä¥ôûŠ"Hð½‰ÕÑÑ½¸øñˆùíÅÕ…¹Ñ¥Ñåôð½ˆøñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôø½¹¡…¹”¡ÁÉ½‘ÕÐ¹¥°€Ä¥ôø¬ð½‰ÕÑÑ½¸øð½‘¥Øøð½‘¥Øøð½‘¥Øø¥õì…±¥¹•Ì¹±•¹Ñ €˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰•µÁÑäµÍÑ…Ñ”½µÁ…ÐˆøñÍÁ…¸ûÂ~n7¾â<ð½ÍÁ…¸øñ ÌùSé¤£¹œƒE…¹œÑË†îE¹œð½ ÌøñÀù£†î5¸Û¤·Í¸‰½ÍÌ·¨¹£¤¸ð½Àøð½‘¥Øùôð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰…ÉÐµÍÕµµ…ÉäˆøñÍÁ…¸ùS†ê…´Óµ¹ €ñˆùíµ½¹•ä¡Ñ½Ñ…°¥ôð½ˆøð½ÍÁ…¸øñÍÁ…¸ùA£´¥…¼£¹œ€ñˆùíÑ½Ñ…°€øô€ÈääÀÀÀ€ü€‰5§†î¸Á£´ˆ€è€‰Sµ¹ ƒ†î|‹Ã†îmŒÍ…Ô‰ôð½ˆøð½ÍÁ…¸øñ¡È¼øñÍÁ…¸±…ÍÍ9…µ”ô‰…ÉÐµÑ½Ñ…°ˆùS†îU¹œ†îe¹œ€ñˆùíµ½¹•ä¡Ñ½Ñ…°¥ôð½ˆøð½ÍÁ…¸øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸¡•­½ÕÐˆ‘¥Í…‰±•õì…±¥¹•Ì¹±•¹Ñ ñð‰ÕÍåô½¹±¥¬õí½¹¡•­½ÕÑôùí‰ÕÍä€ü€‹A…¹œÓ†ê…¼ƒG…¸¸¸¸ˆ€è€‰S†ê…¼ƒG…¸€˜Ñ¡…¹ Ñ¿…¸ƒŠH‰ôð½‰ÕÑÑ½¸øñÍµ…±°ûÂ~RHS†îU¹œÑ§†î¸ƒGÃ†îŒ‰…­•¹Óµ¹ ³†ê…¤Ó†î¬‘…Ñ…‰…Í”ð½Íµ…±°øð½‘¥Øøð½…Í¥‘”øð½‘¥Øøì)ô()™Õ¹Ñ¥½¸EÉ5½‘…°¡ìÁ•Ð°½¹±½Í”ôèìÁ•ÐèA•Ðì½¹±½Í”è€ ¤€ôøÙ½¥ô¤ì(€½¹ÍÐmÍÉŒ°Í•ÑMÉt€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€ÕÍ•™™•Ð  ¤€ôøìÙ½¥EI½‘”¹Ñ½…Ñ…UI0¡€‘íÝ¥¹‘½Ü¹±½…Ñ¥½¸¹½É¥¥¹ô½Á•Ð¼‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Á•Ð¹ÅÉ}Ñ½­•¸¥õ€°ìÝ¥‘Ñ è€ÌÐÀ°µ…É¥¸è€È°½±½Èèì‘…É¬è€ˆŒÄÜÈÔÍˆ°±¥¡Ðè€ˆ™™™™™˜ˆô°•ÉÉ½É½ÉÉ•Ñ¥½¹1•Ù•°è€‰ ˆô¤¹Ñ¡•¸¡Í•ÑMÉŒ¤ìô°mÁ•Ð¹ÅÉ}Ñ½­•¹t¤ì(€É•ÑÕÉ¸€ñ5½‘…±M¡•±°Ñ¥Ñ±”õíEH£†îLÏ„†î„€‘íÁ•Ð¹¹…µ•õô½¹±½Í”õí½¹±½Í•ô±…ÍÍ9…µ”ô‰ÅÈµµ½‘…°ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰ÅÈµÁ•ÐˆøñÍÁ…¸ùíÁ•Ð¹…Ù…Ñ…Éôð½ÍÁ…¸øñ‘¥ØøñˆùíÁ•Ð¹¹…µ•ôð½ˆøñÍµ…±°ùíÁ•Ð¹‰É••‘ôƒ
ÜíÁ•Ð¹Í•áôð½Íµ…±°øð½‘¥Øøð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰ÅÈµ‰½àˆùíÍÉŒ€ü€ñ¥µœÍÉŒõíÍÉô…±Ðõí7ŒEH·†î|£†îLÏ„…¸Ñ¿¸†î„€‘íÁ•Ð¹¹…µ•õô€¼ø€è€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÅÈµ±½…‘¥¹œˆûA…¹œÓ†ê…¼EH¸¸¸ð½‘¥Øùôð½‘¥ØøñÀùE×¥ÐƒG†îá•´Ñ£†êì­£†ê¥¸†ê•À°Ó±¹ ÑË†ê…¹œÑ§©´Á£É¹œÛ€… ±§©¸£†îÛ†îm¤£†îœ¹×Ñ¤¸5¥É½¡¥ÀƒGÃ†îŒ¡”‹†îmÐƒG†î‹†ê¼Û†îÉ§©¹œÓÀ¸ð½Àøñ‘¥Ø±…ÍÍ9…µ”ô‰ÁÉ¥Ù…äµÁ¥±°ˆûÂ~RH1§©¸¯†êýÐÉ§©¹œƒ
ÜÌÑ£†îÑ¡Ô£†îM¤ð½‘¥Øøð½5½‘…±M¡•±°øì)ô()™Õ¹Ñ¥½¸¡•­½ÕÑ5½‘…°¡ì½É‘•È°½¹±½Í”°½¹MÕ•ÍÌôèì½É‘•Èè¡•­½ÕÑ=É‘•Èì½¹±½Í”è€ ¤€ôøÙ½¥ì½¹MÕ•ÍÌè€ ¤€ôøÙ½¥ô¤ì(€½¹ÍÐmÍÉŒ°Í•ÑMÉt€ôÕÍ•MÑ…Ñ” ˆˆ¤ì½¹ÍÐm‰ÕÍä°Í•Ñ	ÕÍåt€ôÕÍ•MÑ…Ñ”¡™…±Í”¤ì½¹ÍÐm•ÉÉ½È°Í•ÑÉÉ½Ét€ôÕÍ•MÑ…Ñ” ˆˆ¤ì(€ÕÍ•™™•Ð  ¤€ôøì½¹ÍÐÁ…å±½…€ôAQIð‘íAe59Q}=9%¹‰…¹­½‘•õð‘íAe59Q}=9%¹…½Õ¹Ñ9Õµ‰•È¹É•Á±…” ½qÌ½œ°€ˆˆ¥õð‘í½É‘•È¹Ñ½Ñ…±õð‘í½É‘•È¹½É‘•É½‘•õ€ìÙ½¥EI½‘”¹Ñ½…Ñ…UI0¡Á…å±½…°ìÝ¥‘Ñ è€ÌÈÀ°µ…É¥¸è€È°½±½Èèì‘…É¬è€ˆŒÄÜÈÔÍˆ°±¥¡Ðè€ˆ™™™™™˜ˆôô¤¹Ñ¡•¸¡Í•ÑMÉŒ¤ìô°m½É‘•È¹½É‘•É½‘”°½É‘•È¹Ñ½Ñ…±t¤ì(€½¹ÍÐÁ…åµ•¹ÑM•¹Ð€ô…Íå¹Œ€ ¤€ôøìÍ•Ñ	ÕÍä¡ÑÉÕ”¤ìÍ•ÑÉÉ½È ˆˆ¤ìÑÉäì½¹ÍÐÉ•ÍÁ½¹Í”€ô…Ý…¥Ð™•Ñ  ˆ½…Á¤½…ÁÀˆ°ìµ•Ñ¡½è€‰A=MPˆ°¡•…‘•ÉÌèì€‰½¹Ñ•¹ÐµQåÁ”ˆè€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆô°‰½‘äè)M=8¹ÍÑÉ¥¹¥™ä¡ì…Ñ¥½¸è€‰µ…É­=É‘•ÉA…åµ•¹ÑM•¹Ðˆ°½É‘•É%è½É‘•È¹¥ô¤ô¤ì½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•ÍÁ½¹Í”¹©Í½¸ ¤…Ìì•ÉÉ½ÈüèÍÑÉ¥¹œôì¥˜€ …É•ÍÁ½¹Í”¹½¬¤Ñ¡É½Ü¹•ÜÉÉ½È¡‰½‘ä¹•ÉÉ½È€üü€‰-£Ñ¹œÑ£†î†êµÀ¹£†êµÐÑ¡…¹ Ñ¿…¸ˆ¤ì½¹MÕ•ÍÌ ¤ìô…Ñ €¡…Õ¡Ð¤ìÍ•ÑÉÉ½È¡…Õ¡Ð¥¹ÍÑ…¹•½˜ÉÉ½È€ü…Õ¡Ð¹µ•ÍÍ…”€è€‰-£Ñ¹œÑ£†î†êµÀ¹£†êµÐÑ¡…¹ Ñ¿…¸ˆ¤ìô™¥¹…±±äìÍ•Ñ	ÕÍä¡™…±Í”¤ìôôì(€É•ÑÕÉ¸€ñ5½‘…±M¡•±°Ñ¥Ñ±”ô‰Q¡…¹ Ñ¿…¸EHˆ½¹±½Í”õí½¹±½Í•ô±…ÍÍ9…µ”ô‰¡•­½ÕÐµµ½‘…°ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Á…åµ•¹ÐµÑ½Ñ…°ˆøñÍµ…±°ùO†îDÑ§†î¸‘¼‰…­•¹ã…Œ¹£†êµ¸ð½Íµ…±°øñˆùíµ½¹•ä¡½É‘•È¹Ñ½Ñ…°¥ôð½ˆøñÍÁ…¸ù7ŒƒG…¸í½É‘•È¹½É‘•É½‘•ôð½ÍÁ…¸øð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰ÅÈµ‰½àÁ…åµ•¹ÐˆùíÍÉŒ€˜˜€ñ¥µœÍÉŒõíÍÉô…±Ðô‰7ŒEHÑ¡…¹ Ñ¿…¸ƒG…¸£¹œˆ€¼ùôð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰‰…¹¬µ¥¹™¼ˆøñÍÁ…¸ù9Ÿ‰¸£¹œ€ñˆùíAe59Q}=9%¹‰…¹­½‘•ôð½ˆøð½ÍÁ…¸øñÍÁ…¸ùO†îDÓ¤­¡¿†ê¸€ñˆùíAe59Q}=9%¹…½Õ¹Ñ9Õµ‰•Éôð½ˆøð½ÍÁ…¸øñÍÁ…¸ù£†îœÓ¤­¡¿†ê¸€ñˆùíAe59Q}=9%¹…½Õ¹Ñ9…µ•ôð½ˆøð½ÍÁ…¸øð½‘¥ØøñÀ±…ÍÍ9…µ”ô‰Á…åµ•¹Ðµ¹½Ñ”ˆûC…¸ƒGŒƒGÃ†îŒ³ÁÔÑÉ½¹œ‘…Ñ…‰…Í”¸;éÐ‹©¸“Ã†îm¤£†î$‹…¼ƒŠsGŒ¡Õç†î¸­¡¿†ê»Štì†îµ„£¹œ¡¿†êÝŒÝ•‰¡½½¬Á£†ê¤ƒG†îE¤Í¿…ÐÑËÃ†îmŒ­¡¤¡Õç†î¸Í…¹œƒGŒÑ¡…¹ Ñ¿…¸¸ð½Àùí•ÉÉ½È€˜˜€ñÀ±…ÍÍ9…µ”ô‰™½É´µ•ÉÉ½Èˆùí•ÉÉ½Éôð½Àùôñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸¡•­½ÕÐˆ‘¥Í…‰±•õí‰ÕÍåô½¹±¥¬õì ¤€ôøÙ½¥Á…åµ•¹ÑM•¹Ð ¥ôùí‰ÕÍä€ü€‹A…¹œŸ†îµ¤¸¸¸ˆ€è€‰SÑ¤ƒGŒ¡Õç†î¸­¡¿†ê¸ƒŠPŸ†îµ¤ƒG†îE¤Í¿…Ð‰ôð½‰ÕÑÑ½¸øð½5½‘…±M¡•±°øì)ô