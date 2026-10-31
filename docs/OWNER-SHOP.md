# Shop chính chủ và COD

20 sản phẩm của shop `petcare-owner-shop` nằm trong bảng `products`, dùng ảnh minh họa và giá 30.000–70.000đ. Mở bán giới hạn ban đầu 1 chiếc mỗi mã; cập nhật tồn kho tại trang Đối tác sau khi gắn tài khoản quản lý. File `data/owner-drafts.ts` chỉ giữ mẫu nhập ban đầu, không còn hiển thị bản nháp trong catalog.

Khách đăng nhập, thêm sản phẩm vào giỏ, nhập họ tên/số điện thoại/địa chỉ và chọn Đặt hàng COD. Phí vận chuyển chưa bao gồm; shop phải xác nhận với khách trước khi giao.

Đơn COD: `cod_pending` → `cod_shipping` → `fulfilled`. Chỉ chọn hoàn tất sau khi giao và thu đủ tiền. Tồn kho được giữ ngay khi đặt; hủy ở hai bước đầu trả tồn kho đúng một lần. Đã bán chỉ tăng khi hoàn tất. Không tự tích hợp vận chuyển hoặc ngân hàng.

Trang `/partner` yêu cầu quyền owner/manager trong `partner_users`. Không suy đoán chủ tài khoản đăng nhập từ tên người chuyển tiền. Trang `/owner` còn yêu cầu `PETCARE_OWNER_EMAIL`.

Các khoản tiền vào từ ảnh được đánh dấu `owner_confirmed_sale=true` theo xác nhận của chủ shop. Ngày không rõ giữ trống; không tự gán khách, mặt hàng hoặc đơn hàng cho lịch sử cũ. Khoản tiền ra không phải doanh thu bán hàng. Dữ liệu tài chính giữ riêng trong `owner_payment_history` có RLS.

Chuyển khoản vẫn cần PAYMENT_PARTNER_ID, PAYMENT_BANK_NAME, PAYMENT_ACCOUNT_NUMBER, PAYMENT_ACCOUNT_NAME. COD không cần các biến này.

Migrations: chạy `pnpm db:migrate` trước khi triển khai. Dữ liệu mở bán production được nhập riêng; không tự seed hàng hoặc giao dịch thật vào local.
