# HƯỚNG DẪN VẬN HÀNH & PHÁT TRIỂN PETCARE

Phiên bản: 1.3 — 17/07/2026

## 1. Tổng quan

PetCare gồm hai giao diện dùng chung một backend và một cơ sở dữ liệu:

- `/` — app khách hàng: mua sắm, tìm thú y/pet shop, định vị, đặt lịch, hồ sơ pet, QR và thanh toán QR sẵn điểm nối.
- `/partner` — portal đối tác: bật/tắt trạng thái mở cửa, nhận lịch, duyệt lịch, cập nhật hồ sơ sau khám/tiêm và đăng sản phẩm.
- `/pet/[qr-token]` — thẻ an toàn công khai của pet khi quét QR. Trang này cố ý che microchip và không lộ email chủ nuôi.
- `/api/app` — API chính cho hai app.

Luồng dữ liệu quan trọng:

1. Khách đặt lịch trong app.
2. Lịch có trạng thái `pending` trong D1.
3. Đối tác duyệt thành `confirmed` trong portal.
4. Sau khám, đối tác ghi chẩn đoán/điều trị/đơn thuốc và có thể ghi mũi tiêm.
5. Backend hoàn tất lịch, ghi audit log và hồ sơ mới xuất hiện ở app khách hàng.

## 2. Deploy

Dự án đã được cấu hình cho OpenAI Sites/Cloudflare Worker:

- D1 binding: `DB` trong `.openai/hosting.json`.
- Migration: `drizzle/0000_perfect_sunspot.sql` và `drizzle/0001_misty_giant_man.sql`.
- Worker entry: `worker/index.ts`.
- Build: `pnpm run build`.

Khi cập nhật code, luôn chạy theo thứ tự:

```text
pnpm install
pnpm run db:generate     (chỉ khi sửa db/schema.ts)
pnpm run build
```

Sau đó tạo phiên bản mới và deploy bằng Sites. Không sửa trực tiếp tài nguyên D1/R2 do Sites quản lý.

### 2.1. Đưa mã nguồn lên GitHub

Nên tạo repository **Private** tên `petcare-marketplace`, không khởi tạo sẵn README/.gitignore/license. Tại thư mục dự án chạy:

```text
git init
git add .
git commit -m "release PetCare 1.2"
git branch -M main
git remote add origin https://github.com/<tai-khoan>/petcare-marketplace.git
git push -u origin main
```

Trước khi push, chạy `git status` và bảo đảm không có `.env`, secret, API key, dữ liệu production, `node_modules`, `dist`, `.vinext`, `.wrangler` hoặc thư mục `work`. `.gitignore` của dự án đã loại các mục build/local này; vẫn phải kiểm tra lại bằng mắt.

Nếu dùng GitHub connector trong Codex, sau khi tạo repo hãy cấp GitHub App quyền truy cập repo đó. Codex chỉ có thể push khi repo xuất hiện trong danh sách repository được connector cho phép.

### 2.2. Deploy production

1. Chạy `pnpm install`, `pnpm run lint`, `pnpm exec tsc --noEmit` và `pnpm test`.
2. Review migration mới và backup D1 trước khi phát hành.
3. Tạo version Sites từ commit đã push; xác nhận binding `DB` trong `.openai/hosting.json`.
4. Deploy version, thử đăng nhập ở cả `/` và `/partner`, rồi chạy checklist mục 11.
5. Chỉ bật public access sau khi đã cấu hình rate limit/WAF, quy trình xác minh đối tác và giám sát log.

Biến `PETCARE_SEED_DEMO=true` chỉ dùng cho bản demo. Production thật phải để `false` hoặc không cấu hình; backend sẽ không tự chèn tài khoản, pet, sản phẩm hay cơ sở mẫu.

## 3. Tài khoản và phân quyền

Production lấy danh tính từ header đăng nhập đáng tin cậy của Sites:

