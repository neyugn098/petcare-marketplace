import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { Database } from "../db/client";
import { migrate } from "../db/migrate";
import { importJson } from "../db/import-json";
import { seedDemo } from "../db/seed";
import { actorFromRequest, validateMutationRequest } from "../db/runtime";
import { GET, POST } from "../app/api/app/route";
import { GET as publicPet } from "../app/api/pet/[token]/route";

test("PostgreSQL migration and application flows", async (t) => {
  const pg = new PGlite();
  const wrap = (client: Pick<PGlite, "query">): Database => {
    const db: Database = new Database(async (sql, values) => {
      const result = await client.query<Record<string, unknown>>(sql, values);
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
    }, async (fn) => fn(db));
    return db;
  };
  const db = new Database(wrap(pg).execute, (fn) => pg.transaction((tx) => fn(wrap(tx))));
  const state = globalThis as typeof globalThis & { petcareDatabase?: Database };
  state.petcareDatabase = db;
  const previousEnv = { ...process.env };
  process.env.AUTH_MODE = "demo";
  process.env = { ...process.env, NODE_ENV: "test" };
  process.env.APP_URL = "http://localhost:3000";
  const request = () => new Request("http://localhost:3000/api/app");
  const post = (payload: unknown) => POST(new Request("http://localhost:3000/api/app", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: JSON.stringify(payload) }));
  try {
    await t.test("migration is repeatable and seed is explicit/idempotent", async () => {
      await migrate(db); await migrate(db);
      assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM partners").first<{ n: number }>())?.n, 0);
      await assert.rejects(importJson(db, { users: [{ email: "import@test.local", full_name: "Imported", created_at: "now" }], pets: [{ id: "invalid" }] }));
      assert.equal(await db.prepare("SELECT email FROM users").first(), null);
      await seedDemo(db); await seedDemo(db);
      await assert.rejects(importJson(db, { users: [] }), /empty destination/);
      assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM partners").first<{ n: number }>())?.n, 3);
    });
    await t.test("batch failures roll back all preceding writes", async () => {
      await assert.rejects(db.batch([
        db.prepare("INSERT INTO users VALUES ($1,$2,$3)").bind("rollback@test.local", "Test", "now"),
        db.prepare("INSERT INTO missing_table VALUES (1)"),
      ]));
      assert.equal(await db.prepare("SELECT email FROM users WHERE email=$1").bind("rollback@test.local").first(), null);
    });
    await t.test("bootstrap and pet create/update/QR privacy", async () => {
      const response = await GET(request()); assert.equal(response.status, 200);
      const data = await response.json(); assert.equal(data.products.length, 4); assert.equal(data.actor.isDemo, true);
      const created = await post({ action: "createPet", petName: "Test pet", species: "Chó", breed: "Mixed", sex: "Đực", dateOfBirth: "2022-01-01", weightKg: 5, microchip: "123456789" });
      assert.equal(created.status, 201); const { id } = await created.json();
      const pet = await db.prepare("SELECT qr_token FROM pets WHERE id=$1").bind(id).first<{ qr_token: string }>();
      const card = await publicPet(request(), { params: Promise.resolve({ token: pet!.qr_token }) });
      const publicData = await card.json(); assert.equal(card.status, 200); assert.equal(publicData.pet.owner_email, undefined); assert.equal(publicData.pet.microchip, "•••• •••• 6789");
      const rotated = await post({ action: "rotatePetQr", petId: id }); assert.equal(rotated.status, 200);
      assert.equal((await publicPet(request(), { params: Promise.resolve({ token: pet!.qr_token }) })).status, 404);
    });
    await t.test("appointment, clinical record and duplicate prevention", async () => {
      const pet = await db.prepare("SELECT id FROM pets WHERE owner_email=$1 LIMIT 1").bind("demo@petcare.local").first<{ id: string }>();
      const payload = { action: "createAppointment", petId: pet!.id, partnerId: "vet-happy-paws", scheduledAt: new Date(Date.now() + 86400000).toISOString(), reason: "Checkup" };
      const created = await post(payload); assert.equal(created.status, 201); const { id } = await created.json();
      assert.equal((await post(payload)).status, 409);
      assert.equal((await post({ action: "updateAppointmentStatus", appointmentId: id, status: "confirmed" })).status, 200);
      assert.equal((await post({ action: "addMedicalRecord", appointmentId: id, diagnosis: "Healthy", treatment: "Rest", clinician: "Test clinician" })).status, 201);
      assert.equal((await post({ action: "addMedicalRecord", appointmentId: id, diagnosis: "Healthy", treatment: "Rest", clinician: "Test clinician" })).status, 409);
    });
    await t.test("payment changes stock once and insufficient inventory rolls back", async () => {
      const order = await post({ action: "createOrder", items: [{ productId: "prod-toy", quantity: 2 }, { productId: "prod-pate", quantity: 1 }] });
      assert.equal(order.status, 201); const { id } = await order.json();
      delete process.env.PAYMENT_PARTNER_ID;
      assert.equal((await post({ action: "markOrderPaymentSent", orderId: id })).status, 409);
      process.env.PAYMENT_PARTNER_ID = "shop-paw-mart";
      process.env.PAYMENT_BANK_NAME = "Test bank";
      process.env.PAYMENT_ACCOUNT_NAME = "TEST ONLY";
      process.env.PAYMENT_ACCOUNT_NUMBER = "123456789";
      assert.equal((await post({ action: "markOrderPaymentSent", orderId: id })).status, 200);
      const before = await db.prepare("SELECT stock FROM products WHERE id='prod-pate'").first<{ stock: number }>();
      await db.prepare("UPDATE products SET stock=0 WHERE id='prod-toy'").run();
      assert.equal((await post({ action: "updateOrderStatus", orderId: id, status: "paid" })).status, 409);
      assert.equal((await db.prepare("SELECT stock FROM products WHERE id='prod-pate'").first<{ stock: number }>())?.stock, before?.stock);
      assert.equal((await db.prepare("SELECT status FROM orders WHERE id=$1").bind(id).first<{ status: string }>())?.status, "payment_review");
      await db.prepare("UPDATE products SET stock=19 WHERE id='prod-toy'").run();
      assert.equal((await post({ action: "updateOrderStatus", orderId: id, status: "paid" })).status, 200);
      assert.equal((await post({ action: "updateOrderStatus", orderId: id, status: "paid" })).status, 409);
      assert.equal((await db.prepare("SELECT stock FROM products WHERE id='prod-toy'").first<{ stock: number }>())?.stock, 17);
    });
    await t.test("partner pins require numeric coordinates and remain private until verified", async () => {
      const payload = { action: "registerPartner", name: "Test shop", partnerType: "shop", address: "Test address", phone: "0901234567", hours: "08:00–17:00", services: "Grooming", latitude: 10.77, longitude: 106.7 };
      assert.equal((await post({ ...payload, latitude: null })).status, 400);
      const created = await post(payload); assert.equal(created.status, 201);
      const { id } = await created.json();
      const row = await db.prepare("SELECT latitude,longitude,verified FROM partners WHERE id=$1").bind(id).first();
      assert.equal(row?.latitude, 10.77); assert.equal(row?.longitude, 106.7); assert.equal(row?.verified, 0);
      const mode = process.env.AUTH_MODE; process.env.AUTH_MODE = "disabled";
      const publicData = await (await GET(request())).json();
      assert.equal(publicData.partners.some((p: {id: string}) => p.id === id), false);
      process.env.AUTH_MODE = mode;
    });
    await t.test("production rejects demo and forged proxy identity", async () => {
      process.env = { ...process.env, NODE_ENV: "production" };
      const forged = new Request("http://localhost:3000/api/app", { headers: { "oai-authenticated-user-email": "demo@petcare.local" } });
      assert.equal(actorFromRequest(forged), null);
      assert.equal((await post({ action: "createPet" })).status, 401);
      process.env.AUTH_MODE = "proxy"; process.env.AUTH_PROXY_SECRET = "test-only-secret";
      assert.equal(actorFromRequest(forged), null);
      const trusted = new Request(forged, { headers: { "oai-authenticated-user-email": "someone@example.com", "x-petcare-auth-secret": "test-only-secret" } });
      assert.equal(actorFromRequest(trusted)?.email, "someone@example.com");
      assert.ok(validateMutationRequest(new Request("http://localhost:3000/api/app", { headers: { "Content-Type": "application/json", Origin: "https://evil.example" } })));
    });
    await t.test("an authenticated outsider cannot mutate another owner's pet", async () => {
      const pet = await db.prepare("SELECT id FROM pets LIMIT 1").first<{ id: string }>();
      const response = await POST(new Request("http://localhost:3000/api/app", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", "oai-authenticated-user-email": "someone@example.com", "x-petcare-auth-secret": "test-only-secret" }, body: JSON.stringify({ action: "rotatePetQr", petId: pet!.id }) }));
      assert.equal(response.status, 403);
    });
  } finally { delete state.petcareDatabase; process.env = previousEnv; await pg.close(); }
});
