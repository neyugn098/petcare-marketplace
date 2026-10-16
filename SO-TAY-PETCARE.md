# Sổ tay sử dụng và quản lý PetCare
Cập nhật 03/10/2026.

## 1. Các địa chỉ cần lưu

| Thành phần | Địa chỉ / nơi quản lý |
|---|---|
| Website cho khách | https://petcare-rho-six.vercel.app/ |
| Trang Đối tác | https://petcare-rho-six.vercel.app/partner |
| Vercel — hosting website | https://vercel.com/petcare11/petcare |
| Supabase — database và đăng nhập | https://supabase.com/dashboard/project/iotcgtaczugahyaaazay |
| Google OAuth | https://console.cloud.google.com/auth/clients?project=petcare-510509 |
| GitHub remote | https://github.com/neyugn098/petcare-marketplace |

GitHub chưa được cập nhật đầy đủ theo bản local đã sửa. Không lấy main trên GitHub để deploy đè bản hiện tại. Các ZIP ngày 02/10 cũng chưa chứa thay đổi Google OAuth và bản đồ mới nhất.

## 2. Source code nằm ở đâu?

Bản nguồn chính đang chỉnh sửa:
C:\Users\nguye\Documents\Codex\2026-09-26\referenced-chatgpt-conversation-this-is-an\work\petcare-marketplace

Bản sao dùng đưa lên Vercel:
C:\Users\nguye\Documents\Codex\2026-09-30\refactor-to-n-b-d-n\work\vercel-petcare

Sửa ở bản nguồn chính trước. Bản staging không tự đồng bộ. Thư mục .vercel trong staging ghi liên kết tới project Vercel hiện tại. Không sao chép .env hoặc thông tin đăng nhập cho người khác.

| File/thư mục | Vai trò |
|---|---|
| app/customer-app.tsx | Giao diện khách hàng |
| app/partner/partner-app.tsx | Quản lý cơ sở |
| app/partner/business-location.tsx | Nhập/chọn ghim địa chỉ cơ sở |
| app/nearby-view.tsx, app/nearby-map.tsx, app/location.ts | Tìm gần bạn, bản đồ và khoảng cách |
| app/api/app/route.ts | Xử lý nghiệp vụ, lưu/đọc dữ liệu và kiểm tra quyền |
| app/auth/, lib/supabase.ts, proxy.ts | Google login qua Supabase, phiên đăng nhập |
| db/migrations/ | Các bước tạo/nâng cấp cấu trúc database |
| db/schema.ts | Mô hình bảng dữ liệu |
| scripts/ | Lệnh migration, seed dữ liệu mẫu, import và kiểm tra |
| .env.example | Mẫu cấu hình, không phải cấu hình cloud thực |
| Dockerfile, compose.yaml, compose.demo.yaml | Đóng gói và chạy local bằng Docker |
| legacy/cloudflare/ | Tài liệu/code cũ, không dùng chạy bản hiện tại |

## 3. Docker là gì, có cần khi dùng website không?

Docker đóng gói môi trường chạy thành container. Máy bạn hiện dùng Docker để chạy PostgreSQL và có thể chạy cả website local, giúp máy bạn bè có cùng môi trường.

- Người dùng website public không cần cài Docker.
- Vercel chạy ứng dụng Node/Next.js; Supabase chạy PostgreSQL cloud. Bản public không cần máy bạn bật Docker.
- Image là gói môi trường; container là tiến trình đang chạy từ image; volume giữ dữ liệu database qua các lần dừng/khởi động.
- Docker Desktop là phần mềm cài riêng trên từng máy, không phải một thư mục source có thể copy nguyên sang máy khác.

## 4. Chạy local bằng Docker — dễ nhất để xem thử

Mở Docker Desktop, chờ chạy xong. Mở PowerShell trong thư mục source chính (máy bạn bè thì vào thư mục source đã giải nén).

```powershell
docker compose up --build -d
docker compose run --rm -e PETCARE_SEED_DEMO=true migrate pnpm db:seed
docker compose -f compose.yaml -f compose.demo.yaml up --build -d demo
```

- http://localhost:3001 — demo có thể thao tác với tài khoản mẫu.
- http://localhost:3001/partner — quản lý các cơ sở mẫu.
- http://localhost:3000 — bản production local; mặc định AUTH_MODE=disabled nên không đăng nhập/thao tác được. Muốn thử nghiệp vụ dùng cổng 3001.
- Lần đầu build cần Internet và có thể mất vài phút. Không cần cài Node/pnpm riêng nếu chỉ chạy bằng Docker.
- Cổng 5432, 3000, 3001 cần còn trống. Nếu đang chạy pnpm dev ở 3000 thì dừng bằng Ctrl+C trước khi khởi động app Docker cùng cổng.

