import type { AppData } from "./types";

export const BRAND = {
  name: "PetCare",
  supportPhone: "1900 636 885",
  supportEmail: "hello@petcare.vn",
};

// Điểm nối thanh toán: thay bankCode/accountNumber hoặc thay hàm tạo payload
// bằng API VietQR/cổng thanh toán của bạn. Không đặt khóa bí mật ở file frontend này.
export const PAYMENT_CONFIG = {
  bankCode: "MB",
  accountNumber: "0000 8888 6868",
  accountName: "CONG TY PETCARE VIET NAM",
};

export const FALLBACK_DATA: AppData = {
  actor: null,
  requiresSignIn: true,
  products: [
    { id: "prod-royal-canin", partner_id: "shop-paw-mart", name: "Royal Canin Mini Adult 2kg", category: "Thức ăn", price: 398000, original_price: 459000, visual: "🥣", visual_tone: "peach", rating: 4.9, sold: 1240, stock: 48, badge: "-13%", description: "Dinh dưỡng cân bằng cho chó trưởng thành giống nhỏ", active: 1 },
    { id: "prod-pate", partner_id: "shop-paw-mart", name: "Combo Pate Moochie 12 gói", category: "Thức ăn", price: 219000, original_price: 268000, visual: "🥫", visual_tone: "mint", rating: 4.8, sold: 875, stock: 82, badge: "Bán chạy", description: "Pate mềm thơm ngon, bổ sung nước và taurine", active: 1 },
    { id: "prod-harness", partner_id: "shop-paw-mart", name: "Đai yếm AirMesh siêu nhẹ", category: "Phụ kiện", price: 189000, original_price: null, visual: "🦮", visual_tone: "lilac", rating: 4.9, sold: 634, stock: 26, badge: "Freeship", description: "Thoáng khí, phản quang và ôm vừa thân bé", active: 1 },
    { id: "prod-toy", partner_id: "shop-paw-mart", name: "Đồ chơi ngửi tìm hạt Snuffle", category: "Đồ chơi", price: 145000, original_price: 175000, visual: "🧸", visual_tone: "sky", rating: 4.7, sold: 512, stock: 19, badge: "Mới", description: "Kích thích khứu giác, giảm căng thẳng khi ở nhà", active: 1 },
  ],
  partners: [
    { id: "vet-happy-paws", name: "Thú y Happy Paws", type: "vet", address: "28 Nguyễn Thị Minh Khai, Quận 1, TP.HCM", latitude: 10.7821, longitude: 106.7001, phone: "028 7300 8855", rating: 4.9, review_count: 328, open_now: 1, accepting_appointments: 1, hours: "Mở đến 21:00", services: "Khám tổng quát|Tiêm phòng|Cấp cứu 24/7", distance_km: 0.8, verified: 1 },
    { id: "shop-paw-mart", name: "Paw Mart Nguyễn Huệ", type: "shop", address: "112 Nguyễn Huệ, Quận 1, TP.HCM", latitude: 10.7744, longitude: 106.7037, phone: "028 6688 2200", rating: 4.8, review_count: 204, open_now: 1, accepting_appointments: 0, hours: "Mở đến 22:00", services: "Thức ăn|Phụ kiện|Grooming", distance_km: 1.2, verified: 1 },
    { id: "vet-an-viet", name: "Bệnh viện thú y An Việt", type: "both", address: "65 Trần Hưng Đạo, Quận 5, TP.HCM", latitude: 10.7549, longitude: 106.6674, phone: "028 3923 7711", rating: 4.7, review_count: 189, open_now: 0, accepting_appointments: 0, hours: "Mở lại lúc 07:30", services: "Xét nghiệm|Phẫu thuật|Nhà thuốc", distance_km: 2.6, verified: 1 },
  ],
  pets: [],
  appointments: [],
  vaccinations: [],
  medicalRecords: [],
  partnerRoles: [],
  partnerAppointments: [],
  partnerProducts: [],
  partnerPets: [],
  orders: [],
  partnerOrders: [],
};
