import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("build emits a deployable Sites worker", async () => {
  await Promise.all([
    access(new URL("../dist/server/index.js", import.meta.url)),
    access(new URL("../.openai/hosting.json", import.meta.url)),
    access(new URL("../drizzle/0001_misty_giant_man.sql", import.meta.url)),
    access(new URL("../drizzle/0002_steep_echo.sql", import.meta.url)),
    access(new URL("../SECURITY.md", import.meta.url)),
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
    "updatePartnerStatus",
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
  const [api, runtime, worker, qrApi, customer, partner, migration, security, packageJson] = await Promise.all([
    source("app/api/app/route.ts"), source("db/runtime.ts"),
    source("worker/index.ts"), source("app/api/pet/[token]/route.ts"),
    source("app/customer-app.tsx"), source("app/partner/partner-app.tsx"),
    source("drizzle/0002_steep_echo.sql"), source("SECURITY.md"), source("package.json"),
  ]);

  assert.match(runtime, /process\.env\.NODE_ENV !== "production"/);
  assert.match(runtime, /PETCARE_SEED_DEMO === "true"/);
  assert.match(runtime, /sec-fetch-site/);
  assert.match(runtime, /hasPartnerRole/);
  assert.match(runtime, /enforceMutationRateLimit/);
  assert.match(runtime, /contentType !== "application\/json"/);
  assert.match(api, /new TextEncoder\(\)\.encode\(raw\)\.byteLength/);
  assert.match(api, /WHERE id = \? AND owner_email = \?/);
  assert.match(api, /\["owner", "manager"\]/);
  assert.match(api, /Retry-After/);
  assert.match(api, /AND status='pending_payment'/);
  assert.match(api, /AND stock>=\?/);
  assert.match(api, /CASE WHEN access\.role = 'staff'/);
  assert.doesNotMatch(api, /\.prepare\(`[^`]*\$\{/s);
  assert.match(qrApi, /\^petcare-/);
  assert.doesNotMatch(qrApi, /SELECT id,name,species,breed,sex,date_of_birth/);
  assert.doesNotMatch(qrApi, /pet: \{ \.\.\.pet/);
  assert.match(worker, /object-src 'none'/);
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /script-src-attr 'none'/);
  assert.match(worker, /X-Permitted-Cross-Domain-Policies/);
  assert.match(worker, /Strict-Transport-Security/);
  assert.match(migration, /appointment_active_slot_unique/);
  assert.match(migration, /audit_rate_idx/);
  assert.match(security, /OWASP \/ CWE/);
  assert.doesNotMatch(`${api}\n${runtime}\n${customer}\n${partner}`, /demo@pawly\.vn|partner@pawly\.vn/);
  assert.doesNotMatch(`${customer}\n${partner}`, /dangerouslySetInnerHTML|document\.write|\.innerHTML\s*=/);

  const manifest = JSON.parse(packageJson);
  assert.equal(manifest.dependencies.next, "16.2.6");
  assert.equal(manifest.dependencies["react-server-dom-webpack"] ?? manifest.devDependencies["react-server-dom-webpack"], "19.2.6");
  assert.equal(manifest.devDependencies.vite, "8.0.13");
});
