# PetCare — quản lý dự án và chia sẻ chạy local

Cập nhật: 02/10/2026.

## 1. Kiến trúc hiện tại

Trình duyệt → Next.js (React UI + API chạy Node.js) → PostgreSQL.

| Thành phần | Local | Public |
|---|---|---|
| Web/API | Docker, localhost:3000 | Vercel, https://petcare-rho-six.vercel.app |
| Demo có thể thao tác | Docker Next dev, localhost:3001 | Không bật demo actor public |
| Database | PostgreSQL 17 trong Docker | Supabase PostgreSQL |
| Cấu hình | compose.yaml / compose.demo.yaml hoặc .env | Vercel → Petcare → Environment Variables → Production |
| Dữ liệu | Volume Docker trên từng máy | Database Supabase project iotcgtaczugahyaaazay |

Local và public dùng database riêng. Bạn bè không cần tài khoản Vercel/Supabase hay mật khẩu cloud để chạy local. Mỗi máy tự tạo dữ liệu mẫu.

## 2. Cấu trúc source

```text
app/
  page.tsx, customer-app.tsx     Trang khách hàng
  partner/                     Trang đối tác
  pet/[token]/                 Trang hồ sơ thú cưng qua QR
  api/app/route.ts              API nghiệp vụ
  api/pet/[token]/route.ts      API hồ sơ công khai
  api/health/route.ts           Kiểm tra kết nối database
  auth.ts, auth/               Xử lý danh tính / đăng nhập
  config.ts                    Cấu hình nghiệp vụ, thông tin mẫu
  globals.css                  Giao diện
  types.ts, format.ts           Kiểu dữ liệu, định dạng

db/
  client.ts                    Kết nối PostgreSQL, pool, TLS, transaction
  schema.ts                    Schema Drizzle
  runtime.ts                   Quyền truy cập, demo/proxy identity, rate limit
  migrations/                  SQL migration theo thứ tự
  migrate.ts                   Theo dõi migration/checksum
  seed.ts                      Dữ liệu mẫu local
  import-json.ts               Nhập dữ liệu JSON vào database trống

scripts/                       Lệnh migrate, seed, import, start, smoke test
tests/integration.test.ts       Test nghiệp vụ với PGlite
Dockerfile                     Đóng gói Node/Next.js
compose.yaml                   PostgreSQL + migrate + app production local
compose.demo.yaml              Thêm app demo ở cổng 3001
.env.example                   Mẫu biến môi trường, không có secret cloud
README.md                      Hướng dẫn kỹ thuật chi tiết
SECURITY.md                    Mô hình bảo mật và giới hạn
```

Repo gốc còn `legacy/cloudflare/` để tham khảo nguồn Cloudflare cũ; không chạy trong bản mới. ZIP chia sẻ chỉ chứa source hiện hành, không kèm thư mục legacy.

## 3. Bạn bè chạy local bằng Docker (khuyên dùng)

Cần Docker Desktop đang chạy Linux containers, Docker Compose v2, kết nối mạng để tải image/dependencies. Không cần cài Node/pnpm trên máy nếu chỉ chạy Docker. Đảm bảo các cổng 3000, 3001, 5432 chưa bị ứng dụng khác chiếm.

1. Giải nén ZIP vào thư mục riêng.
2. Mở terminal trong thư mục `petcare` có file `compose.yaml`.
3. Chạy lần lượt; chỉ chạy bước sau khi bước trước thành công:

```sh
docker compose up --build -d
docker compose run --rm -e PETCARE_SEED_DEMO=true migrate pnpm db:seed
docker compose -f compose.yaml -f compose.demo.yaml up --build -d demo
```

Mở:
- http://localhost:3001 — demo khách hàng, có dữ liệu mẫu và danh tính demo.
- http://localhost:3001/partner — demo trang đối tác.
- http://localhost:3000 — bản production local; chưa đăng nhập nên thao tác ghi bị chặn.
- http://localhost:3001/api/health — mong đợi `{"status":"ok"}`.

Các lệnh Compose đã chứa cấu hình DB local, không cần tạo `.env` cho cách này. Mật khẩu `petcare_local` chỉ dành cho DB local; các cổng chỉ bind 127.0.0.1.

