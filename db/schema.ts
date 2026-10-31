import { sql } from "drizzle-orm";
import { index, integer, real, pgTable, text, uniqueIndex, date, timestamp, check } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  email: text("email").primaryKey(),
  fullName: text("full_name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const ownerProductDrafts = pgTable("owner_product_drafts", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  proposedPrice: integer("proposed_price").notNull(), imageUrl: text("image_url").notNull(),
  stock: integer("stock").notNull().default(0), status: text("status").notNull().default("draft"),
  description: text("description").notNull(),
}, table => [check("owner_product_drafts_proposed_price_check",sql`${table.proposedPrice} > 0`),check("owner_product_drafts_stock_check",sql`${table.stock} >= 0`),check("owner_product_drafts_status_check",sql`${table.status} = 'draft'`)]);
export const ownerPaymentHistory = pgTable("owner_payment_history", {
  id: text("id").primaryKey(), amount: integer("amount").notNull(), transactionDate: date("transaction_date"),
  displayedTime: text("displayed_time").notNull(), description: text("description").notNull(),
  classification: text("classification").notNull(), sourceReference: text("source_reference").notNull().unique(),
  verification: text("verification").notNull().default("imported_screenshot"), importedAt: timestamp("imported_at",{withTimezone:true}).notNull().defaultNow(),
}, table => [check("owner_payment_history_amount_check",sql`${table.amount} <> 0`),check("owner_payment_history_classification_check",sql`${table.classification} IN ('petcare_receipt','unclassified_receipt','outgoing')`),check("owner_payment_history_verification_check",sql`${table.verification} = 'imported_screenshot'`)]);

export const partners = pgTable("partners", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["vet", "shop", "both"] }).notNull(),
  address: text("address").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  phone: text("phone").notNull(),
  rating: real("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  openNow: integer("open_now").notNull().default(0),
  acceptingAppointments: integer("accepting_appointments").notNull().default(0),
  hours: text("hours").notNull(),
  services: text("services").notNull(),
  distanceKm: real("distance_km").notNull().default(0),
  verified: integer("verified").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const partnerUsers = pgTable("partner_users", {
  email: text("email").notNull(),
  partnerId: text("partner_id").notNull().references(() => partners.id),
  role: text("role", { enum: ["owner", "manager", "clinician", "staff"] }).notNull(),
}, (table) => [
  uniqueIndex("partner_user_unique").on(table.email, table.partnerId),
  index("partner_user_email_idx").on(table.email),
]);

export const pets = pgTable("pets", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name").notNull(),
  species: text("species").notNull(),
  breed: text("breed").notNull(),
  sex: text("sex").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  weightKg: real("weight_kg").notNull(),
  bloodType: text("blood_type"),
  microchip: text("microchip"),
  allergies: text("allergies").notNull().default(""),
  notes: text("notes").notNull().default(""),
  avatar: text("avatar").notNull().default("🐕"),
  qrToken: text("qr_token").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("pet_owner_idx").on(table.ownerEmail),
  uniqueIndex("pet_qr_token_unique").on(table.qrToken),
]);

export const vaccinations = pgTable("vaccinations", {
  id: text("id").primaryKey(),
  petId: text("pet_id").notNull().references(() => pets.id),
  vaccineName: text("vaccine_name").notNull(),
  dose: text("dose").notNull(),
  administeredAt: text("administered_at").notNull(),
  nextDueAt: text("next_due_at"),
  providerName: text("provider_name").notNull(),
  batchNumber: text("batch_number").notNull(),
  status: text("status", { enum: ["completed", "due", "overdue"] }).notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("vaccination_pet_idx").on(table.petId)]);

export const appointments = pgTable("appointments", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  petId: text("pet_id").notNull().references(() => pets.id),
  partnerId: text("partner_id").notNull().references(() => partners.id),
  scheduledAt: text("scheduled_at").notNull(),
  reason: text("reason").notNull(),
  note: text("note").notNull().default(""),
  status: text("status", { enum: ["pending", "confirmed", "completed", "cancelled"] }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("appointment_owner_idx").on(table.ownerEmail),
  index("appointment_partner_idx").on(table.partnerId, table.scheduledAt),
  uniqueIndex("appointment_active_slot_unique").on(table.ownerEmail, table.petId, table.partnerId, table.scheduledAt).where(sql`${table.status} IN ('pending','confirmed')`),
]);

export const medicalRecords = pgTable("medical_records", {
  id: text("id").primaryKey(),
  petId: text("pet_id").notNull().references(() => pets.id),
  partnerId: text("partner_id").notNull().references(() => partners.id),
  appointmentId: text("appointment_id").references(() => appointments.id),
  diagnosis: text("diagnosis").notNull(),
  treatment: text("treatment").notNull(),
  prescription: text("prescription").notNull().default(""),
  clinician: text("clinician").notNull(),
  visitedAt: text("visited_at").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("medical_record_pet_idx").on(table.petId, table.visitedAt),
  uniqueIndex("medical_record_appointment_unique").on(table.appointmentId),
]);

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  partnerId: text("partner_id").notNull().references(() => partners.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: integer("price").notNull(),
  originalPrice: integer("original_price"),
  visual: text("visual").notNull(),
  visualTone: text("visual_tone").notNull(),
  rating: real("rating").notNull().default(0),
  sold: integer("sold").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  badge: text("badge"),
  description: text("description").notNull(),
  active: integer("active").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("product_partner_idx").on(table.partnerId)]);

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("audit_rate_idx").on(table.actorEmail, table.action, table.createdAt)]);

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  orderCode: text("order_code").notNull(),
  ownerEmail: text("owner_email").notNull(),
  partnerId: text("partner_id").notNull().references(() => partners.id),
  totalAmount: integer("total_amount").notNull(),
  status: text("status", { enum: ["pending_payment", "payment_review", "paid", "cancelled", "fulfilled"] }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("order_code_unique").on(table.orderCode),
  index("order_owner_idx").on(table.ownerEmail, table.createdAt),
  index("order_partner_idx").on(table.partnerId, table.createdAt),
]);

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  productId: text("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull(),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotal: integer("line_total").notNull(),
}, (table) => [index("order_item_order_idx").on(table.orderId)]);