- `oai-authenticated-user-email`
- `oai-authenticated-user-full-name`

App có nút `Đăng nhập`, menu phiên người dùng và `Đăng xuất`. Các nút này chỉ đi tới hai route cố định của nền tảng:

- `/signin-with-chatgpt?return_to=%2F`
- `/signout-with-chatgpt?return_to=%2F`

PetCare không tự nhận, lưu hoặc xử lý mật khẩu; frontend cũng không lưu access token trong `localStorage`. Đăng ký/đăng nhập tài khoản được SIWC của Sites xử lý, sau đó backend tạo bản ghi `users` gồm email, tên hiển thị và ngày tạo. Chỉ backend đọc các header danh tính do Sites chèn sau khi xác thực.

Các màn `Hồ sơ`, `Lịch khám`, đặt lịch và portal đối tác đều yêu cầu phiên hợp lệ. Portal còn kiểm tra role trong `partner_users` ở backend; chỉ đăng nhập thôi chưa đủ quyền quản trị.

Ở local development, hệ thống tự dùng tài khoản demo `demo@petcare.local`. Nhánh demo này không chạy khi `NODE_ENV=production` trừ khi chủ động đặt `PETCARE_SEED_DEMO=true`.

## 3.1. Tìm kiếm sản phẩm

Tìm kiếm chuẩn hóa chữ hoa/thường, dấu tiếng Việt và ký tự `đ`. Khi có từ khóa, bộ lọc danh mục cũ không được phép che kết quả. Ví dụ `đồ chơi`, `do choi` và tên sản phẩm đều tìm thấy `Đồ chơi ngửi tìm hạt Snuffle`.

Danh sách gợi ý lấy từ cùng tập kết quả đang hiển thị, nên không được viết một logic riêng cho gợi ý và một logic khác cho lưới sản phẩm.

Quyền đối tác nằm ở bảng `partner_users`:

```sql
INSERT INTO partner_users (email, partner_id, role)
VALUES ('email-doi-tac@example.com', 'vet-happy-paws', 'manager');
```

Role hợp lệ: `owner`, `manager`, `clinician`, `staff`. Người đã đăng nhập nhưng chưa có role có thể đăng ký cơ sở ngay tại `/partner`; backend tạo cơ sở ở trạng thái chưa xác minh và cấp role `owner`. Cơ sở/sản phẩm chưa xác minh không xuất hiện công khai.

Ma trận quyền:

- `owner`: toàn quyền cơ sở, lịch khám, hồ sơ y tế, sản phẩm và đơn hàng.
- `manager`: vận hành cơ sở, lịch, sản phẩm và đơn hàng; không ghi hồ sơ y tế.
- `clinician`: xem pet đã cấp quyền qua lịch và hoàn tất hồ sơ khám/tiêm.
- `staff`: xem và duyệt/từ chối lịch; không xem dữ liệu pet đầy đủ, sản phẩm hoặc đơn hàng.

Quy tắc bắt buộc:

- Không cấp quyền đối tác chỉ ở frontend.
- Mọi API thay đổi dữ liệu phải gọi `hasPartnerRole(...)` ở backend với đúng danh sách role.
- Không dùng email nhận từ body request để xác định người dùng.
- Khi nhân sự nghỉ, xóa quyền trong `partner_users` và kiểm tra `audit_logs`.

## 4. Cập nhật thông tin cơ sở và trạng thái mở cửa

Đối tác vào `/partner` → `Cài đặt`:

- `Mở cửa trên bản đồ`: đồng bộ cột `partners.open_now`.
- `Nhận lịch khám mới`: đồng bộ `partners.accepting_appointments`.
- `Hồ sơ cơ sở`: sửa tên, địa chỉ, số điện thoại, giờ, dịch vụ và tọa độ.

App khách hàng đọc hai trạng thái này trực tiếp từ backend. Không suy đoán “đang mở” từ giờ tĩnh. Đây là đúng flow app đối tác kiểm soát mà sản phẩm yêu cầu.

