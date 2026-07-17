import { actorFromRequest, audit, ensureDatabase, ensureUser, getD1, hasPartnerRole, type PartnerRole, validateMutationRequest } from "../../../db/runtime";

export const dynamic = "force-dynamic";

type ActionPayload = {
  action?: string;
  petId?: string;
  partnerId?: string;
  appointmentId?: string;
  productId?: string;
  orderId?: string;
  scheduledAt?: string;
  reason?: string;
  note?: string;
  status?: string;
  openNow?: boolean;
  acceptingAppointments?: boolean;
  diagnosis?: string;
  treatment?: string;
  prescription?: string;
  clinician?: string;
  stock?: number;
  active?: boolean;
  vaccineName?: string;
  batchNumber?: string;
  nextDueAt?: string;
  name?: string;
  category?: string;
  price?: number;
  description?: string;
  visual?: string;
  petName?: string;
  species?: string;
  breed?: string;
  sex?: string;
  dateOfBirth?: string;
  weightKg?: number;
  bloodType?: string;
  microchip?: string;
  allergies?: string;
  petNotes?: string;
  partnerType?: string;
  address?: string;
  phone?: string;
  hours?: string;
  services?: string;
  latitude?: number;
  longitude?: number;
  items?: Array<{ productId?: string; quantity?: number }>;
};

