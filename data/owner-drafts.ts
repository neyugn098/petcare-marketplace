import type { Product } from "../app/types";

// Owner-approved drafts. Photos illustrate styles, not actual inventory.
const styles = [
  ["Áo ba lỗ họa tiết", "sample-hachiko-qa013.webp"],
  ["Áo ba lỗ vui nhộn", "sample-hachiko-qa014.webp"],
  ["Áo lông thú", "sample-hachiko-qa002.webp"],
  ["Áo len Hipidog", "sample-hachiko-qa004.webp"],
  ["Áo bóng đá", "sample-hachiko-qa021.webp"],
  ["Áo dây gấu", "sample-hachiko-qa019.webp"],
  ["Áo ba lỗ lá bài", "sample-hachiko-qa016.webp"],
];
export const ownerDrafts: Product[] = Array.from({ length: 20 }, (_, i) => {
  const [style, photo] = styles[Math.floor(i / 3)];
  const size = ["S", "M", "L"][i % 3];
  return {
    id: `owner-draft-${String(i + 1).padStart(2, "0")}`, partner_id: "", name: `${style} cho chó mèo — size ${size}`,
    category: "Thời trang", price: i % 5 === 0 ? 30000 : i % 5 === 4 ? 70000 : 50000, original_price: null,
    visual: "👕", visual_tone: "peach", image_url: `/products/${photo}`,
    rating: 0, sold: 0, stock: 0, active: 0, is_owner_draft: true,
    badge: "Chính chủ · Bản nháp", partner_name: "PetCare — Chủ trang web", partner_address: "Địa chỉ nhận hàng sẽ được cập nhật",
    description: "Ảnh minh họa kiểu dáng; chưa xác nhận mẫu thực tế, kích cỡ và tồn kho. Giá đề xuất, chờ chủ shop duyệt.",
  };
});
