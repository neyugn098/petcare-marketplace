# Đăng nhập bằng username

Trang `/login` hỗ trợ tài khoản username/mật khẩu được chủ dự án cấp và đăng nhập Google. Các liên kết `/auth/signin` cũ mở trang này; `provider=google` bắt đầu OAuth.

Username gồm 3–32 ký tự ASCII, bắt đầu bằng chữ, chỉ chứa chữ, số và dấu gạch dưới; không phân biệt hoa/thường. Mật khẩu có phân biệt hoa/thường.

Supabase Auth lưu mật khẩu dưới dạng băm và xác thực phiên. Username ánh xạ sang định danh nội bộ `<username>@users.petcare.invalid`; đây không phải hộp thư nhận email. Không hỗ trợ tự khôi phục mật khẩu qua các địa chỉ nội bộ này. Chủ dự án đặt lại qua API quản lý Supabase khi cần.

Chạy `node scripts/provision-customers.mjs` với `SUPABASE_URL` và `SUPABASE_SECRET_KEY` trong `.env.provision.local` để cấp danh sách 10 khách hàng thử nghiệm. Chỉ chủ dự án chạy script; không chạy khi build/deploy. Script lưu tiến độ và mật khẩu tại `outputs/private/`, được Git bỏ qua. Giữ file này để không tạo lại tài khoản khi chạy tiếp. Script không ghi đè tài khoản đã tồn tại và không cấp quyền đối tác/quản trị.

Không đưa khóa quản lý hoặc danh sách mật khẩu vào Git, biến `NEXT_PUBLIC_*`, tài nguyên public hay log. Ứng dụng chỉ cần khóa publishable đã có; không cần khóa quản lý trên Vercel.

Khi khách hàng đăng nhập và tải dữ liệu ứng dụng, hồ sơ `public.users` được tạo qua cơ chế `ensureUser` hiện có. Google OAuth và phân quyền đối tác giữ nguyên.
