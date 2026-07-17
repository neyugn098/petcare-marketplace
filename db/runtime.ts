import { env } from "cloudflare:workers";

export type Actor = { email: string; fullName: string; isDemo: boolean };
export type PartnerRole = "owner" | "manager" | "clinician" | "staff";

type MutationLimit = { limit: number; windowMs: number };

const MUTATION_LIMITS: Record<string, MutationLimit> = {
  registerPartner: { limit: 3, windowMs: 24 * 60 * 60 * 1000 },
  createAppointment: { limit: 12, windowMs: 10 * 60 * 1000 },
  createPet: { limit: 10, windowMs: 24 * 60 * 60 * 1000 },
  updatePet: { limit: 60, windowMs: 60 * 60 * 1000 },
  rotatePetQr: { limit: 5, windowMs: 60 * 60 * 1000 },
  updateAppointmentStatus: { limit: 120, windowMs: 60 * 60 * 1000 },
  updatePartnerStatus: { limit: 240, windowMs: 60 * 60 * 1000 },
  updatePartnerProfile: { limit: 30, windowMs: 60 * 60 * 1000 },
  addMedicalRecord: { limit: 60, windowMs: 60 * 60 * 1000 },
  updateProduct: { limit: 240, windowMs: 60 * 60 * 1000 },
  createProduct: { limit: 100, windowMs: 24 * 60 * 60 * 1000 },
  createOrder: { limit: 20, windowMs: 10 * 60 * 1000 },
  markOrderPaymentSent: { limit: 30, windowMs: 60 * 60 * 1000 },
  updateOrderStatus: { limit: 120, windowMs: 60 * 60 * 1000 },
};

const IDENTITY_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;

export function getD1(): D1Database {
  const runtimeEnv = env as unknown as { DB?: D1Database };
  if (!runtimeEnv.DB) throw new Error("D1 binding DB is unavailable");
  return runtimeEnv.DB;
}

export function actorFromRequest(request: Request): Actor | null {
  const rawEmail = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const email = rawEmail && rawEmail.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;
  if (email) {
    const encodedName = request.headers.get("oai-authenticated-user-full-name");
    const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
    let fullName = email;
    if (encodedName && encoding === "percent-encoded-utf-8") {
      try {
        fullName = Array.from(decodeURIComponent(encodedName).normalize("NFC").replace(IDENTITY_CONTROL_CHARACTERS, " ").trim()).slice(0, 160).join("") || email;
      } catch {
        fullName = email;
      }
    }
    return { email, fullName, isDemo: false };
  }

  if (process.env.NODE_ENV !== "production") {
    return { email: "demo@petcare.local", fullName: "Minh Anh", isDemo: true };
  }
  return null;
}

export function validateMutationRequest(request: Request): string | null {
  const contentType = (request.headers.get("content-type") ?? "").split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return "Content-Type phải là application/json";
  const rawContentLength = request.headers.get("content-length");
  if (rawContentLength) {
    const contentLength = Number(rawContentLength);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) return "Content-Length không hợp lệ";
    if (contentLength > 32_768) return "Dữ liệu gửi lên vượt quá giới hạn";
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return "Yêu cầu không cùng nguồn";

  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  if (origin) {
    try {
      if (new URL(origin).origin !== requestOrigin) return "Yêu cầu không cùng nguồn";
    } catch {
      return "Origin không hợp lệ";
    }
  } else if (process.env.NODE_ENV === "production") {
    return "Thiếu Origin của yêu cầu";
  }
  return null;
}