Kiểm tra/dừng/khởi động:
```powershell
docker compose -f compose.yaml -f compose.demo.yaml ps
docker compose -f compose.yaml -f compose.demo.yaml logs --tail 80 demo
docker compose -f compose.yaml -f compose.demo.yaml stop
docker compose -f compose.yaml -f compose.demo.yaml start
```

Dừng container không xóa dữ liệu. Không dùng `docker compose down -v` nếu muốn giữ database, vì -v xóa volume dữ liệu.

## 5. Chạy local để sửa code

Cài Node.js đáp ứng >=22.13 (Dockerfile hiện dùng Node 22), pnpm 11.19.0 và Docker Desktop. Mở terminal tại thư mục source:

```powershell
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Chỉ copy .env.example nếu chưa có .env, tránh ghi đè cấu hình đang dùng. Nếu bản Node không có Corepack, cài Corepack hoặc pnpm trước. Mở http://localhost:3000 và /partner. `.env` mặc định dùng DB Docker local, AUTH_MODE=demo và dữ liệu mẫu. Không cần Google login để thử local demo.

`pnpm check` chạy lint, kiểm tra kiểu, test và build. Ctrl+C dừng dev. `pnpm db:down` dừng DB và giữ dữ liệu.

## 6. Database là gì, nằm ở đâu?

Database lưu cơ sở, địa chỉ/tọa độ, thú cưng, lịch khám, sản phẩm, đơn hàng và quyền tài khoản. Source code quyết định cách xử lý/hiển thị; database giữ nội dung người dùng nhập.

Có hai database độc lập:
- Local: PostgreSQL 17 trong Docker, database tên petcare, volume postgres_data (Docker có thể thêm tên project phía trước).
- Public: PostgreSQL trên Supabase project iotcgtaczugahyaaazay, khu vực Singapore. Dữ liệu nhập ở website public vào đây.

Local và public không tự đồng bộ. Seed chỉ dành cho local. Tắt/xóa container local không ảnh hưởng database public. Deploy code không tự tạo bảng hay chạy migration.

Các bảng thường dùng: partners (cơ sở), partner_users (email và quyền theo cơ sở), users, pets, appointments, medical_records, vaccinations, products, orders, order_items. Supabase Authentication quản lý danh tính Google và phiên đăng nhập; không lưu mật khẩu Google trong bảng PetCare.

Mở Supabase Table Editor để xem dữ liệu; SQL Editor để thực hiện truy vấn có kiểm soát. DATABASE_URL là chuỗi kết nối riêng tư ở Vercel, không đưa vào code frontend hay gửi bạn bè. RLS của bảng được bật; backend kết nối SQL và tự kiểm tra quyền người dùng. Không tùy tiện bật public read/write cho các bảng.

## 7. Thêm pet shop / phòng khám lên map

1. Vào /partner, đăng nhập Google.
2. Nếu chưa có cơ sở, điền form đăng ký; nếu có rồi, bấm + Thêm cơ sở.
3. Chọn loại Thú y, Pet shop hoặc cả hai; điền tên, địa chỉ đầy đủ, điện thoại, giờ mở cửa và dịch vụ.
4. Chọn ghim đúng vị trí trên bản đồ. Có thể dùng vị trí thiết bị nếu đang đứng tại cơ sở. Hoặc Tra địa chỉ trên Google Maps, bấm chuột phải vào vị trí để lấy cặp vĩ độ/kinh độ rồi nhập.
5. Kiểm tra ghim và lưu. Địa chỉ không tự chuyển thành tọa độ trong bản hiện tại.
6. Cơ sở ở trạng thái chờ xác minh. Người vận hành duyệt thì mới hiện công khai.

Giới hạn hiện tại: tối đa 5 cơ sở do một tài khoản sở hữu, tối đa 3 yêu cầu đăng ký/ngày. Cài đặt trong portal cho phép sửa thông tin và vị trí.

Duyệt cơ sở bằng tài khoản quản trị Supabase (hiện chưa có trang admin duyệt riêng):
```sql
SELECT id, name, type, address, latitude, longitude, verified
FROM partners
ORDER BY updated_at DESC;
```
Sau khi kiểm tra đúng cơ sở, thay id bên dưới rồi chạy:
```sql
UPDATE partners SET verified = 1
WHERE id = 'ID_CUA_CO_SO_DA_KIEM_TRA';
```
Giữ điều kiện WHERE để không duyệt nhầm toàn bộ. Muốn ẩn cơ sở khỏi danh sách công khai thì đặt verified=0 cho đúng id. Không gửi quyền Supabase cho chủ pet shop; họ chỉ cần tài khoản /partner.

## 8. Khách tìm cơ sở gần mình như thế nào?

Vào Gần bạn → chọn Thú y/Pet shop → Dùng vị trí của tôi và cho phép định vị, hoặc Chọn điểm trên bản đồ. Các cơ sở đã xác minh được xếp theo khoảng cách đường chim bay; cơ sở đầu tiên được đánh dấu gần nhất trong danh sách. Khoảng cách không phải quãng đường/thời gian đi xe. Chỉ đường mở Google Maps.

Chỉ những cơ sở được nhập và duyệt trên PetCare mới nằm trong danh sách này. Website không tự lấy tất cả pet shop trên Google. Định vị máy tính có thể mất tới khoảng 25 giây hoặc thất bại; Chrome/Edge và Location của Windows cần cho phép. Chọn điểm thủ công vẫn hoạt động khi thiết bị không định vị được.

## 9. Trang quản lý là trang nào?

- /partner: chủ cơ sở/quản lý xem lịch hẹn, cập nhật sản phẩm, đơn hàng, hồ sơ và trạng thái cơ sở theo quyền được cấp. Chủ tài khoản đăng ký được role owner cho cơ sở đó, không trở thành admin toàn website.
- Vercel: quản lý việc chạy website, deploy, domain, cấu hình môi trường và log lỗi.
- Supabase: quản lý database và đăng nhập, duyệt cơ sở hiện tại qua SQL/Table Editor.
- Google Cloud: quản lý Google OAuth Client, không quản lý nội dung pet shop.

Chưa có dashboard quản trị toàn hệ thống riêng trong PetCare. Các nút/luồng nghiệp vụ vẫn chịu kiểm tra quyền ở server. Thanh toán hiện là chuyển khoản/đối soát thủ công; thông tin ngân hàng trong app/config.ts còn là mẫu.

## 10. Quản lý Vercel và cập nhật website

Mở project petcare trong team petcare11. Deployments xem bản deploy và trạng thái build; Logs xem lỗi runtime; Settings → Environment Variables quản lý cấu hình. Thay env cần deploy/redeploy để bản chạy nhận cấu hình mới.

Cấu hình chính: DATABASE_URL, DATABASE_SSL_CA, DATABASE_POOL_MAX=2, APP_URL=https://petcare-rho-six.vercel.app, AUTH_MODE=supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, PETCARE_SEED_DEMO=false. Google Client Secret nằm trong Supabase Google provider, không phải biến frontend.

Bản hiện tại triển khai từ staging bằng CLI, chưa đồng bộ GitHub. Quy trình cập nhật: sửa source chính → pnpm check → đồng bộ các file source đã sửa sang staging → chạy tại staging:
```powershell
pnpm dlx vercel@61.0.0 deploy --prod --yes --scope petcare11
```
Không copy .env, node_modules, .next hay secret vào bản chia sẻ. Vercel rebuild code; dữ liệu DB vẫn giữ. Nếu thay schema, cần migration riêng trước khi bản mới sử dụng schema đó. Chưa nên redeploy từ GitHub main cũ.

## 11. Chia sẻ cho bạn bè

Gửi source hiện tại gồm app, db, lib, scripts, tests, public và các file cấu hình/package/lockfile/Docker/README/.env.example. Không gửi .env, .env.local, .vercel, node_modules, .next, .git hay backup dữ liệu thật. Bạn bè cài Docker Desktop rồi làm mục 4; họ dùng database local riêng, không cần tài khoản Vercel/Supabase của bạn.

Các ZIP ngày 02/10 là bản cũ: có thể tham khảo cách chạy nhưng thiếu OAuth/map mới. Cần đóng gói lại từ source hiện tại trước khi bàn giao phiên bản mới. Bản FULL Docker cũ chứa image/backup local và không tự cập nhật khi bạn sửa code.

## 12. Trạng thái đã kiểm tra và phần cần lưu ý

Build/lint/typecheck đã qua; 13 tests qua; website public và kết nối DB trả HTTP 200 trong lần kiểm tra 03/10. Google OAuth đã tới màn hình chọn tài khoản; lần kiểm tra trước chưa xác nhận callback sau khi người dùng tự hoàn tất. Không cần và không nên cung cấp mật khẩu Google cho người hỗ trợ.

Nếu map chưa có cơ sở: kiểm tra đã lưu đúng database public, verified=1, loại cơ sở khớp tab và tọa độ hợp lệ. Nếu /partner không thấy quyền: dùng đúng email đã tạo cơ sở; xem partner_users khi cần. Nếu lỗi database: xem Vercel Logs, Supabase project và các biến kết nối; không tắt xác minh TLS để chữa lỗi.

## Bổ sung 04/10: 9 địa điểm Thủ Đức

Danh sách Hachiko, Xốp Mèo Xoài, Thế giới của Pet cưng, Vietpet, Pet Health Centre, Mini Pet, BELIV, Dr. Tom và Boss Yêu hiện được quản lý trong `data/thu-duc-locations.json` của source. Mỗi địa điểm có ghim và URL nguồn. Đây là danh bạ tham khảo trên bản đồ, chưa phải các tài khoản đối tác; chưa ghi vào bảng partners và không bật đặt lịch. Chỉnh danh bạ này cần sửa file và deploy lại. Các cơ sở đăng ký ở /partner vẫn lưu trong Supabase như hướng dẫn trên.
