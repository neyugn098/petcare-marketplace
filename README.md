# PetCare — Next.js + PostgreSQL

Hướng dẫn cộng tác GitHub và tự deploy Vercel: [TEAM.md](TEAM.md).

Marketplace chăm sóc thú cưng, portal phòng khám/pet shop và thẻ QR công khai. Runtime chính dùng Next.js 16 trên Node.js và PostgreSQL; không cần Cloudflare, Wrangler, Worker hay D1.

## Chạy local

Yêu cầu: Node.js >=22.13, pnpm 11.19.0, Docker Compose hoặc PostgreSQL sẵn có.

```sh
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
```

Copy `.env.example` thành `.env` (PowerShell: `Copy-Item .env.example .env`). Sau đó:

```sh
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Mở http://localhost:3000, `/partner`, `/pet/[token]`. Dev chỉ bind loopback. Demo local dùng `demo@petcare.local`, có quyền quản lý hai cơ sở mẫu. `db:seed` yêu cầu `PETCARE_SEED_DEMO=true` và từ chối production. Request không tự tạo bảng hoặc seed dữ liệu.

Có PostgreSQL riêng thì bỏ `db:up` và thay `DATABASE_URL`. PostgreSQL 17 là phiên bản trong Compose. `pnpm db:down` dừng DB nhưng giữ volume; không cần xóa dữ liệu để cập nhật code.

## Docker

```sh
docker compose up --build -d
```

Compose chờ PostgreSQL khỏe, chạy service migration một lần, rồi khởi động Next.js production. Mở http://localhost:3000; `/api/health` trả 200 khi DB đã migrate và truy cập được, 503 khi chưa sẵn sàng. App chạy bằng user `node`, output standalone. Volume `postgres_data` giữ dữ liệu.

Compose mặc định là bộ chạy thử trên máy local: credential DB mẫu, port chỉ mở ở loopback, auth production tắt. Muốn thử đầy đủ với dữ liệu demo, dùng quy trình `pnpm dev` ở trên. Không bật demo production.

Đưa lên máy chủ: build target `runner`, chạy migration bằng target `tools` trước khi rollout, cấp `DATABASE_URL`, `APP_URL=https://your-domain`, `AUTH_MODE=proxy` và các biến auth bên dưới qua secret manager. Đổi credential DB, gắn reverse proxy HTTPS và backup volume/DB. Proxy HTTPS cần bật HSTS; không ép HSTS/upgrade HTTPS ở local. Không đặt secret vào Docker build arguments hoặc image.

## Env và đăng nhập

| Biến | Ý nghĩa |
| --- | --- |
| `DATABASE_URL` | Kết nối PostgreSQL ở server; không đưa ra frontend |
| `DATABASE_POOL_MAX` | Số connection tối đa mỗi process, mặc định 10 |
| `APP_URL` | Origin công khai, dùng metadata và kiểm tra Origin của mutation |
| `AUTH_MODE` | `demo` chỉ ngoài production; `supabase`, `proxy` hoặc `disabled` cho production |
| `AUTH_PROXY_SECRET` | Shared secret giữa gateway và backend, nên tạo ngẫu nhiên >=32 byte |
| `AUTH_SIGN_IN_URL`, `AUTH_SIGN_OUT_URL` | URL HTTPS của identity gateway |
| `PETCARE_SEED_DEMO` | Cho phép lệnh seed riêng, không có hiệu lực trong request |

Backend không còn mặc định tin header đăng nhập của hosting cũ. Trong mode `proxy`, gateway phải xác thực người dùng, xóa header do client gửi rồi chèn `x-petcare-auth-secret`, `oai-authenticated-user-email`, tùy chọn `oai-authenticated-user-full-name` (percent-encoded UTF-8) và `oai-authenticated-user-full-name-encoding=percent-encoded-utf-8`. Tên header cũ được giữ để dễ tích hợp gateway hiện có. Chặn truy cập trực tiếp backend, không ghi secret vào log. Với AUTH_MODE=supabase, ứng dụng dùng Google OAuth qua Supabase Auth. AUTH_MODE=disabled chỉ cho đọc catalog công khai.

