# Hàng chính chủ và lịch sử giao dịch

20 SKU nháp (7 kiểu áo minh họa, các size S/M/L) nằm trong `data/owner-drafts.ts`, được hiển thị trước các sản phẩm tham khảo. Giá đề xuất 30.000/50.000/70.000đ, chủ yếu 50.000đ. Đây không phải giá của từng đơn hàng trong chứng từ. Ảnh dùng lại từ danh mục tham khảo Hachiko, không phải ảnh xác nhận hàng tồn của chủ shop. Tất cả có stock=0, active=0 và không được đưa vào thanh toán.

Bản lưu database nằm trong `owner_product_drafts`. Thay đổi ở bảng nháp chưa tự cập nhật bản xem trước trong code. Khi có mẫu thực tế, ảnh, giá và tồn kho được xác nhận, chuyển thành sản phẩm trong bảng `products` thuộc đúng shop đã xác minh; không đổi trực tiếp bản nháp thành hàng đang bán.

`owner_payment_history` lưu các dòng từ ảnh người dùng cung cấp. Ngày chưa biết là NULL; các dòng trùng được loại trước nhập. Không lưu số dư, số tài khoản hoặc ảnh trong Git. Không tạo khách hàng, mã đơn, sản phẩm bán ra hay xác nhận ngân hàng từ những chứng từ này. Đây là sổ ghi chép, không phải lịch sử đơn hàng tự động.

Trang `/owner` chỉ cho phép đúng tài khoản đã được chủ dự án xác nhận và cấu hình bằng `PETCARE_OWNER_EMAIL`. Khi chưa có cấu hình, không ai xem được dữ liệu qua trang này. Có thể xem trực tiếp hai bảng tại Supabase Table Editor bằng tài khoản quản trị dự án. Cả hai bảng bật RLS, không có chính sách truy cập công khai.

## Bật nhận chuyển khoản

Sau khi xác nhận đầy đủ thông tin, đặt biến server trên Vercel: `PAYMENT_PARTNER_ID`, `PAYMENT_BANK_NAME`, `PAYMENT_ACCOUNT_NUMBER`, `PAYMENT_ACCOUNT_NAME`. Cấu hình chỉ áp dụng cho shop tương ứng; không áp dụng chung tài khoản nhận tiền cho các shop khác.

Luồng: giỏ hàng → server tính giá và lưu đơn → hướng dẫn chuyển khoản → khách báo đã chuyển → chủ shop đối soát → đã thanh toán → hoàn tất. Khách có thể mở lại hướng dẫn từ Đơn hàng của tôi. Không có tự đối soát ngân hàng/webhook. QR văn bản và tài khoản mẫu cũ đã được bỏ. Khi chưa đủ cấu hình nhận tiền, không cho báo đã chuyển khoản.

Phí vận chuyển chưa nằm trong tổng hàng hóa; cần xác nhận chính sách giao/nhận trước khi mở bán thật. Chưa xác định tài khoản chủ shop thì không tự cấp quyền cho bất kỳ user nào.
