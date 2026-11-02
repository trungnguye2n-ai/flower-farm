# Vườn hoa: ứng dụng bán hoa có trang admin — thiết kế

Ngày: 2026-11-02 · Trạng thái: chờ chủ vườn duyệt

## 1. Ý định và lý do

Vườn hiện có một trang landing tĩnh (`index.html`) dựng cho lan hồ điệp, giá và
giống ghi cứng trong code. Thực tế vườn **không bán lan hồ điệp**: vườn bán
**bách thủy tiên** (còn gọi lan huệ, amaryllis) và **hoa mười giờ**. Chủ vườn cần:

1. Một trang landing cho khách, làm lại xoay quanh hai loài này, giá và ảnh lấy
   từ dữ liệu thật.
2. Một trang admin riêng (đăng nhập mới vào được) để người của vườn tự **thêm,
   sửa, xoá sản phẩm**, đổi giá, tải ảnh thật, bật/tắt còn hàng, trên cả điện
   thoại lẫn máy tính, không cần nhờ người sửa code.

Thành công nghĩa là: người của vườn đứng ngoài vườn, chụp ảnh bằng điện thoại,
đăng lên admin, đổi giá, bấm lưu, và khách thấy ngay trên trang.

## 2. Mục tiêu, không phải mục tiêu, phản mục tiêu

**Mục tiêu**
- Database Postgres có cấu trúc chuẩn, đổi cấu trúc qua migration có phiên bản.
- Hạ tầng Docker chuẩn production, chạy được ở local trước, sau đó lên VPS với
  cùng cấu hình.
- Admin: CRUD loại hoa và sản phẩm, quản lý ảnh, giá, còn hàng, thứ tự hiển thị.
- Landing lấy dữ liệu từ database.

**Không phải mục tiêu (bản đầu)**
- Không giỏ hàng, không thanh toán online. Mỗi đơn **được ghi lại** trong database
  (mục 4, `orders`).
- **Tích hợp Zalo thật để sau** (chủ vườn quyết). Bản đầu không gọi API Zalo; sau
  khi lưu đơn, trang hiện mã đơn và một liên kết mở Zalo của vườn kèm nội dung đã
  chép sẵn, như cách đang làm. Code tách phần "gửi thông báo đơn" thành một chỗ
  riêng để sau này gắn Zalo OA / ZNS vào mà không sửa luồng đặt hàng.
- Không đa ngôn ngữ; giao diện tiếng Việt.
- Không phân quyền nhiều cấp; mọi tài khoản admin có cùng quyền.
- Không có chức năng lấy lại mật khẩu qua email/OTP: chủ vườn chọn tự nhớ mật
  khẩu. Đặt lại mật khẩu bằng lệnh CLI trên máy chủ (có trong tài liệu vận hành).

**Phản mục tiêu (dù chạy được vẫn là thất bại)**
- Admin trông như bảng quản trị mặc định, lạc phong cách với trang landing.
- Ảnh chụp từ điện thoại (vài MB) đưa nguyên lên trang làm trang chậm.
- Sửa cấu trúc database bằng tay trên server.
- Lộ thông tin bí mật (mật khẩu DB, khoá) trong code hoặc trong image Docker.
- Mất dữ liệu hoặc ảnh khi khởi động lại container.

## 3. Ràng buộc (chủ vườn đã quyết)

- **Next.js** cho cả landing và admin, trong **một ứng dụng**.
- **Postgres** làm database.
- **Docker**: chạy local trước; sau đó đẩy lên git và triển khai lên **VPS**.
  Chưa có VPS hay tên miền cụ thể.
- `/admin` **bắt buộc đăng nhập**. Dùng tốt trên **điện thoại và máy tính**.
- Admin dùng **cùng phong cách** với landing hiện tại (font, bảng màu theo sản
  phẩm, kính mờ), không phải sửa trực tiếp trên trang landing.
