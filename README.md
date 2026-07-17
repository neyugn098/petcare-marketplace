# PetCare

Nền tảng full-stack chăm sóc thú cưng gồm marketplace cho khách hàng và portal vận hành cho thú y/pet shop.

## Các app

- `/` — mua sắm, bản đồ thú y/pet shop, nhiều hồ sơ pet, QR và lịch khám.
- `/partner` — trạng thái mở cửa, duyệt lịch, cập nhật hồ sơ/tiêm phòng và sản phẩm.
- `/pet/[token]` — thẻ QR an toàn của pet.

## Chạy local

```bash
pnpm install
pnpm run dev
```

## Kiểm tra

```bash
pnpm run db:generate
pnpm run build
pnpm exec tsc --noEmit
pnpm run security:check
```

Xem hướng dẫn đầy đủ tại [HUONG-DAN-VAN-HANH-PETCARE.md](./HUONG-DAN-VAN-HANH-PETCARE.md) và checklist bảo mật tại [SECURITY.md](./SECURITY.md).
