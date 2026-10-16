# Security vận hành

- Demo identity/seed bị chặn khi NODE_ENV=production. Mặc định không tin identity header.
- Mode proxy cần gateway xác thực, strip header client và shared secret. Chưa tích hợp session/OAuth riêng.
- Kiểm tra role/ownership trên server, Origin, JSON content type, body size và rate limit theo actor/action trong PostgreSQL. Phải cấu hình APP_URL đúng origin public.
- Không cache API riêng tư. QR công khai không trả owner email/notes và che microchip; token có thể thu hồi.
- Prepared SQL dùng tham số PostgreSQL. Batch và thanh toán là transaction; order row được khóa khi xác nhận thanh toán, thiếu tồn kho rollback toàn bộ.
- Bật RLS không có public policies. Không cấp quyền Data API trực tiếp cho client; backend dùng owner/BYPASSRLS với authorization tại API.
- Secret chỉ ở runtime env. Dùng HTTPS, HSTS tại reverse proxy, TLS cho DB từ xa, DB backup và cập nhật dependency định kỳ.
- CSP vẫn cho inline script/style theo runtime Next và UI hiện có; chưa triển khai nonce CSP. Rate limit chưa thay thế WAF/gateway protection cho endpoint công khai.

Tài liệu Cloudflare lịch sử ở legacy/cloudflare/SECURITY.md không phải hướng dẫn triển khai hiện hành.
