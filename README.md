# PetCare

Ná»n táº£ng full-stack chÄƒm sÃ³c thÃº cÆ°ng gá»“m marketplace cho khÃ¡ch hÃ ng vÃ  portal váº­n hÃ nh cho thÃº y/pet shop.

## CÃ¡c app

- `/` â€” mua sáº¯m, báº£n Ä‘á»“ thÃº y/pet shop, nhiá»u há»“ sÆ¡ pet, QR vÃ  lá»‹ch khÃ¡m.
- `/partner` â€” tráº¡ng thÃ¡i má»Ÿ cá»­a, duyá»‡t lá»‹ch, cáº­p nháº­t há»“ sÆ¡/tiÃªm phÃ²ng vÃ  sáº£n pháº©m.
- `/pet/[token]` â€” tháº» QR an toÃ n cá»§a pet.

## Cháº¡y local

```bash
pnpm install
pnpm run dev
```

## Kiá»ƒm tra

```bash
pnpm run db:generate
pnpm run build
pnpm exec tsc --noEmit
```

Xem hÆ°á»›ng dáº«n Ä‘áº§y Ä‘á»§ táº¡i [HUONG-DAN-VAN-HANH-PETCARE.md](./HUONG-DAN-VAN-HANH-PETCARE.md).