- Hai loại hoa hiện có: bách thủy tiên, hoa mười giờ. Phải thêm được loại mới.
- Thứ tự làm: **database và hạ tầng trước**, giao diện sau.
- Giao diện dùng skill **apple-design** (chuyển động lò xo, tấm trượt, phản hồi
  khi chạm) và các quy tắc chuyển động của **stageshow** (nút tự đổi trạng thái
  ngay trên chính nó, lỗi hiện dưới đúng ô gây lỗi, khung chọn trượt). Stageshow
  chỉ dùng cho minh hoạ; kit của nó không dùng làm nút thật.

## 4. Mô hình dữ liệu

Hai tầng: **loại hoa → sản phẩm**, mỗi sản phẩm có nhiều ảnh.

**`categories`** (loại hoa)
- `id`, `slug` (duy nhất, dùng trên URL), `name` (ví dụ "Bách thủy tiên")
- `description`, `care` (nội dung chăm sóc dạng có cấu trúc, xem dưới)
- `sort_order`, `is_visible`
- `created_at`, `updated_at`

**`products`** (sản phẩm)
- `id`, `category_id` (FK), `slug` (duy nhất), `name`
- `short_description`
- Giá không nằm ở sản phẩm mà ở **kiểu bán** (`product_variants`, dưới đây)
- `accent_color` (mã màu hex dùng để "nhuộm" trang khi xem sản phẩm này; admin
  chọn, có gợi ý tự lấy từ ảnh chính)
- `in_stock` (hết hàng: vẫn hiện nhưng không đặt được), `is_visible` (ẩn hẳn)
- `sort_order`
- `created_at`, `updated_at`, `deleted_at` (**xoá mềm**: xoá trong admin chỉ đánh
  dấu, để không mất ảnh và lịch sử khi bấm nhầm)

**`product_variants`** (kiểu bán; mỗi sản phẩm có ít nhất một)
- `id`, `product_id` (FK), `name` ("Củ trần", "Chậu đang nở", "Khay 12 chậu")
- `price` (số nguyên, đơn vị **đồng**; không dùng số thực)
- `in_stock`, `sort_order`, `created_at`, `updated_at`, `deleted_at`
- Sản phẩm chỉ có một kiểu bán thì giao diện ẩn phần chọn kiểu, trông như một giá.
- Sản phẩm "hết hàng" khi mọi kiểu bán đều hết.

**`product_images`**
- `id`, `product_id` (FK), `storage_key` (đường dẫn trong kho ảnh)
- `width`, `height`, `blur_data` (ảnh mờ nhỏ hiện trong lúc tải), `alt`
- `is_primary` (mỗi sản phẩm đúng một ảnh chính; ràng buộc ở database)
- `sort_order`, `created_at`

**`admin_users`**
- `id`, `email` (duy nhất), `password_hash`, `name`, `created_at`, `last_login_at`

**`sessions`**: phiên đăng nhập lưu trong database (có thể thu hồi), hết hạn sau
một khoảng cố định.

**`orders`** (bản ghi đơn, chủ vườn yêu cầu)
- `id`, `code` (mã ngắn dễ đọc qua Zalo, ví dụ `VH-0427`)
- `customer_name`, `customer_phone`
- `recipient_name`, `recipient_phone`, `delivery_address`, `delivery_time` (đều
  không bắt buộc ở bản đầu; khách tặng hoa thì điền)
- `note` (lời nhắn trên thiệp)
- `status`: `new` → `confirmed` → `delivered`, hoặc `cancelled`
- `total` (số nguyên đồng), `created_at`, `updated_at`

**`order_items`**
- `id`, `order_id` (FK), `product_id` (FK, có thể null nếu sản phẩm bị xoá sau)
- `variant_id` (FK, có thể null)
- **Chụp lại** `product_name`, `variant_name`, `unit_price` tại thời điểm đặt,
  `quantity`;
  đổi giá sau này không làm sai đơn cũ.

Luồng: khách bấm gửi đơn → server lưu đơn (kiểm tra giá lại ở server, không tin
giá từ trình duyệt) → trả về mã đơn → nội dung chép sang Zalo có kèm mã đơn → mở
Zalo. Chống spam: giới hạn số đơn theo IP, kiểm tra số điện thoại Việt Nam.
Admin có màn **Đơn hàng**: danh sách mới nhất trước, lọc theo trạng thái, chạm để
đổi trạng thái.