`/auth/signin` dùng Google OAuth trong mode supabase hoặc gateway trong mode proxy. Đăng xuất Supabase dùng POST có kiểm tra Origin; GET hiển thị xác nhận. Demo là một actor cố định nên thao tác đăng xuất không xóa actor demo.

## Supabase-compatible PostgreSQL

Dùng PostgreSQL connection string của project Supabase làm `DATABASE_URL`; đây là kết nối SQL trực tiếp qua `pg`, không dùng Supabase Data API hay service-role key cho dữ liệu nghiệp vụ. Giữ kiểm tra chứng chỉ TLS theo connection string/CA của nhà cung cấp; code không tắt xác minh TLS. Với pooler, đặt pool mỗi instance nhỏ cho phù hợp giới hạn kết nối; migration nên chạy qua direct/session connection bằng tài khoản sở hữu schema.

Các bảng bật RLS và không tạo policy cho `anon`/`authenticated`, để không vô tình công khai qua Supabase Data API. Server phải dùng table owner hoặc role được cấu hình BYPASSRLS; authorization người dùng nằm ở API. Supabase Auth đã tích hợp cho đăng nhập Google; server xác minh người dùng qua getUser trước khi xử lý dữ liệu.

## Migration và chuyển dữ liệu D1

`db/migrations/*.sql` là lịch sử migration chính, chạy theo tên tăng dần trong transaction với advisory lock. Bảng `petcare_migrations` lưu checksum và từ chối file đã chạy bị sửa. Thêm file mới thay vì sửa migration cũ. Runner hỗ trợ SQL thông thường phân tách bằng dấu `;`; function/procedure có dấu `;` bên trong cần mở rộng parser trước.

`db/schema.ts` là model Drizzle PostgreSQL. `pnpm db:generate` sinh bản nháp ở `db/generated`; **không tự apply**. Vì lịch sử apply dùng SQL thủ công, kiểm tra diff với DB và chuyển thay đổi cần thiết thành migration mới; không apply nguyên baseline được generate lên DB đã có bảng.

Để chuyển dữ liệu đang có:

1. Tạm dừng ghi ở bản D1, export và giữ backup nguyên gốc.
2. Chuẩn bị JSON object gồm mảng các bảng: `users`, `partners`, `partner_users`, `pets`, `vaccinations`, `appointments`, `medical_records`, `products`, `audit_logs`, `orders`, `order_items`. Dùng tên cột snake_case gốc; boolean giữ 0/1, thời gian giữ chuỗi ISO như hệ thống cũ. Không import SQL SQLite trực tiếp vào PostgreSQL.
3. Chạy `pnpm db:migrate` trên DB đích trống, **không seed demo**.
4. Chạy `pnpm db:import-json path/to/export.json`. Import kiểm tra tên bảng/cột, yêu cầu tất cả bảng đích trống và rollback toàn bộ nếu có lỗi. Mảng bảng không cung cấp được hiểu là rỗng.
5. Đối chiếu số bản ghi, kiểm tra QR, quyền, lịch khám và đơn hàng trước khi đổi traffic. Giữ D1 read-only để rollback; không ghi đồng thời hai DB.

Refactor này không tự tải hoặc chuyển dữ liệu D1 production vì chưa có nguồn export/connection.

