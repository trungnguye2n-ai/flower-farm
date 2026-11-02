# Vận hành Vườn hoa

Tài liệu cho người lo máy chủ. Mọi lệnh chạy ở thư mục gốc của dự án.

Viết tắt dùng trong tài liệu:

```sh
# Máy cá nhân (local)
alias dc='docker compose -f compose.yaml -f compose.dev.yaml'
# VPS
alias dcp='docker compose -f compose.yaml -f compose.prod.yaml'
```

## 1. Chạy trên máy cá nhân

Cần: Docker Desktop, Node 24.

```sh
cp .env.example .env          # rồi đổi mọi mật khẩu trong .env
npm ci
dc up -d --build              # db, minio, migrate, app, backup
dc run --rm migrate npm run -s db:seed   # dữ liệu mẫu, chạy lại bao nhiêu lần cũng được
curl http://127.0.0.1:3000/api/health    # {"status":"ok","db":true,"storage":true}
```

Cổng trên máy: app `3000`, Postgres `55432`, MinIO `59100` (giao diện quản trị MinIO `59101`).
Các cổng này chỉ mở cho chính máy của bạn (127.0.0.1).

Chạy test: `npm test` (cần `dc up -d db minio minio-init` trước).

Hai bản code trên cùng một máy dùng chung dữ liệu (cùng tên dự án `vuon-hoa`).
Muốn tách riêng, đặt `COMPOSE_PROJECT_NAME=ten-khac` trước các lệnh `dc`.

## 2. Tạo tài khoản admin

```sh
dc run --rm migrate npm run -s admin -- create --email ban@vuon.vn --name "Tên bạn"
```

Gõ mật khẩu hai lần (ít nhất 10 ký tự, không hiện trên màn hình).
Trên VPS thay `dc` bằng `dcp`. Các lệnh khác:

```sh
... npm run -s admin -- list
... npm run -s admin -- remove --email ban@vuon.vn
```

## 3. Quên mật khẩu admin

Không có chức năng "quên mật khẩu" trên web. Người có quyền vào máy chủ chạy:

```sh
dcp run --rm migrate npm run -s admin -- reset-password --email ban@vuon.vn
```

Gõ mật khẩu mới hai lần. Mọi phiên đăng nhập cũ của tài khoản đó bị đăng xuất.

## 4. Lần đầu đưa lên VPS

Cần: VPS Ubuntu/Debian, **tối thiểu 2 GB RAM**, một tên miền.

1. Cài Docker: `curl -fsSL https://get.docker.com | sh`
2. Lấy code: `git clone <địa chỉ repo> vuon-hoa && cd vuon-hoa`
3. Tạo `.env` từ `.env.example`, đặt mật khẩu dài, ngẫu nhiên cho `POSTGRES_PASSWORD`
   và `S3_SECRET_KEY` (`openssl rand -hex 24`), sửa:
   - `DATABASE_URL`, `DATABASE_URL_TEST`: đổi mật khẩu cho khớp (host không quan trọng, compose tự trỏ vào `db`)
   - `DOMAIN=tenmien.vn`
   - thêm `IMAGE_REPO=ghcr.io/<tài khoản github>/vuon-hoa` và `IMAGE_TAG=latest`
4. Trỏ bản ghi DNS `A` của tên miền về IP của VPS.
5. Nếu repo GitHub để riêng tư: `docker login ghcr.io` bằng một token có quyền `read:packages`.
6. Chạy:
   ```sh
   dcp pull
   dcp up -d
   dcp run --rm migrate npm run -s db:seed
   ```
7. Mở `https://tenmien.vn/api/health`. Caddy tự lấy chứng chỉ HTTPS trong lần truy cập đầu.
8. Tạo tài khoản admin (mục 2).

Chỉ cổng 80 và 443 mở ra ngoài. Database và MinIO không có cổng công khai;
ảnh sản phẩm đi qua Caddy ở đường dẫn `/<bucket>/public/...`.

**VPS 1 GB RAM:** thêm swap trước khi chạy:

```sh
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Image được build sẵn trên GitHub Actions, VPS chỉ tải về, không build.

## 5. Cập nhật phiên bản mới

Mỗi lần đẩy code lên nhánh `main`, GitHub Actions chạy test rồi đăng image mới
(`latest` và mã commit). Trên VPS:

```sh
git pull                 # lấy compose/Caddyfile mới nếu có
dcp pull
dcp up -d                # migrate chạy trước, rồi app khởi động lại
```

Muốn giữ đúng một phiên bản: đặt `IMAGE_TAG=<mã commit>` trong `.env`.
Quay lại bản cũ: đổi `IMAGE_TAG` về mã commit trước đó rồi `dcp up -d`.

## 6. Sao lưu

Dịch vụ `backup` tự chạy **03:00 mỗi ngày** (giờ Việt Nam):

- database: `/backups/db/vuonhoa-YYYYmmdd-HHMM.dump`, giữ `BACKUP_KEEP_DAYS` ngày (mặc định 14);
- ảnh: chép toàn bộ kho ảnh vào `/backups/images`.

Bản sao lưu nằm trong volume `backups` **trên chính VPS**. Muốn có thêm một bản ở
nơi khác (khuyên dùng), điền trong `.env`:

```
BACKUP_REMOTE_HOST=https://ACCESS_KEY:SECRET@s3.nha-cung-cap.com
BACKUP_REMOTE_PATH=ten-bucket/vuonhoa
```

Sao lưu ngay: `dcp run --rm backup backup.sh`
Xem các bản đang có: `dcp run --rm backup ls -lh /backups/db`
Xem lịch và lỗi: `dcp logs backup`

## 7. Khôi phục

**Ghi đè dữ liệu hiện tại.** Nên sao lưu ngay trước khi khôi phục.

```sh
dcp stop app
dcp run --rm backup restore.sh /backups/db/vuonhoa-20261102-0300.dump --images --yes
dcp start app
```

Bỏ `--images` nếu chỉ cần khôi phục database. Thiếu `--yes` thì lệnh từ chối chạy.

Thử khôi phục mà không đụng dữ liệu thật: tạo database phụ rồi khôi phục vào đó.

```sh
dcp exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c 'create database restore_check'
dcp run --rm -e PGDATABASE=restore_check backup restore.sh /backups/db/<file>.dump --yes
dcp exec db psql -U "$POSTGRES_USER" -d restore_check -c 'select count(*) from products'
dcp exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c 'drop database restore_check'
```

## 8. Khi có sự cố

| Thấy gì | Làm gì |
|---|---|
| `/api/health` trả `"db":false` | `dcp ps db`, `dcp logs db` |
| `/api/health` trả `"storage":false` | `dcp ps minio`, `dcp logs minio` |
| App không lên sau cập nhật | `dcp logs migrate`: migration lỗi thì app không khởi động |
| HTTPS lỗi | DNS đã trỏ đúng IP chưa; `dcp logs caddy` |
| Hết dung lượng đĩa | `docker system df` xem chỗ nào chiếm; `docker image prune` xoá image cũ; giảm `BACKUP_KEEP_DAYS` |
