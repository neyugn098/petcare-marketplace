import { getDatabase, type Database } from "./client";
import { verifiedAuthActor } from "../lib/supabase";
export { getDatabase };

export type Actor = { email: string; fullName: string; isDemo: boolean };
export type PartnerRole = "owner" | "manager" | "clinician" | "staff";

export async function resolveActor(request: Request): Promise<Actor | null> {
  return process.env.AUTH_MODE === "supabase" ? verifiedAuthActor(request) : actorFromRequest(request);
}

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



export function actorFromRequest(request: Request): Actor | null {
  const trusted = process.env.AUTH_MODE === "proxy" && Boolean(process.env.AUTH_PROXY_SECRET) && request.headers.get("x-petcare-auth-secret") === process.env.AUTH_PROXY_SECRET;
  const rawEmail = trusted ? request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() : undefined;
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

  if (process.env.AUTH_MODE === "demo" && process.env.NODE_ENV !== "production") {
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
  const requestOrigin = new URL(process.env.APP_URL || request.url).origin;
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


export async function ensureUser(db: Database, actor: Actor) {
  await db.prepare(`INSERT INTO users (email, full_name, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`).bind(actor.email, actor.fullName, new Date().toISOString()).run();
}

export async function getPartnerRole(db: Database, email: string, partnerId: string): Promise<PartnerRole | null> {
  const row = await db.prepare(`SELECT role FROM partner_users WHERE email = $1 AND partner_id = $2 LIMIT 1`).bind(email, partnerId).first<{ role: PartnerRole }>();
  return row?.role ?? null;
}

export async function hasPartnerRole(db: Database, email: string, partnerId: string, allowed: PartnerRole[]) {
  const role = await getPartnerRole(db, email, partnerId);
  return Boolean(role && allowed.includes(role));
}

export async function audit(db: Database, actorEmail: string, action: string, entityType: string, entityId: string) {
  await db.prepare(`INSERT INTO audit_logs (id,actor_email,action,entity_type,entity_id,created_at) VALUES ($1,$2,$3,$4,$5,$6)`).bind(crypto.randomUUID(), actorEmail, action, entityType, entityId, new Date().toISOString()).run();
}

export async function enforceMutationRateLimit(db: Database, actorEmail: string, action: string) {
  const rule = MUTATION_LIMITS[action];
  if (!rule) return { supported: false, allowed: false, retryAfterSeconds: 0 };

  return db.transaction(async (tx) => {
  await tx.prepare("SELECT pg_advisory_xact_lock(hashtext($1))").bind(actorEmail + ":" + action).run();
  const now = Date.now();
  const since = new Date(now - rule.windowMs).toISOString();
  const auditAction = `request.${action}`;
  const row = await tx.prepare(`SELECT COUNT(*) AS count, MIN(created_at) AS oldest FROM audit_logs WHERE actor_email = $1 AND action = $2 AND created_at >= $3`).bind(actorEmail, auditAction, since).first<{ count: number; oldest: string | null }>();
  const count = Number(row?.count ?? 0);
  if (count >= rule.limit) {
    const oldestAt = row?.oldest ? Date.parse(row.oldest) : now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestAt + rule.windowMs - now) / 1000));
    return { supported: true, allowed: false, retryAfterSeconds };
  }

  await audit(tx, actorEmail, auditAction, "request", crypto.randomUUID());
  return { supported: true, allowed: true, retryAfterSeconds: 0 };
  });
}
