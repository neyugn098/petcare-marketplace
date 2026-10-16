import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:3000";
for (const route of ["/", "/partner", "/pet/petcare-missing123"]) {
  const response = await fetch(new URL(route, base));
  const html = await response.text();
  assert.equal(response.status, 200, route);
  assert.ok(html.includes("PetCare"), route);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const assets = [...new Set([...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map((match) => match[1]))];
  assert.ok(assets.length, "Expected Next.js static assets");
  for (const asset of assets) assert.equal((await fetch(new URL(asset.replaceAll("&amp;", "&"), base))).status, 200, asset);
  console.log(route, "200, security headers and", assets.length, "assets OK");
}
const health = await fetch(new URL("/api/health", base));
assert.equal(health.status, process.env.EXPECT_DATABASE === "true" ? 200 : 503);
console.log("Database health:", health.status, process.env.EXPECT_DATABASE === "true" ? "connected" : "unconfigured (expected)");
