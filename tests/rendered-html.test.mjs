import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("build emits a deployable Sites worker", async () => {
  await Promise.all([
    access(new URL("../dist/server/index.js", import.meta.url)),
    access(new URL("../.openai/hosting.json", import.meta.url)),
    access(new URL("../drizzle/0001_misty_giant_man.sql", import.meta.url)),
  ]);
});

test("customer and partner workflows are backed by D1 actions", async () => {
  const [api, schema, customer, partner] = await Promise.all([
    source("app/api/app/route.ts"),
    source("db/schema.ts"),
    source("app/customer-app.tsx"),
    source("app/partner/partner-app.tsx"),
  ]);

  for (const action of [
    "registerPartner", "createPet", "updatePet", "rotatePetQr",
    "createAppointment", "updateAppointmentStatus", "addMedicalRecord",
    "createProduct", "updateProduct", "createOrder",
    "markOrderPaymentSent", "updateOrderStatus", "updatePartnerProfile",
  ]) assert.match(api, new RegExp(`payload\\.action === \\"${action}\\"`));

  assert.match(schema, /export const orders = sqliteTable/);
  assert.match(schema, /export const orderItems = sqliteTable/);
  assert.match(customer, /function OrdersView/);
  assert.match(customer, /function PetFormModal/);
  assert.match(partner, /function PartnerRegistrationPage/);
  assert.match(partner, /function OrdersPanel/);
  assert.match(partner, /roleLabel/);
});

test("security contracts remain present", async () => {
  const [api, runtime, worker, qrApi, customer, partner, migration] = await Promise.all([
    source("app/api/app/route.ts"), source("db/runtime.ts"),
    source("worker/index.ts"), source("app/api/pet/[token]/route.ts"),
    source("app/customer-app.tsx"), source("app/partner/partner-app.tsx"),
    source("drizzle/0001_misty_giant_man.sql"),
  ]);

  assert.match(runtime, /process\.env\.NODE_ENV !== "production"/);
  assert.match(runtime, /sec-fetch-site/);
  assert.match(runtime, /hasPartnerRole/);
  assert.match(api, /new TextEncoder\(\)\.encode\(raw\)\.byteLength/);
  assert.match(api, /WHERE id = \? AND owner_email = \?/);
  assert.match(api, /\["owner", "manager"\]/);
  assert.doesNotMatch(api, /\.prepare\(`[^`]*\$\{/s);
  assert.match(qrApi, /\^\[a-zA-Z0-9-\]\{10,120\}\$/);
  assert.match(worker, /object-src 'none'/);
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /Strict-Transport-Security/);
  assert.match(migration, /medical_record_appointment_unique/);
  assert.doesNotMatch(`${customer}\n${partner}`, /dangerouslySetInnerHTML|document\.write|\.innerHTML\s*=/);
});