## Kiểm tra

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
# Hoặc tất cả kiểm tra:
pnpm check
```

Test dùng PGlite (engine PostgreSQL WASM thật, chạy trong process) để thực thi migration, SQL và API, không mock kết quả truy vấn. Bao gồm rollback batch/import, seed lặp lại, pet/QR, lịch khám/hồ sơ bệnh án, tồn kho/thanh toán, auth và quyền sở hữu. Đây không thay thế kiểm tra networking, SSL/pooler hoặc concurrency trên PostgreSQL server thật. Production build không cần DB ở build time; runtime API cần DB đã migrate.

## Cấu trúc và giới hạn

- `app/`: UI React và API giữ các luồng PetCare hiện có.
- `db/client.ts`: pool `pg`, prepared statements dùng `$1..$n`, batch/transaction.
- `db/runtime.ts`: identity, kiểm tra request, role, audit và rate limit có lock theo actor/action.
- `scripts/`: migrate, seed, import JSON.
- `legacy/cloudflare/`: nguồn Worker/Vinext, D1 migrations, cấu hình hosting và tài liệu cũ; không tham gia lint/typecheck/build/Docker. Chỉ để tham khảo, không dùng triển khai bản mới.

Lần refactor phát hiện một số file ở HEAD local và GitHub đã bị hỏng/cắt cụt. UI customer/partner và CSS được khôi phục từ commit `fc5771b6b2e1afa41fdfb464a30d8c582686a455`; phần API mất nội dung cũng được phục hồi từ commit này, sau đó bổ sung lại giới hạn số pet và kiểm soát chuyển trạng thái. Lockfile được tạo lại. Các biện pháp bảo vệ phía server còn nguyên được giữ và kiểm tra lại; không cam kết UI giống từng byte với commit security bị hỏng.

Thanh toán vẫn là luồng chuyển khoản/đối soát thủ công hiện có. Thông tin ngân hàng trong `app/config.ts` là mẫu, cần cấu hình thông tin thật trước vận hành. Refactor không tích hợp cổng thanh toán hoặc xác thực tự động giao dịch.

HTTP smoke test khi server đang chạy: `pnpm test:smoke http://127.0.0.1:3000`. Mặc định kiểm tra health 503 khi chưa có DB; đặt `EXPECT_DATABASE=true` để yêu cầu health 200 trên môi trường đã migrate. `pnpm start` tự copy static assets rồi chạy standalone server.

## Demo Docker có thể thao tác

Sau khi stack chính đã chạy:

```sh
docker compose run --rm -e PETCARE_SEED_DEMO=true migrate pnpm db:seed
docker compose -f compose.yaml -f compose.demo.yaml up --build -d demo
```

Mở http://localhost:3001 và http://localhost:3001/partner. Đây là Next dev trong container, chỉ publish loopback, dùng actor demo và cùng DB local. Bản production vẫn ở http://localhost:3000 và không nhận actor demo. Không deploy service demo public. Dừng demo bằng `docker compose -f compose.yaml -f compose.demo.yaml stop demo`.

Đã xác minh Docker Desktop ngày 30/09/2026: image build thành công, migration PostgreSQL 17 chạy thành công, app/DB healthy, health HTTP 200; các trang và static assets trả 200; HTTP workflow tạo pet, lịch khám, xác nhận lịch, tạo đơn, đối soát demo và trừ kho chạy thành công. Mutation chưa đăng nhập trên bản production trả 401.

## TLS cho PostgreSQL cloud

