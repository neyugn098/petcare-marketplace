import { test } from "node:test";
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { ownerDrafts } from "../data/owner-drafts";
import { paymentDetails } from "../lib/payment";
test("owner drafts have illustrations but no invented sales, stock or checkout rights", async () => {
  assert.equal(ownerDrafts.length,20);
  assert.equal(new Set(ownerDrafts.map(p=>p.id)).size,20);
  for(const p of ownerDrafts) {
    assert.equal(p.active,0);assert.equal(p.stock,0);assert.equal(p.sold,0);assert.equal(p.is_owner_draft,true);
    assert.ok([30000,50000,70000].includes(p.price));
    assert.ok((await stat(new URL('../public'+p.image_url,import.meta.url))).size>1000);
  }
});
test("payment configuration is restricted to the configured seller and fails closed", () => {
  const before={...process.env};
  try {
    delete process.env.PAYMENT_BANK_NAME;assert.equal(paymentDetails('shop'),null);
    Object.assign(process.env,{PAYMENT_BANK_NAME:'Test',PAYMENT_PARTNER_ID:'shop',PAYMENT_ACCOUNT_NAME:'Test',PAYMENT_ACCOUNT_NUMBER:'12345678'});
    assert.ok(paymentDetails('shop'));assert.equal(paymentDetails('other'),null);
    process.env.PAYMENT_ACCOUNT_NUMBER='unknown';assert.equal(paymentDetails('shop'),null);
  }finally{process.env=before;}
});