type OrderRow = Record<string, unknown> & { id: string };
type OrderItemRow = Record<string, unknown> & { order_id: string };

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "Vary": "oai-authenticated-user-email" };
const safeText = (value: unknown, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";
const jsonError = (message: string, status = 400) => Response.json({ error: message }, { status, headers: PRIVATE_HEADERS });
const validDate = (value: string) => Boolean(value) && !Number.isNaN(Date.parse(value));
const validPhone = (value: string) => /^[0-9+().\s-]{7,30}$/.test(value);
const validCoordinates = (latitude: number, longitude: number) => Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
const cleanServices = (value: unknown) => safeText(value, 500).split(/[|,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 12).join("|");

function attachOrderItems(orders: OrderRow[], items: OrderItemRow[]) {
  const grouped = new Map<string, OrderItemRow[]>();
  for (const item of items) grouped.set(item.order_id, [...(grouped.get(item.order_id) ?? []), item]);
  return orders.map((order) => ({ ...order, items: grouped.get(order.id) ?? [] }));
}

async function loadData(request: Request) {
  const db = getD1();
  await ensureDatabase(db);
  const actor = actorFromRequest(request);
  if (actor) await ensureUser(db, actor);
  const email = actor?.email ?? "";

  const [products, partners, pets, appointments, vaccinations, medicalRecords, partnerRoles, partnerAppointments, partnerProducts, partnerPets, orders, orderItems, partnerOrders, partnerOrderItems] = await Promise.all([
    db.prepare(`SELECT p.* FROM products p JOIN partners pr ON pr.id = p.partner_id WHERE p.active = 1 AND p.stock > 0 AND pr.verified = 1 ORDER BY p.sold DESC LIMIT 48`).all(),
    actor
      ? db.prepare(`SELECT * FROM partners WHERE verified = 1 OR id IN (SELECT partner_id FROM partner_users WHERE email = ?) ORDER BY verified DESC, open_now DESC, distance_km ASC`).bind(email).all()
      : db.prepare(`SELECT * FROM partners WHERE verified = 1 ORDER BY open_now DESC, distance_km ASC`).all(),
    db.prepare(`SELECT * FROM pets WHERE owner_email = ? ORDER BY created_at ASC`).bind(email).all(),
    db.prepare(`SELECT a.*, p.name AS pet_name, pr.name AS partner_name FROM appointments a JOIN pets p ON p.id = a.pet_id JOIN partners pr ON pr.id = a.partner_id WHERE a.owner_email = ? ORDER BY a.scheduled_at DESC`).bind(email).all(),
    db.prepare(`SELECT v.* FROM vaccinations v JOIN pets p ON p.id = v.pet_id WHERE p.owner_email = ? ORDER BY v.administered_at DESC`).bind(email).all(),
    db.prepare(`SELECT m.*, pr.name AS partner_name FROM medical_records m JOIN pets p ON p.id = m.pet_id JOIN partners pr ON pr.id = m.partner_id WHERE p.owner_email = ? ORDER BY m.visited_at DESC`).bind(email).all(),
    actor ? db.prepare(`SELECT pu.partner_id, pu.role, p.name FROM partner_users pu JOIN partners p ON p.id = pu.partner_id WHERE pu.email = ? ORDER BY p.name`).bind(email).all() : Promise.resolve({ results: [] }),
    actor ? db.prepare(`SELECT a.*, p.name AS pet_name, p.avatar AS pet_avatar, p.breed AS pet_breed, pr.name AS partner_name FROM appointments a JOIN pets p ON p.id = a.pet_id JOIN partners pr ON pr.id = a.partner_id WHERE a.partner_id IN (SELECT partner_id FROM partner_users WHERE email = ?) ORDER BY a.scheduled_at ASC`).bind(email).all() : Promise.resolve({ results: [] }),
    actor ? db.prepare(`SELECT * FROM products WHERE partner_id IN (SELECT partner_id FROM partner_users WHERE email = ? AND role IN ('owner','manager')) ORDER BY updated_at DESC`).bind(email).all() : Promise.resolve({ results: [] }),
    actor ? db.prepare(`SELECT DISTINCT p.* FROM pets p JOIN appointments a ON a.pet_id = p.id WHERE a.partner_id IN (SELECT partner_id FROM partner_users WHERE email = ? AND role IN ('owner','clinician')) ORDER BY p.updated_at DESC`).bind(email).all() : Promise.resolve({ results: [] }),
    db.prepare(`SELECT o.*, p.name AS partner_name FROM orders o JOIN partners p ON p.id = o.partner_id WHERE o.owner_email = ? ORDER BY o.created_at DESC LIMIT 30`).bind(email).all(),
    db.prepare(`SELECT oi.* FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.owner_email = ? ORDER BY oi.id`).bind(email).all(),
    actor ? db.prepare(`SELECT o.*, p.name AS partner_name FROM orders o JOIN partners p ON p.id = o.partner_id WHERE o.partner_id IN (SELECT partner_id FROM partner_users WHERE email = ? AND role IN ('owner','manager')) ORDER BY o.created_at DESC LIMIT 100`).bind(email).all() : Promise.resolve({ results: [] }),
    actor ? db.prepare(`SELECT oi.* FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.partner_id IN (SELECT partner_id FROM partner_users WHERE email = ? AND role IN ('owner','manager')) ORDER BY oi.id`).bind(email).all() : Promise.resolve({ results: [] }),
  ]);

  return Response.json({
    actor: actor ? { email: actor.email, fullName: actor.fullName, isDemo: actor.isDemo } : null,
    requiresSignIn: !actor,
    products: products.results,
    partners: partners.results,
    pets: pets.results,
    appointments: appointments.results,
    vaccinations: vaccinations.results,
    medicalRecords: medicalRecords.results,
    partnerRoles: partnerRoles.results,
    partnerAppointments: partnerAppointments.results,
    partnerProducts: partnerProducts.results,
    partnerPets: partnerPets.results,
    orders: attachOrderItems(orders.results as OrderRow[], orderItems.results as OrderItemRow[]),
    partnerOrders: attachOrderItems(partnerOrders.results as OrderRow[], partnerOrderItems.results as OrderItemRow[]),
  }, { headers: PRIVATE_HEADERS });
}

export async function GET(request: Request) {
  try {
    return await loadData(request);
  } catch (error) {
    console.error("bootstrap_failed", error);
    const message = process.env.NODE_ENV !== "production" && error instanceof Error ? `Không thể tải dữ liệu: ${error.message}` : "Không thể tải dữ liệu. Vui lòng thử lại.";
    return jsonError(message, 500);
  }
}

async function requireRole(db: D1Database, email: string, partnerId: string, roles: PartnerRole[]) {
  return Boolean(partnerId && await hasPartnerRole(db, email, partnerId, roles));
}

function validatePet(payload: ActionPayload) {
  const name = safeText(payload.petName, 80);
  const species = safeText(payload.species, 40);
  const breed = safeText(payload.breed, 100);
  const sex = safeText(payload.sex, 40);
  const dateOfBirth = safeText(payload.dateOfBirth, 20);
  const weightKg = Number(payload.weightKg);
  const valid = name && species && breed && sex && validDate(dateOfBirth) && Date.parse(dateOfBirth) <= Date.now() && Number.isFinite(weightKg) && weightKg > 0 && weightKg <= 250;
  return valid ? { name, species, breed, sex, dateOfBirth, weightKg } : null;
}

export async function POST(request: Request) {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return jsonError(invalidRequest, invalidRequest.includes("nguồn") || invalidRequest.includes("Origin") ? 403 : invalidRequest.includes("vượt quá") ? 413 : 400);
  const actor = actorFromRequest(request);
  if (!actor) return jsonError("Bạn cần đăng nhập để thực hiện thao tác này.", 401);

  let payload: ActionPayload;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 32_768) return jsonError("Dữ liệu gửi lên vượt quá giới hạn", 413);
    payload = JSON.parse(raw) as ActionPayload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return jsonError("JSON không hợp lệ");
  } catch {
    return jsonError("JSON không hợp lệ");
  }

  try {
    const db = getD1();
    await ensureDatabase(db);
    await ensureUser(db, actor);
    const now = new Date().toISOString();

    if (payload.action === "registerPartner") {
      const count = await db.prepare(`SELECT COUNT(*) AS count FROM partner_users WHERE email = ? AND role = 'owner'`).bind(actor.email).first<{ count: number }>();
      if (Number(count?.count ?? 0) >= 5) return jsonError("Một tài khoản chỉ được đăng ký tối đa 5 cơ sở.", 409);
      const name = safeText(payload.name, 160);
      const type = safeText(payload.partnerType, 10);
      const address = safeText(payload.address, 300);
      const phone = safeText(payload.phone, 30);
      const hours = safeText(payload.hours, 160);
      const services = cleanServices(payload.services);
      const latitude = Number(payload.latitude);
      const longitude = Number(payload.longitude);
      if (!name || !["vet", "shop", "both"].includes(type) || !address || !validPhone(phone) || !hours || !services || !validCoordinates(latitude, longitude)) return jsonError("Thông tin đăng ký cơ sở không hợp lệ.");
      const id = `partner-${crypto.randomUUID()}`;
      await db.batch([
        db.prepare(`INSERT INTO partners (id,name,type,address,latitude,longitude,phone,rating,review_count,open_now,accepting_appointments,hours,services,distance_km,verified,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, name, type, address, latitude, longitude, phone, 0, 0, 0, 0, hours, services, 0, 0, now),
        db.prepare(`INSERT INTO partner_users (email,partner_id,role) VALUES (?,?,?)`).bind(actor.email, id, "owner"),
      ]);
      await audit(db, actor.email, "partner.register", "partner", id);
      return Response.json({ ok: true, id, role: "owner", verificationStatus: "pending" }, { status: 201, headers: PRIVATE_HEADERS });
    }

    if (payload.action === "createAppointment") {
      const petId = safeText(payload.petId, 80);
      const partnerId = safeText(payload.partnerId, 80);
      const reason = safeText(payload.reason, 160);
      const scheduledAt = safeText(payload.scheduledAt, 64);
      if (!petId || !partnerId || !reason || !scheduledAt) return jsonError("Thiếu thông tin đặt lịch.");
      if (!validDate(scheduledAt) || Date.parse(scheduledAt) < Date.now() - 60_000) return jsonError("Thời gian khám không hợp lệ.");
      const ownedPet = await db.prepare(`SELECT id FROM pets WHERE id = ? AND owner_email = ?`).bind(petId, actor.email).first();
      const partner = await db.prepare(`SELECT id FROM partners WHERE id = ? AND verified = 1 AND type IN ('vet','both') AND accepting_appointments = 1`).bind(partnerId).first();
      if (!ownedPet) return jsonError("Bạn không có quyền đặt lịch cho hồ sơ này.", 403);
      if (!partner) return jsonError("Cơ sở này hiện chưa nhận lịch.", 409);
      const id = `appt-${crypto.randomUUID()}`;
      await db.prepare(`INSERT INTO appointments (id,owner_email,pet_id,partner_id,scheduled_at,reason,note,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id, actor.email, petId, partnerId, scheduledAt, reason, safeText(payload.note, 500), "pending", now, now).run();
      await audit(db, actor.email, "appointment.create", "appointment", id);
      return Response.json({ ok: true, id, status: "pending" }, { status: 201, headers: PRIVATE_HEADERS });
    }

    if (payload.action === "createPet" || payload.action === "updatePet") {
      const pet = validatePet(payload);
      if (!pet) return jsonError("Thông tin hồ sơ pet không hợp lệ.");
      const bloodType = safeText(payload.bloodType, 40) || null;
      const microchip = safeText(payload.microchip, 80) || null;
      const avatar = pet.species.toLowerCase().includes("mèo") ? "🐱" : pet.species.toLowerCase().includes("chó") ? "🐶" : "🐾";
      if (payload.action === "createPet") {
        const id = `pet-${crypto.randomUUID()}`;
        await db.prepare(`INSERT INTO pets (id,owner_email,name,species,breed,sex,date_of_birth,weight_kg,blood_type,microchip,allergies,notes,avatar,qr_token,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, actor.email, pet.name, pet.species, pet.breed, pet.sex, pet.dateOfBirth, pet.weightKg, bloodType, microchip, safeText(payload.allergies, 300), safeText(payload.petNotes, 500), avatar, `petcare-${crypto.randomUUID()}`, now, now).run();
        await audit(db, actor.email, "pet.create", "pet", id);
        return Response.json({ ok: true, id }, { status: 201, headers: PRIVATE_HEADERS });
      }
      const petId = safeText(payload.petId, 100);
      const owned = await db.prepare(`SELECT id FROM pets WHERE id = ? AND owner_email = ?`).bind(petId, actor.email).first();
      if (!owned) return jsonError("Bạn không có quyền sửa hồ sơ này.", 403);
      await db.prepare(`UPDATE pets SET name=?,species=?,breed=?,sex=?,date_of_birth=?,weight_kg=?,blood_type=?,microchip=?,allergies=?,notes=?,avatar=?,updated_at=? WHERE id=? AND owner_email=?`).bind(pet.name, pet.species, pet.breed, pet.sex, pet.dateOfBirth, pet.weightKg, bloodType, microchip, safeText(payload.allergies, 300), safeText(payload.petNotes, 500), avatar, now, petId, actor.email).run();
      await audit(db, actor.email, "pet.update", "pet", petId);
      return Response.json({ ok: true }, { headers: PRIVATE_HEADERS });
    }

    if (payload.action === "rotatePetQr") {
      const petId = safeText(payload.petId, 100);
      const owned = await db.prepare(`SELECT id FROM pets WHERE id = ? AND owner_email = ?`).bind(petId, actor.email).first();
      if (!owned) return jsonError("Bạn không có quyền cấp lại QR này.", 403);
      const token = `petcare-${crypto.randomUUID()}`;
      await db.prepare(`UPDATE pets SET qr_token = ?, updated_at = ? WHERE id = ? AND owner_email = ?`).bind(token, now, petId, actor.email).run();
      await audit(db, actor.email, "pet.qr.rotate", "pet", petId);
      return Response.json({ ok: true, qrToken: token }, { headers: PRIVATE_HEADERS });
    }

    if (payload.action === "updateAppointmentStatus") {
      const appointmentId = safeText(payload.appointmentId, 100);
      const status = safeText(payload.status, 20);
      const appointment = await db.prepare(`SELECT partner_id,status FROM appointments WHERE id = ?`).bind(appointmentId).first<{ partner_id: string; status: string }>();
      if (!appointment || !(await requireRole(db, actor.email, appointment.partner_id, ["owner", "manager", "staff"]))) return jsonError("Bạn không có quyền duyệt lịch này.", 403);
      const allowed = appointment.status === "pending" ? ["confirmed", "cancelled"] : appointment.status === "confirmed" ? ["cancelled"] : [];
      if (!allowed.includes(status)) return jsonError("Chuyển trạng thái lịch không hợp lệ.", 409);
      await db.prepare(`UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?`).bind(status, now, appointmentId).run();
      await audit(db, actor.email, `appointment.${status}`, "appointment", appointmentId);
      return Response.json({ ok: true }, { headers: PRIVATE_HEADERS });
    }

    if (payload.action === "updatePartnerStatus") {
      const partnerId = safeText(payload.partnerId, 80);
      if (!(await requireRole(db, actor.email, partnerId, ["owner", "manager"]))) return jsonError("Bạn không có quyền cập nhật cơ sở này.", 403);
      await db.prepare(`UPDATE partners SET open_now = ?, accepting_appointments = ?, updated_at = ? WHERE id = ?`).bind(payload.openNow ? 1 : 0, payload.acceptingAppointments ? 1 : 0, now, partnerId).run();
      await audit(db, actor.email, "partner.status.update", "partner", partnerId);
      return Response.json({ ok: true }, { headers: PRIVATE_HEADERS });
    }

    if (payload.action === "updatePartnerProfile") {
      const partnerId = safeText(payload.partnerId, 80);
      if (!(await requireRole(db, actor.email, partnerId, ["owner", "manager"]))) return jsonError("Bạn không có quyền sửa hồ sơ cơ sở này.", 403);
      const name = safeText(payload.name, 160);
      const address = safeText(payload.address, 300);
      const phone = safeText(payload.phone, 30);
      const hours = safeText(payload.hours, 160);
      const services = cleanServices(payload.services);
      const latitude = Number(payload.latitude);
      const longitude = Number(payload.longitude);
      if (!name || !address || !validPhone(phone) || !hours || !services || !validCoordinates(latitude, longitude)) return jsonError("Thông tin cơ sở không hợp lệ.");
      await db.prepare(`UPDATE partners SET name=?,address=?,phone=?,hours=?,services=?,latitude=?,longitude=?,updated_at=? WHERE id=?`).bind(name, address, phone, hours, services, latitude, longitude, now, partnerId).run();
      await audit(db, actor.email, "partner.profile.update", "partner", partnerId);
      return Response.json({ ok: true }, { headers: PRIVATE_HEADERS });
    }

    if (payload.action === "addMedicalRecord") {
      const appointmentId = safeText(payload.appointmentId, 100);
      const appointment = await db.prepare(`SELECT a.pet_id,a.partner_id,a.status,p.name AS partner_name,p.type AS partner_type FROM appointments a JOIN partners p ON p.id=a.partner_id WHERE a.id=?`).bind(appointmentId).first<{ pet_id: string; partner_id: string; status: string; partner_name: string; partner_type: string }>();
      if (!appointment || !(await requireRole(db, actor.email, appointment.partner_id, ["owner", "clinician"]))) return jsonError("Bạn không có quyền cập nhật hồ sơ này.", 403);
      if (appointment.partner_type === "shop" || appointment.status !== "confirmed") return jsonError("Chỉ ca khám đã xác nhận mới được cập nhật hồ sơ.", 409);
      const existing = await db.prepare(`SELECT id FROM medical_records WHERE appointment_id = ?`).bind(appointmentId).first();
      if (existing) return jsonError("Ca khám này đã có hồ sơ hoàn tất.", 409);
      const diagnosis = safeText(payload.diagnosis, 500);
      const treatment = safeText(payload.treatment, 800);
      const clinician = safeText(payload.clinician, 120);
      if (!diagnosis || !treatment || !clinician) return jsonError("Chẩn đoán, điều trị và bác sĩ là bắt buộc.");
      const id = `med-${crypto.randomUUID()}`;
      const statements = [
        db.prepare(`INSERT INTO medical_records (id,pet_id,partner_id,appointment_id,diagnosis,treatment,prescription,clinician,visited_at,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, appointment.pet_id, appointment.partner_id, appointmentId, diagnosis, treatment, safeText(payload.prescription, 800), clinician, now, safeText(payload.note, 800), now),
        db.prepare(`UPDATE appointments SET status = 'completed', updated_at = ? WHERE id = ? AND status = 'confirmed'`).bind(now, appointmentId),
      ];
      const vaccineName = safeText(payload.vaccineName, 160);
      if (vaccineName) {
        const batchNumber = safeText(payload.batchNumber, 80);
        const nextDueAt = safeText(payload.nextDueAt, 32);
        if (!batchNumber || (nextDueAt && !validDate(nextDueAt))) return jsonError("Thông tin mũi tiêm không hợp lệ.");
        statements.push(db.prepare(`INSERT INTO vaccinations (id,pet_id,vaccine_name,dose,administered_at,next_due_at,provider_name,batch_number,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(`vac-${crypto.randomUUID()}`, appointment.pet_id, vaccineName, "Mũi đã xác nhận", now, nextDueAt || null, appointment.partner_name, batchNumber, "completed", now));
      }
      await db.batch(statements);
      await audit(db, actor.email, "medical_record.create", "medical_record", id);
      return Response.json({ ok: true, id }, { status: 201, headers: PRIVATE_HEADERS });
    }

    if (payload.action === "updateProduct") {
      const productId = safeText(payload.productId, 100);
      const product = await db.prepare(`SELECT partner_id FROM products WHERE id = ?`).bind(productId).first<{ partner_id: string }>();
      if (!product || !(await requireRole(db, actor.email, product.partner_id, ["owner", "manager"]))) return jsonError("Bạn không có quyền cập nhật sản phẩm này.", 403);
      const stock = Number(payload.stock);
      if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) return jsonError("Tồn kho không hợp lệ.");
      await db.prepare(`UPDATE products SET stock = ?, active = ?, updated_at = ? WHERE id = ?`).bind(stock, payload.active === false ? 0 : 1, now, productId).run();
      await audit(db, actor.email, "product.update", "product", productId);
      return Response.json({ ok: true }, { headers: PRIVATE_HEADERS });
    }

    if (payload.action === "createProduct") {
      const partnerId = safeText(payload.partnerId, 80);
      if (!(await requireRole(db, actor.email, partnerId, ["owner", "manager"]))) return jsonError("Bạn không có quyền đăng sản phẩm cho cơ sở này.", 403);
      const name = safeText(payload.name, 160);
      const category = safeText(payload.category, 80);
      const description = safeText(payload.description, 500);
      const price = Number(payload.price);
      const stock = Number(payload.stock);
      if (!name || !category || !description || !Number.isInteger(price) || price < 0 || price > 200_000_000 || !Number.isInteger(stock) || stock < 0 || stock > 1_000_000) return jsonError("Thông tin sản phẩm không hợp lệ.");
      const id = `prod-${crypto.randomUUID()}`;
      await db.prepare(`INSERT INTO products (id,partner_id,name,category,price,original_price,visual,visual_tone,rating,sold,stock,badge,description,active,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, partnerId, name, category, price, null, safeText(payload.visual, 8) || "🎁", "mint", 0, 0, stock, "Mới", description, 1, now).run();
      await audit(db, actor.email, "product.create", "product", id);
      return Response.json({ ok: true, id }, { status: 201, headers: PRIVATE_HEADERS });
    }

    if (payload.action === "createOrder") {
      if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 30) return jsonError("Giỏ hàng không hợp lệ.");
      const quantities = new Map<string, number>();
      for (const item of payload.items) {
        const productId = safeText(item?.productId, 100);
        const quantity = Number(item?.quantity);
        if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return jsonError("Số lượng sản phẩm không hợp lệ.");
        quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
      }
      if (quantities.size > 20 || [...quantities.values()].some((quantity) => quantity > 99)) return jsonError("Giỏ hàng vượt quá giới hạn.");
      const lines: Array<{ id: string; partnerId: string; name: string; price: number; quantity: number; total: number }> = [];
      for (const [productId, quantity] of quantities) {
        const product = await db.prepare(`SELECT p.id,p.partner_id,p.name,p.price,p.stock,p.active,pr.verified FROM products p JOIN partners pr ON pr.id=p.partner_id WHERE p.id=?`).bind(productId).first<{ id: string; partner_id: string; name: string; price: number; stock: number; active: number; verified: number }>();
        if (!product || !product.active || !product.verified || product.stock < quantity) return jsonError("Sản phẩm đã hết hàng hoặc không còn được bán.", 409);
        lines.push({ id: product.id, partnerId: product.partner_id, name: product.name, price: product.price, quantity, total: product.price * quantity });
      }
      const partnerId = lines[0]?.partnerId;
      if (!partnerId || lines.some((line) => line.partnerId !== partnerId)) return jsonError("Mỗi đơn hàng hiện chỉ hỗ trợ sản phẩm từ một cửa hàng.", 409);
      const total = lines.reduce((sum, line) => sum + line.total, 0);
      if (!Number.isSafeInteger(total) || total <= 0 || total > 200_000_000) return jsonError("Tổng đơn hàng không hợp lệ.");
      const id = `order-${crypto.randomUUID()}`;
      const orderCode = `PAW${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      await db.batch([
        db.prepare(`INSERT INTO orders (id,order_code,owner_email,partner_id,total_amount,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).bind(id, orderCode, actor.email, partnerId, total, "pending_payment", now, now),
        ...lines.map((line) => db.prepare(`INSERT INTO order_items (id,order_id,product_id,product_name,unit_price,quantity,line_total) VALUES (?,?,?,?,?,?,?)`).bind(`item-${crypto.randomUUID()}`, id, line.id, line.name, line.price, line.quantity, line.total)),
      ]);
      await audit(db, actor.email, "order.create", "order", id);
      return Response.json({ ok: true, id, orderCode, total, status: "pending_payment" }, { status: 201, headers: PRIVATE_HEADERS });
    }

    if (payload.action === "markOrderPaymentSent") {
      const orderId = safeText(payload.orderId, 100);
      const order = await db.prepare(`SELECT status FROM orders WHERE id=? AND owner_email=?`).bind(orderId, actor.email).first<{ status: string }>();
      if (!order) return jsonError("Không tìm thấy đơn hàng.", 404);
      if (order.status !== "pending_payment") return jsonError("Đơn hàng không ở trạng thái chờ thanh toán.", 409);
      await db.prepare(`UPDATE orders SET status='payment_review',updated_at=? WHERE id=? AND owner_email=?`).bind(now, orderId, actor.email).run();
      await audit(db, actor.email, "order.payment_submitted", "order", orderId);
      return Response.json({ ok: true, status: "payment_review" }, { headers: PRIVATE_HEADERS });
    }

    if (payload.action === "updateOrderStatus") {
      const orderId = safeText(payload.orderId, 100);
      const nextStatus = safeText(payload.status, 30);
      const order = await db.prepare(`SELECT partner_id,status FROM orders WHERE id=?`).bind(orderId).first<{ partner_id: string; status: string }>();
      if (!order || !(await requireRole(db, actor.email, order.partner_id, ["owner", "manager"]))) return jsonError("Bạn không có quyền cập nhật đơn hàng này.", 403);
      const transitions: Record<string, string[]> = { pending_payment: ["cancelled"], payment_review: ["paid", "cancelled"], paid: ["fulfilled"] };
      if (!(transitions[order.status] ?? []).includes(nextStatus)) return jsonError("Chuyển trạng thái đơn hàng không hợp lệ.", 409);
      const statements = [db.prepare(`UPDATE orders SET status=?,updated_at=? WHERE id=? AND status=?`).bind(nextStatus, now, orderId, order.status)];
      if (nextStatus === "paid") {
        const items = await db.prepare(`SELECT product_id,quantity FROM order_items WHERE order_id=?`).bind(orderId).all<{ product_id: string; quantity: number }>();
        for (const item of items.results) {
          const product = await db.prepare(`SELECT stock FROM products WHERE id=?`).bind(item.product_id).first<{ stock: number }>();
          if (!product || product.stock < item.quantity) return jsonError("Không đủ tồn kho để xác nhận thanh toán.", 409);
          statements.push(db.prepare(`UPDATE products SET stock=stock-?,sold=sold+?,updated_at=? WHERE id=?`).bind(item.quantity, item.quantity, now, item.product_id));
        }
      }
      await db.batch(statements);
      await audit(db, actor.email, `order.${nextStatus}`, "order", orderId);
      return Response.json({ ok: true, status: nextStatus }, { headers: PRIVATE_HEADERS });
    }

    return jsonError("Thao tác không được hỗ trợ.", 404);
  } catch (error) {
    console.error("mutation_failed", error);
    return jsonError("Không thể lưu thay đổi. Vui lòng thử lại.", 500);
  }
}