Khi thêm cơ sở mới, cần dữ liệu:

- Tên, loại `vet|shop|both`.
- Địa chỉ, số điện thoại.
- Latitude/longitude chính xác.
- Giờ hiển thị, dịch vụ, trạng thái xác minh.

Map dùng OpenStreetMap. Khi lượng truy cập lớn, nên dùng nhà cung cấp tile có SLA/thương mại và cập nhật URL tile + CSP trong `worker/index.ts`.

## 5. Sản phẩm và cửa hàng

Đối tác vào `/partner` → `Sản phẩm`:

- Đăng sản phẩm mới.
- Chỉnh tồn kho.
- Bật/tắt hiển thị.
- Nhận đơn hàng do app khách tạo, đối soát thanh toán và hoàn tất đơn.

Giá được lưu dạng số nguyên VND để tránh sai số tiền tệ.

Phiên bản này dùng biểu tượng emoji để không phụ thuộc kho ảnh ngoài. Khi thêm ảnh thật:

1. Bật R2 binding trong `.openai/hosting.json`.
2. Upload qua API có kiểm tra MIME, dung lượng, magic bytes và quyền sở hữu.
3. Chỉ lưu metadata/owner/object key trong D1.
4. Không cho client tự quyết định object key hoặc content type.

## 6. Hồ sơ pet và QR

Một user có thể tạo nhiều pet, chỉnh sửa thông tin đầy đủ và thu hồi/cấp lại QR. Mỗi pet có `qr_token` ngẫu nhiên riêng.

QR dẫn đến `/pet/[qr-token]` và chỉ hiển thị dữ liệu an toàn:

- Tên, giống, giới tính, cân nặng.
- Dị ứng; ghi chú riêng tư không được đưa lên QR.
- Microchip đã che, chỉ để lộ 4 số cuối.
- Tình trạng tiêm phòng đã xác minh.

Không đưa email, thông tin đăng nhập, đơn thuốc đầy đủ hoặc lịch sử riêng tư lên trang QR công khai.

Nếu QR bị lộ, bấm `Thu hồi & tạo QR mới`; backend kiểm tra ownership, tạo token ngẫu nhiên mới, vô hiệu token cũ và ghi audit log.

## 7. Thanh toán QR

Checkout đã tạo đơn bền vững trong D1. Backend đọc lại giá/tồn kho, tính tổng tiền và chỉ hỗ trợ một cửa hàng mỗi đơn. Hai bảng mới:

- `orders`: mã đơn, chủ đơn, cửa hàng, tổng tiền và trạng thái.
- `order_items`: snapshot tên, đơn giá, số lượng và thành tiền.

Luồng trạng thái: `pending_payment` → `payment_review` → `paid` → `fulfilled`; đơn có thể chuyển sang `cancelled` ở các bước hợp lệ. File dễ chỉnh:

- `app/config.ts` — cấu hình hiển thị ngân hàng/tài khoản demo.
- `app/customer-app.tsx` — `CheckoutModal`.

Lưu ý: QR hiện tại vẫn chưa tự xác nhận giao dịch ngân hàng. Nút khách bấm chỉ chuyển sang `payment_review`; cửa hàng phải đối soát thủ công. Trước khi nhận tiền thật cần:

1. Tạo thêm `payment_events` với idempotency key.
2. Backend gọi VietQR/PSP bằng secret lưu trong Sites environment, tuyệt đối không để secret trong `app/config.ts`.
3. Webhook kiểm tra chữ ký, timestamp, amount, order ID và idempotency key.
4. Tự chuyển `paid` chỉ sau webhook hợp lệ; hiện tại manager/owner xác nhận thủ công.
5. Ghi audit log và đối soát hằng ngày.

## 8. Bảo mật đã áp dụng