Mỗi lần mở lại:

```sh
docker compose -f compose.yaml -f compose.demo.yaml up -d
```

Dừng, giữ nguyên dữ liệu:

```sh
docker compose -f compose.yaml -f compose.demo.yaml stop
```

Xem trạng thái / lỗi:

```sh
docker compose -f compose.yaml -f compose.demo.yaml ps
docker compose -f compose.yaml -f compose.demo.yaml logs --tail=100 db migrate app demo
```

Dữ liệu nằm trong volume PostgreSQL, không nằm trong ZIP. Không dùng `down -v` nếu muốn giữ dữ liệu: tùy chọn đó xóa volume database. Không cần seed lại sau mỗi lần mở máy.

## 4. Khi bạn bè muốn sửa code

Docker demo hiện copy source vào image, không mount source để tự đồng bộ. Sau khi sửa code, chạy lại `docker compose -f compose.yaml -f compose.demo.yaml up --build -d demo`.

Để sửa code và tự reload nhanh: cài Node.js 22 LTS và pnpm 11.19.0; chỉ dùng Docker cho DB. Chạy `docker compose up -d db`, copy `.env.example` thành `.env`, rồi:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Cách này dùng http://localhost:3000 với AUTH_MODE=demo theo `.env.example`. Dừng container app trước bằng `docker compose stop app` để giải phóng cổng 3000. `.env.example` trỏ DB localhost:5432; không dùng hostname `db` bên ngoài Docker.

Kiểm tra source:

```sh
pnpm check
```

Nếu chỉ có Docker:

```sh
docker compose run --rm migrate pnpm check
```

## 5. Quản lý bản public

- Web/deployment/logs: https://vercel.com/petcare11/petcare
- Env Production: https://vercel.com/petcare11/petcare/settings/environment-variables
- Database: https://supabase.com/dashboard/project/iotcgtaczugahyaaazay
- Health: https://petcare-rho-six.vercel.app/api/health

| Biến | Mục đích |
|---|---|
| DATABASE_URL | Secret kết nối PostgreSQL; ký tự đặc biệt trong mật khẩu phải URL-encode |
| DATABASE_SSL_CA | PEM CA của Supabase, dùng xác minh TLS |
| DATABASE_POOL_MAX | Số connection tối đa; public đang dùng 2 |
| APP_URL | URL chính của ứng dụng |
| AUTH_MODE | Public hiện disabled; demo chỉ cho local/non-production |
| PETCARE_SEED_DEMO | Public false; không tự seed dữ liệu |

Sửa env trên Vercel xong phải redeploy. Migration không chạy tự động khi có request hay khi build; thay schema thì tạo migration mới, chạy có kiểm soát và backup dữ liệu trước. Không sửa migration đã áp dụng.

Source refactor hiện ở repo local; CHƯA push lên GitHub. Không clone main GitHub cũ để lấy bản này. ZIP đính kèm là bản chia sẻ hiện tại. Vercel đang deploy source upload/CLI, chưa liên kết Git để tự deploy mỗi lần push.

Khi muốn deploy từ một bản source mới bằng CLI: đăng nhập tài khoản có quyền, link đúng project, rồi deploy. Không chạy các lệnh này nếu chỉ muốn local:

```sh
pnpm dlx vercel@61.0.0 login
pnpm dlx vercel@61.0.0 link --project petcare --scope petcare11
pnpm dlx vercel@61.0.0 deploy --prod --scope petcare11
```

## 6. Trạng thái thực tế và việc còn lại

Đã kiểm tra build/lint/typecheck/8 tests, Docker + PostgreSQL local và các luồng demo. Public đã kết nối Supabase: health và API app trả 200, static assets và security headers đạt smoke test. Cloud đã có schema, nhưng chưa có sản phẩm/đối tác mẫu và chưa tích hợp đăng nhập Supabase Auth cho người dùng thật. Không coi bản public hiện tại là bản đầy đủ chức năng đăng nhập/đặt lịch/mua hàng.

Không chia sẻ `.env`, `.env.local`, `.vercel`, token, mật khẩu cloud hay database dump thật cho bạn bè. ZIP đã loại các mục đó. Thông tin thanh toán trong source là mẫu, chưa có cổng thanh toán thật.
