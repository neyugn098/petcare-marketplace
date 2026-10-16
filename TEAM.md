# Làm việc nhóm PetCare

Source chung: https://github.com/neyugn098/petcare-marketplace
Website: https://petcare-rho-six.vercel.app/

## Thiết lập lần đầu

Chủ repo mời tài khoản GitHub của từng thành viên tại Settings > Collaborators.
Thành viên nhận lời mời, clone repo và làm theo phần Chạy local trong README.md.
Local sử dụng PostgreSQL riêng trong Docker; không cần mật khẩu Supabase production.

## Sửa và xuất bản

1. Cập nhật nhánh main trước khi bắt đầu, tạo nhánh riêng cho thay đổi.
2. Sửa code, chạy `pnpm check`, commit và push nhánh lên GitHub.
3. Tạo Pull Request vào main để nhóm xem thay đổi. Thành viên có quyền phù hợp có thể merge, không bắt buộc chủ repo thao tác.
4. Khi Vercel đã kết nối repo và chọn main làm Production Branch, mỗi cập nhật main tự tạo một production deployment. Không cần chạy lệnh deploy trên máy chủ repo.
5. Vercel chạy `pnpm check` theo vercel.json. Nếu kiểm tra/build thất bại, bản production trước đó vẫn phục vụ khách.

Đẩy trực tiếp main cũng kích hoạt deploy nếu repo cho phép, nhưng Pull Request giúp tránh ghi đè công việc của nhau.
Chỉ xem là đã cập nhật khi deployment READY và production alias trỏ sang bản mới.

## Kết nối Vercel lần đầu

Tài khoản Vercel chủ project cần kết nối GitHub tại Account Settings > Authentication.
Trong project petcare, Settings > Git, kết nối neyugn098/petcare-marketplace; Production Branch là main.
Nếu Vercel yêu cầu quyền GitHub App, cấp quyền cho đúng repo này.
Ngày 17/10/2026: code đã đồng bộ lên GitHub và Login Connection đã kết nối. Còn cần cài GitHub App Vercel cho repo petcare-marketplace, sau đó kết nối project và xác nhận một lần tự deploy thành công.

## Database và cấu hình

Không commit .env, .env.local, thư mục .vercel, token hay bản xuất dữ liệu khách hàng.
Biến production được giữ trong project Vercel. Không cần chia sẻ tài khoản cá nhân để sửa code.
Deploy code không tự chạy migration. Thay đổi cấu trúc DB phải được người có quyền database chạy migration và phối hợp với lần deploy.
Các ZIP và sổ tay trước ngày 16/10/2026 là tài liệu lịch sử; README.md và TEAM.md là hướng dẫn cho repo chung.