- Mọi câu SQL có dữ liệu người dùng đều dùng prepared statements/bind parameters.
- React render text theo cơ chế escaping mặc định; không dùng `dangerouslySetInnerHTML`, `innerHTML`, `eval` hoặc `document.write` với dữ liệu người dùng.
- Mutations yêu cầu danh tính server-side; production không có fallback demo.
- Kiểm tra ownership của pet và role của đối tác ở backend.
- Áp dụng least privilege cả khi đọc: dữ liệu pet đầy đủ chỉ trả cho `owner/clinician`; sản phẩm và đơn hàng chỉ trả cho `owner/manager`.
- Kiểm tra Content-Type, giới hạn request 32 KB và same-origin cho mutations.
- Quota theo actor/action dùng audit log; các thao tác tạo lịch, pet, đơn hàng, QR và sản phẩm có giới hạn riêng và trả `429 Retry-After` khi vượt ngưỡng.
- Validate độ dài, kiểu dữ liệu, ngày giờ, giá và tồn kho.
- Loại bỏ control/bidi characters trong dữ liệu hiển thị để giảm giả mạo giao diện và log.
- Chuyển trạng thái dùng điều kiện trạng thái cũ; lịch trùng bị chặn bởi unique index và xác nhận thanh toán hoàn tác tồn kho nếu có race condition.
- QR token dùng allowlist ký tự/độ dài trước khi query; route không ghép đường dẫn filesystem nên không tạo bề mặt path traversal.
- Audit log cho đăng ký cơ sở, đặt/duyệt lịch, hồ sơ, QR, sản phẩm, đơn hàng và thanh toán.
- CSP có `object-src 'none'`/`frame-src 'none'`, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, Referrer Policy và Permissions Policy ở Worker.
- API riêng tư đặt `Cache-Control: private, no-store`; trang QR đặt `noindex, nofollow`.
- QR công khai giới hạn dữ liệu và trang được đặt `noindex`.
- Không có secret trong repository.
- D1 giữ dữ liệu có cấu trúc; browser storage không phải nguồn dữ liệu chính.
- Checklist chi tiết, mapping OWASP/CWE và snapshot CVE nằm trong `SECURITY.md`.

Khi thêm chức năng mới, rà lại OWASP Top 10 hiện hành, đặc biệt quyền truy cập theo object, cấu hình sai, injection, xác thực, logging và xử lý lỗi. Không tuyên bố hệ thống “bảo mật tuyệt đối”: trước khi nhận thanh toán hoặc dữ liệu y tế thật vẫn phải scan dependency, bật WAF/rate limit và pentest độc lập.

Việc cần làm trước khi mở public quy mô lớn:

- Chọn hệ thống đăng nhập public chính thức nếu người dùng không đăng nhập qua Sites/ChatGPT.
- Thêm rate limiting/WAF ở edge theo IP + user + route.
- Thêm MFA bắt buộc cho tài khoản `owner`/`manager`.
- Tách quyền chi tiết hơn: bác sĩ ghi hồ sơ, staff duyệt lịch, manager quản lý sản phẩm.
- Mã hóa/giảm thiểu PII, quy định retention và quy trình xóa dữ liệu.
- Backup D1, thử restore định kỳ và theo dõi audit bất thường.
- Pentest trước khi kết nối thanh toán thật.

## 9. Cấu trúc code cần biết

- `app/customer-app.tsx` — app khách hàng và các modal.
- `app/nearby-map.tsx` — bản đồ, marker và vị trí hiện tại.
- `app/partner/partner-app.tsx` — portal đối tác.
- `app/api/app/route.ts` — API đọc/ghi chính.
- `app/api/pet/[token]/route.ts` — API thẻ QR an toàn.
- `db/schema.ts` — schema Drizzle.
- `db/runtime.ts` — khởi tạo D1, dữ liệu mẫu, auth helper, validation và audit.
- `worker/index.ts` — Worker + security headers.
- `app/config.ts` — brand và điểm nối thanh toán.
- `app/globals.css` — toàn bộ design system/responsive.