Nếu Node báo `SELF_SIGNED_CERT_IN_CHAIN`, tải CA từ Database Settings > SSL configuration của nhà cung cấp và đặt nội dung PEM vào `DATABASE_SSL_CA` (Vercel: Config, Production). Hỗ trợ xuống dòng thật hoặc chuỗi `\n`. Khi có CA, client bắt buộc xác minh chứng chỉ và hostname; các tham số SSL trong DATABASE_URL được thay bằng cấu hình CA này. Không dùng `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Nhập cơ sở và bản đồ gần nhất

Vào /partner, đăng nhập Google, điền hồ sơ và chọn ghim trên bản đồ. Có thể tra địa chỉ trên Google Maps để lấy tọa độ hoặc dùng vị trí thiết bị khi đang ở cơ sở. Không tự chuyển chuỗi địa chỉ thành tọa độ; luôn kiểm tra ghim trước khi lưu. Dùng + Thêm cơ sở để nhập tiếp (tối đa 5 cơ sở/tài khoản, 3 đăng ký/ngày). Cài đặt cho phép sửa hồ sơ và ghim.

Cơ sở mới có verified=0, chỉ chủ cơ sở thấy trong portal. Người vận hành cần kiểm tra thông tin rồi cập nhật verified=1 cho đúng id trong Supabase SQL Editor; không cấp quyền tự xác minh cho đối tác. Ví dụ sau khi kiểm tra: UPDATE partners SET verified=1 WHERE id='ID_CƠ_SỞ_ĐÃ_KIỂM_TRA'; SELECT id,name,address,latitude,longitude,verified FROM partners;

Trang Gần bạn chỉ hiển thị cơ sở đã xác minh. Người dùng bấm Dùng vị trí của tôi và cấp quyền trình duyệt hoặc chọn điểm trên bản đồ. Kết quả xếp theo khoảng cách đường chim bay và đánh dấu gần nhất trong danh sách, không phải thời gian đi đường. Không có cơ sở trong DB thì bản đồ không tự lấy các cửa hàng bên ngoài. Không lưu vị trí tìm kiếm của khách vào hồ sơ.

## Google OAuth với Supabase

Production dùng AUTH_MODE=supabase, SUPABASE_URL và SUPABASE_PUBLISHABLE_KEY (server). Google Client Secret chỉ cấu hình trong Supabase Auth/Providers/Google. Google authorized redirect URI là https://PROJECT_REF.supabase.co/auth/v1/callback. Supabase Site URL là APP_URL. Allow-list các callback APP_URL/auth/callback và các biến thể ?return_to=%2F, ?return_to=%2Fpartner. Thay biến môi trường Vercel phải deploy lại. Google consent ở chế độ Testing cần thêm test users; người dùng phải tự hoàn tất đăng nhập/đồng ý. Kiểm tra tài khoản thực trước khi kết luận OAuth hoạt động toàn trình.


## Danh sách địa chỉ Thủ Đức (04/10/2026)

9 địa chỉ do người vận hành cung cấp nằm trong data/thu-duc-locations.json, kèm tọa độ và URL nguồn. Đây là danh bạ tham khảo được đóng gói cùng ứng dụng, chưa ghi vào bảng partners của Supabase và không cấp quyền hay bật đặt lịch. Sửa file và deploy lại để cập nhật danh bạ. Đối tác đăng ký thật vẫn nằm trong Supabase và cần verified=1. UI không hiển thị đánh giá hoặc trạng thái mở cửa chưa biết cho các địa điểm tham khảo. Ba link Google Maps do người dùng cung cấp đã xác nhận ghim Xốp Mèo Xoài, Thế giới của Pet cưng và Dr. Tom. Các cơ sở còn lại được đối chiếu link bản đồ từ website cơ sở hoặc dữ liệu GeoCoordinates công khai của trang danh bạ ghi trong source. Tọa độ là thông tin tra cứu, không phải xác nhận quan hệ đối tác.


## Sản phẩm tham khảo — 04/10/2026

Trang Gợi ý hôm nay kết hợp hàng đang bán của đối tác được duyệt (API/database) và 8 sản phẩm tham khảo trong data/sample-products.json. Sản phẩm thật xếp trước ở chế độ Gợi ý, kèm tên và địa chỉ cơ sở lấy từ bảng partners. Catalog mẫu luôn gắn nhãn Tham khảo, không có tồn kho/đánh giá giả, không thêm giỏ hoặc tạo đơn. Link Xem tại shop mở nguồn giá.

Ảnh thật được lưu trong public/products để không phụ thuộc hotlink khi khách truy cập. File JSON lưu URL ảnh gốc, URL sản phẩm, nguồn địa chỉ cửa hàng và ngày tra giá. Giá là giá niêm yết của đúng sản phẩm/biến thể tại thời điểm tra, có thể bao gồm khuyến mãi online; không phải giá trung bình thị trường hay xác nhận còn hàng ở chi nhánh. Nội dung/ảnh thuộc nguồn tương ứng, không phải bằng chứng hợp tác với PetCare.

scripts/prepare-sample-products.mjs là công cụ nhập thủ công từ nguồn công khai; không chạy tự động khi build hoặc khi có request. Kiểm tra lại dữ liệu và ảnh sau mỗi lần chạy trước khi deploy. Dockerfile đã copy public để ảnh mẫu hoạt động cả local Docker.