**`site_settings`**: một bản ghi chứa tên vườn, số điện thoại, Zalo, giờ nhận đơn,
khu vực giao, địa chỉ, để admin sửa thay vì ghi cứng (hiện là số tạm trong
`SHOP`).

Ràng buộc chung: khoá ngoại có `ON DELETE` rõ ràng, chỉ mục cho `slug`,
`category_id`, `sort_order`; `updated_at` tự cập nhật.

**Dữ liệu mẫu (seed)**: hai loại hoa với vài sản phẩm mẫu có giá tạm, một tài
khoản admin đầu tiên tạo bằng lệnh CLI (không có mật khẩu mặc định trong code).

## 5. Ảnh

- Ảnh gốc tải lên được **xử lý ở server**: xoay theo EXIF rồi xoá EXIF (bỏ toạ độ
  GPS), thu về tối đa ~2000px, lưu **WebP/AVIF** kèm vài cỡ nhỏ hơn cho điện
  thoại, tạo `blur_data`.
- Giới hạn loại file (JPEG, PNG, HEIC từ iPhone, WebP) và dung lượng mỗi lần tải.
- Lưu trong một **kho tương thích S3**. Ở local và VPS dùng **MinIO** chạy trong
  docker-compose; code chỉ nói chuyện qua giao thức S3, nên sau này chuyển sang
  dịch vụ đám mây chỉ đổi biến môi trường.
- Database chỉ lưu `storage_key` và kích thước, không lưu ảnh.

## 6. Hạ tầng

**Dịch vụ trong docker-compose**
- `app`: Next.js ở chế độ `standalone`, image build nhiều tầng, chạy bằng user
  không phải root, có health check (`/api/health` kiểm tra kết nối DB và kho ảnh).
- `db`: Postgres (bản ổn định mới nhất), dữ liệu trên volume có tên, health check.
- `minio`: kho ảnh, dữ liệu trên volume có tên, bucket tạo tự động khi khởi động.
- `migrate`: chạy migration một lần rồi thoát, trước khi `app` khởi động.
- `backup`: `pg_dump` định kỳ (hằng ngày, giữ có hạn), ghi ra volume riêng. Sao lưu
  cả bucket ảnh.
- Trên VPS thêm **reverse proxy có HTTPS tự động** (Caddy) đứng trước `app` và
  phần đọc ảnh công khai.

**Cấu hình**
- Toàn bộ bí mật qua biến môi trường; có `.env.example`, `.env` không vào git.
- Một file compose gốc, thêm file ghi đè cho local (cổng mở ra máy, code mount
  để phát triển) và cho production (proxy, giới hạn tài nguyên, `restart`).
- Log ra stdout để Docker gom.

**Từ local lên VPS**: cùng image, cùng compose. Có tài liệu ngắn các bước: cài
Docker trên VPS, kéo code từ git, điền `.env`, `docker compose up -d`, trỏ tên
miền về VPS.

## 7. Đăng nhập admin

- Email và mật khẩu; mật khẩu băm bằng **argon2**.
- Phiên lưu trong database, cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- Giới hạn số lần đăng nhập sai theo IP và email.
- Mọi route `/admin` và mọi API ghi dữ liệu đều kiểm tra phiên ở server.
- Bảo vệ CSRF cho các thao tác ghi.
- Tài khoản admin tạo bằng lệnh CLI; nhiều tài khoản được, cùng quyền.

## 8. Trang landing (bước 2)

- Làm lại nội dung xoay quanh bách thủy tiên và hoa mười giờ: tiêu đề, phần chăm
  sóc **theo từng loài** (lấy từ `categories.care`), câu chuyện vườn.
- Phần đầu trang giữ **cảm giác hiện tại**: kéo-lướt qua sản phẩm với vật lý kiểu
  Apple, trang "nhuộm" theo `accent_color` của sản phẩm đang xem. Bông hoa vẽ
  bằng code (chỉ hợp với lan hồ điệp) được thay bằng **ảnh thật** của sản phẩm.