export async function ensureDatabase(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY NOT NULL, full_name TEXT NOT NULL, created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS partners (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('vet','shop','both')), address TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, phone TEXT NOT NULL, rating REAL NOT NULL DEFAULT 0, review_count INTEGER NOT NULL DEFAULT 0, open_now INTEGER NOT NULL DEFAULT 0, accepting_appointments INTEGER NOT NULL DEFAULT 0, hours TEXT NOT NULL, services TEXT NOT NULL, distance_km REAL NOT NULL DEFAULT 0, verified INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS partner_users (email TEXT NOT NULL, partner_id TEXT NOT NULL REFERENCES partners(id), role TEXT NOT NULL CHECK(role IN ('owner','manager','clinician','staff')), UNIQUE(email, partner_id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS pets (id TEXT PRIMARY KEY NOT NULL, owner_email TEXT NOT NULL, name TEXT NOT NULL, species TEXT NOT NULL, breed TEXT NOT NULL, sex TEXT NOT NULL, date_of_birth TEXT NOT NULL, weight_kg REAL NOT NULL, blood_type TEXT, microchip TEXT, allergies TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '🐕', qr_token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS vaccinations (id TEXT PRIMARY KEY NOT NULL, pet_id TEXT NOT NULL REFERENCES pets(id), vaccine_name TEXT NOT NULL, dose TEXT NOT NULL, administered_at TEXT NOT NULL, next_due_at TEXT, provider_name TEXT NOT NULL, batch_number TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('completed','due','overdue')), created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY NOT NULL, owner_email TEXT NOT NULL, pet_id TEXT NOT NULL REFERENCES pets(id), partner_id TEXT NOT NULL REFERENCES partners(id), scheduled_at TEXT NOT NULL, reason TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('pending','confirmed','completed','cancelled')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS medical_records (id TEXT PRIMARY KEY NOT NULL, pet_id TEXT NOT NULL REFERENCES pets(id), partner_id TEXT NOT NULL REFERENCES partners(id), appointment_id TEXT REFERENCES appointments(id), diagnosis TEXT NOT NULL, treatment TEXT NOT NULL, prescription TEXT NOT NULL DEFAULT '', clinician TEXT NOT NULL, visited_at TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY NOT NULL, partner_id TEXT NOT NULL REFERENCES partners(id), name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL CHECK(price >= 0), original_price INTEGER, visual TEXT NOT NULL, visual_tone TEXT NOT NULL, rating REAL NOT NULL DEFAULT 0, sold INTEGER NOT NULL DEFAULT 0, stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0), badge TEXT, description TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY NOT NULL, actor_email TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY NOT NULL, order_code TEXT NOT NULL UNIQUE, owner_email TEXT NOT NULL, partner_id TEXT NOT NULL REFERENCES partners(id), total_amount INTEGER NOT NULL CHECK(total_amount >= 0), status TEXT NOT NULL CHECK(status IN ('pending_payment','payment_review','paid','cancelled','fulfilled')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id), product_name TEXT NOT NULL, unit_price INTEGER NOT NULL CHECK(unit_price >= 0), quantity INTEGER NOT NULL CHECK(quantity > 0), line_total INTEGER NOT NULL CHECK(line_total >= 0))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS pet_owner_idx ON pets(owner_email)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS vaccination_pet_idx ON vaccinations(pet_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS appointment_owner_idx ON appointments(owner_email)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS appointment_partner_idx ON appointments(partner_id, scheduled_at)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS appointment_active_slot_unique ON appointments(owner_email, pet_id, partner_id, scheduled_at) WHERE status IN ('pending','confirmed')`),
    db.prepare(`CREATE INDEX IF NOT EXISTS medical_record_pet_idx ON medical_records(pet_id, visited_at)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS medical_record_appointment_unique ON medical_records(appointment_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS product_partner_idx ON products(partner_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS order_owner_idx ON orders(owner_email, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS order_partner_idx ON orders(partner_id, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS order_item_order_idx ON order_items(order_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS audit_rate_idx ON audit_logs(actor_email, action, created_at)`),
  ]);

  const runtimeEnv = env as unknown as { PETCARE_SEED_DEMO?: string };
  const seedDemo = process.env.NODE_ENV !== "production" || runtimeEnv.PETCARE_SEED_DEMO === "true";
  if (!seedDemo) return;

  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO partners (id,name,type,address,latitude,longitude,phone,rating,review_count,open_now,accepting_appointments,hours,services,distance_km,verified,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind("vet-happy-paws", "Thú y Happy Paws", "vet", "28 Nguyễn Thị Minh Khai, Quận 1, TP.HCM", 10.7821, 106.7001, "028 7300 8855", 4.9, 328, 1, 1, "Mở đến 21:00", "Khám tổng quát|Tiêm phòng|Cấp cứu 24/7", 0.8, 1, now),
    db.prepare(`INSERT OR IGNORE INTO partners (id,name,type,address,latitude,longitude,phone,rating,review_count,open_now,accepting_appointments,hours,services,distance_km,verified,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind("shop-paw-mart", "Paw Mart Nguyễn Huệ", "shop", "112 Nguyễn Huệ, Quận 1, TP.HCM", 10.7744, 106.7037, "028 6688 2200", 4.8, 204, 1, 0, "Mở đến 22:00", "Thức ăn|Phụ kiện|Grooming", 1.2, 1, now),
    db.prepare(`INSERT OR IGNORE INTO partners (id,name,type,address,latitude,longitude,phone,rating,review_count,open_now,accepting_appointments,hours,services,distance_km,verified,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind("vet-an-viet", "Bệnh viện thú y An Việt", "both", "65 Trần Hưng Đạo, Quận 5, TP.HCM", 10.7549, 106.6674, "028 3923 7711", 4.7, 189, 0, 0, "Mở lại lúc 07:30", "Xét nghiệm|Phẫu thuật|Nhà thuốc", 2.6, 1, now),
    db.prepare(`INSERT OR IGNORE INTO partner_users (email, partner_id, role) VALUES (?,?,?)`).bind("partner@petcare.local", "vet-happy-paws", "owner"),
    db.prepare(`INSERT OR IGNORE INTO partner_users (email, partner_id, role) VALUES (?,?,?)`).bind("demo@petcare.local", "vet-happy-paws", "owner"),
    db.prepare(`INSERT OR IGNORE INTO partner_users (email, partner_id, role) VALUES (?,?,?)`).bind("demo@petcare.local", "shop-paw-mart", "manager"),
    db.prepare(`INSERT OR IGNORE INTO users (email, full_name, created_at) VALUES (?,?,?)`).bind("demo@petcare.local", "Minh Anh", now),
    db.prepare(`INSERT OR IGNORE INTO pets (id,owner_email,name,species,breed,sex,date_of_birth,weight_kg,blood_type,microchip,allergies,notes,avatar,qr_token,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind("pet-miso", "demo@petcare.local", "Miso", "Chó", "Corgi Pembroke", "Đực", "2022-05-18", 11.8, "DEA 1.1-", "900215004812339", "Dị ứng nhẹ với thịt bò", "Năng động, thân thiện", "🐶", "petcare-miso-9fc12a", now, now),
    db.prepare(`INSERT OR IGNORE INTO vaccinations (id,pet_id,vaccine_name,dose,administered_at,next_due_at,provider_name,batch_number,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind("vac-miso-rabies", "pet-miso", "Vaccine dại Rabisin", "Mũi nhắc", "2026-02-20", "2027-02-20", "Thú y Happy Paws", "RB-260220-A7", "completed", now),
    db.prepare(`INSERT OR IGNORE INTO vaccinations (id,pet_id,vaccine_name,dose,administered_at,next_due_at,provider_name,batch_number,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind("vac-miso-7in1", "pet-miso", "Vaccine 7 bệnh", "Mũi 3", "2025-09-12", "2026-09-12", "Thú y Happy Paws", "VN7-250912-C4", "due", now),
    db.prepare(`INSERT OR IGNORE INTO appointments (id,owner_email,pet_id,partner_id,scheduled_at,reason,note,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind("appt-miso-001", "demo@petcare.local", "pet-miso", "vet-happy-paws", "2026-07-17T09:30:00+07:00", "Khám da liễu", "Miso gãi tai 3 ngày", "confirmed", now, now),
    db.prepare(`INSERT OR IGNORE INTO appointments (id,owner_email,pet_id,partner_id,scheduled_at,reason,note,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind("appt-miso-002", "demo@petcare.local", "pet-miso", "vet-happy-paws", "2026-07-18T15:00:00+07:00", "Tiêm phòng", "Nhắc mũi 7 bệnh", "pending", now, now),
    db.prepare(`INSERT OR IGNORE INTO medical_records (id,pet_id,partner_id,appointment_id,diagnosis,treatment,prescription,clinician,visited_at,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind("med-miso-001", "pet-miso", "vet-happy-paws", null, "Viêm tai ngoài mức độ nhẹ", "Vệ sinh tai và nhỏ thuốc 7 ngày", "Oticlear: 2 giọt/tai, ngày 2 lần", "BS. Nguyễn Gia Hân", "2026-04-11", "Tái khám nếu còn ngứa sau 7 ngày", now),
    db.prepare(`INSERT OR IGNORE INTO products (id,partner_id,name,category,price,original_price,visual,visual_tone,rating,sold,stock,badge,description,active,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind("prod-royal-canin", "shop-paw-mart", "Royal Canin Mini Adult 2kg", "Thức ăn", 398000, 459000, "🥣", "peach", 4.9, 1240, 48, "-13%", "Dinh dưỡng cân bằng cho chó trưởng thành giống nhỏ", 1, now),
    db.prepare(`INSERT OR IGNORE INTO products (id,partner_id,name,category,price,original_price,visual,visual_tone,rating,sold,stock,badge,description,active,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind("prod-pate", "shop-paw-mart", "Combo Pate Moochie 12 gói", "Thức ăn", 219000, 268000, "🥫", "mint", 4.8, 875, 82, "Bán chạy", "Pate mềm thơm ngon, bổ sung nước và taurine", 1, now),
    db.prepare(`INSERT OR IGNORE INTO products (id,partner_id,name,category,price,original_price,visual,visual_tone,rating,sold,stock,badge,description,active,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind("prod-harness", "shop-paw-mart", "Đai yếm AirMesh siêu nhẹ", "Phụ kiện", 189000, null, "🦮", "lilac", 4.9, 634, 26, "Freeship", "Thoáng khí, phản quang và ôm vừa thân bé", 1, now),
    db.prepare(`INSERT OR IGNORE INTO products (id,partner_id,name,category,price,original_price,visual,visual_tone,rating,sold,stock,badge,description,active,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind("prod-toy", "shop-paw-mart", "Đồ chơi ngửi tìm hạt Snuffle", "Đồ chơi", 145000, 175000, "🧸", "sky", 4.7, 512, 19, "Mới", "Kích thích khứu giác, giảm căng thẳng khi ở nhà", 1, now),
  ]);
}

export async function ensureUser(db: D1Database, actor: Actor) {
  await db.prepare(`INSERT OR IGNORE INTO users (email, full_name, created_at) VALUES (?,?,?)`).bind(actor.email, actor.fullName, new Date().toISOString()).run();
}

export async function getPartnerRole(db: D1Database, email: string, partnerId: string): Promise<PartnerRole | null> {
  const row = await db.prepare(`SELECT role FROM partner_users WHERE email = ? AND partner_id = ? LIMIT 1`).bind(email, partnerId).first<{ role: PartnerRole }>();
  return row?.role ?? null;
}

export async function hasPartnerRole(db: D1Database, email: string, partnerId: string, allowed: PartnerRole[]) {
  const role = await getPartnerRole(db, email, partnerId);
  return Boolean(role && allowed.includes(role));
}

export async function audit(db: D1Database, actorEmail: string, action: string, entityType: string, entityId: string) {
  await db.prepare(`INSERT INTO audit_logs (id,actor_email,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(), actorEmail, action, entityType, entityId, new Date().toISOString()).run();
}

export async function enforceMutationRateLimit(db: D1Database, actorEmail: string, action: string) {
  const rule = MUTATION_LIMITS[action];
  if (!rule) return { supported: false, allowed: false, retryAfterSeconds: 0 };

  const now = Date.now();
  const since = new Date(now - rule.windowMs).toISOString();
  const auditAction = `request.${action}`;
  const row = await db.prepare(`SELECT COUNT(*) AS count, MIN(created_at) AS oldest FROM audit_logs WHERE actor_email = ? AND action = ? AND created_at >= ?`).bind(actorEmail, auditAction, since).first<{ count: number; oldest: string | null }>();
  const count = Number(row?.count ?? 0);
  if (count >= rule.limit) {
    const oldestAt = row?.oldest ? Date.parse(row.oldest) : now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestAt + rule.windowMs - now) / 1000));
    return { supported: true, allowed: false, retryAfterSeconds };
  }

  await audit(db, actorEmail, auditAction, "request", crypto.randomUUID());
  return { supported: true, allowed: true, retryAfterSeconds: 0 };
}
