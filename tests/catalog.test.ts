import { test } from "node:test";
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { sampleProducts, catalogProducts } from "../app/catalog";
test("reference catalog is sourced, has real local photos and cannot enter live inventory", async () => {
  assert.ok(sampleProducts.length >= 20);
  assert.equal(new Set(sampleProducts.map(p=>p.id)).size,sampleProducts.length);
  assert.ok(sampleProducts.filter(p=>p.category === "Thời trang").length >= 6);
  assert.ok(sampleProducts.filter(p=>p.category === "Thức ăn").length >= 6);
  for(const p of sampleProducts){
    assert.equal(p.is_sample,true); assert.equal(p.active,0); assert.equal(p.stock,0);
    assert.ok(p.source_url?.startsWith("https://")); assert.ok(p.partner_name && p.partner_address);
    assert.ok(Number.isInteger(p.price) && p.price>0);
    assert.ok((await stat(new URL("../public"+p.image_url,import.meta.url))).size>1000);
  }
  const real = {...sampleProducts[0],id:"real",is_sample:false,active:1,stock:3};
  assert.equal(catalogProducts([real])[0].id,"real");
  assert.equal(catalogProducts([{...real,active:0}]).some(p=>p.id==="real"),false);
});