- Sản phẩm hết hàng vẫn hiện, nút đặt bị khoá kèm chữ "Tạm hết".
- Đặt hàng vẫn qua Zalo (chép sẵn nội dung đơn) như hiện tại.
- Ba demo chat stageshow hiện có được giữ, nhưng đổi lời thoại và ảnh minh hoạ
  sang bách thủy tiên và mười giờ (hiện đang nói về Bạch Moth).
- Trang được dựng sẵn (cache) và làm mới ngay khi admin lưu thay đổi, để khách
  thấy giá mới mà trang vẫn nhanh.

## 9. Trang admin (bước 2)

- Cùng font, bảng màu, lớp kính với landing.
- Màn chính: danh sách loại hoa → sản phẩm, mỗi dòng có ảnh chính, tên, giá, công
  tắc còn hàng. Kéo để đổi thứ tự.
- Sửa sản phẩm trong một **tấm trượt** (bottom sheet trên điện thoại, panel bên
  trên máy tính): tên, giá, đơn vị, mô tả, màu, ảnh.
- Ảnh: chụp hoặc chọn từ máy, xem trước ngay, thanh tiến trình, kéo để sắp xếp,
  chạm để đặt làm ảnh chính.
- Nút "Lưu" đổi thành "✓ Đã lưu" ngay trên chính nó; lỗi hiện dưới đúng ô gây lỗi.
- Xoá có bước xác nhận; vì xoá mềm, có thể hoàn tác trong thời gian ngắn.
- Sửa thông tin vườn (`site_settings`).
- Màn **Đơn hàng**: danh sách, lọc trạng thái, đổi trạng thái, gọi hoặc nhắn Zalo
  khách bằng một chạm.

## 10. Phần để người dựng tự quyết

- Thư viện truy cập database và migration (đề xuất Drizzle ORM + drizzle-kit),
  thư viện xử lý ảnh (đề xuất sharp), cách tổ chức thư mục trong Next.js.
- Tên cụ thể của biến môi trường, cổng, tên volume.
- Lịch sao lưu cụ thể và số bản giữ lại.
- Chi tiết kiểm thử; tối thiểu có kiểm thử cho migration, đăng nhập và xử lý ảnh.

## 11. Quyết định của người viết (chủ vườn chưa nói, cần kiểm tra)

- Sao lưu chỉ nằm trên VPS ở bản đầu; có sẵn chỗ cấu hình đẩy bản sao lưu ra
  ngoài (S3 tương thích) qua biến môi trường, mặc định tắt.
- Giá lưu bằng số nguyên đồng.
- **Có `product_variants` ngay từ đầu** (chủ vườn chưa trả lời câu này): thêm sau
  thì phải sửa migration, đơn hàng, admin và landing; có sẵn mà chỉ dùng một kiểu
  thì không tốn gì.
- Xoá sản phẩm là xoá mềm.
- Ảnh lưu ở MinIO (S3) thay vì Vercel Blob, vì triển khai bằng Docker trên VPS.
- Reverse proxy là Caddy, vì tự cấp chứng chỉ HTTPS.
- Nhiều tài khoản admin, cùng quyền, tạo bằng CLI.
- Thông tin liên hệ của vườn chuyển vào `site_settings` để admin sửa được.
- **Một trang landing duy nhất** ở bản đầu, mỗi loại hoa là một phần có neo
  (`/#bach-thuy-tien`). `slug` được giữ để sau này mở trang riêng cho từng loại
  hoặc sản phẩm mà không phải đổi database.
- **Build image trên GitHub Actions**, đẩy lên GitHub Container Registry; VPS chỉ
  kéo image về chạy, không build Next.js trên VPS (dễ hết RAM).
- **Ảnh HEIC từ iPhone được chuyển sang JPEG ngay trên trình duyệt** trước khi
  tải lên, vì bản sharp dựng sẵn không đọc được HEIC.
- Cấu hình nhắm VPS **tối thiểu 2 GB RAM**; compose đặt giới hạn bộ nhớ cho từng
  dịch vụ và có tài liệu cho trường hợp 1 GB (thêm swap).
- Màu "nhuộm" trang là `accent_color` admin chọn, có gợi ý tự lấy từ ảnh.
