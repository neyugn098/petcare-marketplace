import samples from "../data/sample-products.json";
import type { Product } from "./types";

export const sampleProducts: Product[] = samples.map(p => ({
  ...p, partner_id: "", original_price: null, visual: "📦", visual_tone: "mint",
  rating: 0, sold: 0, stock: 0, badge: "Tham khảo", active: 0, is_sample: true,
  partner_name: p.shop_name, partner_address: p.shop_address,
}));
export function catalogProducts(products: Product[]): Product[] {
  // Real inventory leads; reference items never enter inventory or checkout.
  return [...products.filter(p => p.active === 1 && p.stock > 0 && !p.is_sample && !p.is_owner_draft), ...sampleProducts];
}