## 10. Thêm migration an toàn

Migration `drizzle/0001_misty_giant_man.sql` thêm `orders`, `order_items` và unique index ngăn ghi hai hồ sơ y tế cho cùng một lịch. Migration `drizzle/0002_steep_echo.sql` thêm unique index chống lịch đang hoạt động bị tạo trùng và index phục vụ quota/audit. Cả ba migration phải được Sites chạy cùng phiên bản 1.3.

1. Sửa `db/schema.ts`.
2. Chạy `pnpm run db:generate`.
3. Đọc file SQL mới trong `drizzle/`; không deploy khi chưa review.
4. Với thay đổi phá vỡ dữ liệu, dùng migration nhiều bước: thêm cột nullable → backfill → kiểm tra → mới siết constraint.
5. Backup trước migration production.
6. Không sửa migration đã chạy; tạo migration kế tiếp.

## 11. Checklist nghiệm thu nhanh

- Trang `/` hiện sản phẩm ngay trong viewport đầu.
- Thanh thông báo không còn nội dung `Freeship đơn từ 299K`.
- Tìm `đồ chơi` hoặc `do choi` → gợi ý và lưới cùng hiện sản phẩm đồ chơi dù trước đó đã chọn danh mục khác.
- Khi chưa có phiên → hiện `Đăng nhập`; màn hồ sơ/lịch/đặt lịch không tải dữ liệu riêng tư.
- Khi đã có phiên → menu tài khoản hiện tên/email và cho phép đăng xuất.
- Thêm sản phẩm vào giỏ → backend tạo đơn/tính lại tổng → QR → trạng thái `Chờ đối soát`.
- Portal pet shop nhận đúng đơn → xác nhận tiền → hoàn tất → app khách thấy trạng thái mới.
- `Gần bạn` hiển thị map; nút định vị sắp xếp lại khoảng cách.
- Đặt lịch ở cơ sở đang nhận lịch → trạng thái `Chờ duyệt`.
- `/partner` duyệt lịch → app khách hàng thấy `Đã xác nhận`.
- Portal hoàn tất ca khám → hồ sơ và mũi tiêm xuất hiện ở pet profile.
- Tạo pet thứ hai → có QR khác pet thứ nhất.
- Sửa hồ sơ pet; thu hồi QR → token cũ trả 404, QR mới hoạt động.
- Quét QR → microchip bị che và không lộ email.
- Tắt `open_now` ở portal → app khách hàng hiện `Đã đóng`.
- User không có partner role không gọi được API quản trị.
- Tài khoản đối tác mới đăng ký → nhận role `owner`, trạng thái chờ xác minh và chưa xuất hiện công khai.
- `manager/staff/clinician` không đọc hoặc ghi ngoài ma trận quyền.

## 12. Giới hạn có chủ đích của bản 1.2

- Chưa gửi SMS/email/push notification; UI và trạng thái đã sẵn để nối provider.
- QR thanh toán chưa có webhook ngân hàng.
- Chưa upload ảnh lên R2.
- Chưa có backoffice duyệt xác minh và mời nhân sự; đăng ký mới tự cấp `owner`, còn manager/clinician/staff hiện cấp qua D1.
- Tìm gần bạn dùng danh sách cơ sở PetCare trong D1 + OpenStreetMap, không tự quét toàn bộ Google Places. Muốn lấy mọi cơ sở ngoài hệ thống cần API key, billing và điều khoản Google Maps/Places.
- Dữ liệu cơ sở mẫu ở TP.HCM; cần nhập cơ sở thật trước khi công bố.

Khi nhờ Codex nâng cấp, nên nêu rõ module cần sửa, dữ liệu có được migration hay không và môi trường target. Luôn yêu cầu build + typecheck + kiểm tra quyền trước khi deploy.
