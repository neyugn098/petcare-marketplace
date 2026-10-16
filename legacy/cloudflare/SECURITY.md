# PetCare Security Guide

Cập nhật: 17/07/2026

Tài liệu này là checklist kỹ thuật, không phải tuyên bố “bảo mật tuyệt đối”. Trước khi xử lý thanh toán hoặc hồ sơ y tế thật, PetCare vẫn cần pentest độc lập, WAF/rate limit tại edge, giám sát và quy trình ứng cứu sự cố.

## Ranh giới tin cậy

- Production chỉ được chạy sau OpenAI Sites/Cloudflare dispatcher. Backend tin cậy các header `oai-authenticated-user-*` do nền tảng chèn; không phơi trực tiếp Worker origin ra Internet.
- SIWC xác thực danh tính nhưng không tự cấp role đối tác. Mọi quyền `owner|manager|clinician|staff` được kiểm tra lại trong D1 ở backend.
- `PETCARE_SEED_DEMO=true` chỉ dành cho demo. Không bật trong production có dữ liệu thật.
- Secret thanh toán, webhook và API key chỉ nằm trong Sites environment; không đặt trong frontend, Git, QR hoặc log.

## Kiểm soát hiện có

- SQL dùng prepared statement và bind parameter; không ghép dữ liệu người dùng vào câu SQL.
- Mutations yêu cầu JSON chính xác, giới hạn 32 KB, cùng origin, phiên hợp lệ và quota theo actor/action.
- Ownership/role được kiểm tra trước mọi thao tác pet, lịch, hồ sơ y tế, sản phẩm và đơn hàng.
- Chuyển trạng thái dùng optimistic concurrency; xác nhận thanh toán trừ tồn kho có điều kiện và hoàn tác nếu có xung đột.
- Dữ liệu nhập được giới hạn kiểu, miền giá trị, độ dài và loại bỏ control/bidi characters có thể dùng để giả mạo giao diện/log.
- QR token có entropy cao, có thể thu hồi; API công khai không trả pet ID, email chủ, ngày sinh chính xác, ghi chú riêng hoặc microchip đầy đủ.
- React escaping mặc định; không dùng `dangerouslySetInnerHTML`, `eval`, `new Function` hoặc SQL động.
- Worker đặt CSP, HSTS, chống clickjacking, MIME sniffing, referrer leakage, browser feature abuse và cache dữ liệu riêng tư.
- Migration `0002_steep_echo.sql` thêm unique index chống đặt trùng lịch đang hoạt động và index cho quota/audit.

CSP hiện vẫn cần `'unsafe-inline'` cho script/style do cơ chế hydration của Vinext/React. `script-src-attr 'none'` chặn inline event handler, nhưng trước khi bỏ hoàn toàn `'unsafe-inline'` cần triển khai nonce/hash tương thích framework và kiểm thử production.

## OWASP / CWE trọng tâm

| Rủi ro | Kiểm soát |
|---|---|
| Broken Access Control / CWE-639 | Ownership + RBAC trong từng API; staff bị che email chủ nuôi |
| Injection / CWE-89 | D1 prepared statements và `.bind(...)` |
| XSS / CWE-79 | React escaping, lọc control characters, CSP `script-src-attr 'none'` |
| CSRF / CWE-352 | Kiểm tra `Origin`, `Sec-Fetch-Site`, JSON-only |
| Resource exhaustion / CWE-400 | Body limit, quota thao tác, giới hạn pet/sản phẩm/giỏ hàng |
| Race condition / CWE-362 | Conditional update, unique index và bù tồn kho khi xung đột |
| Sensitive data exposure / CWE-200 | Least-privilege queries, no-store, QR data minimization |
| Path traversal / CWE-22 | Không có filesystem route; QR token dùng allowlist và SQL bind |

## CVE snapshot

Tại ngày 17/07/2026:

- `next@16.2.6` đã chứa bản vá cho GHSA-c4j6-fc7j-m34r và GHSA-26hh-7cqf-hhc6.
- `react-server-dom-webpack@19.2.6` cao hơn bản vá `19.2.1` của GHSA-fv66-9v8q-g76r.
- `vite@8.0.13` cao hơn bản vá `8.0.5` của GHSA-p9ff-h696-f583.

Luôn bật Dependabot/security alerts cho repository private và chạy audit lại trước mỗi release; snapshot này sẽ lỗi thời theo thời gian.

## Việc bắt buộc trước production thật

1. Không bật `PETCARE_SEED_DEMO`; nhập/xác minh cơ sở thật qua quy trình backoffice.
2. Đặt access policy phù hợp trong Sites; yêu cầu MFA cho owner/manager ở nhà cung cấp danh tính.
3. Bật Cloudflare WAF/rate limit theo IP + account + route ngoài quota trong app.
4. Thêm webhook PSP có chữ ký, timestamp, amount, order ID và idempotency trước khi nhận tiền thật.
5. Thiết lập retention/xóa dữ liệu, backup D1, thử restore và cảnh báo audit bất thường.
6. Chạy SAST, dependency scan, DAST và pentest độc lập sau mỗi thay đổi auth/payment/upload.

## Báo cáo sự cố

Không tạo issue công khai chứa dữ liệu cá nhân, token hoặc chi tiết khai thác. Thu hồi QR/token liên quan, lưu bằng chứng tối thiểu, xoay secret, khóa thao tác nguy hiểm, xác định phạm vi ảnh hưởng và chỉ khôi phục sau khi có bản vá cùng kiểm thử hồi quy.
