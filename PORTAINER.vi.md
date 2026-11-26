# PerkRadar — Hướng dẫn cài trên Portainer (Git Stack, port 18897:18897)

Repository của bạn: https://github.com/hoangthang0106/PerkRadar

## English mặc định — cập nhật ngày 26/11/2026

**Fork PerkRadar này đã được chỉnh sang giao diện English mặc định**, gồm:
- `<html lang="en">`, tiêu đề/description trang, đăng nhập, đăng xuất, dashboard, tìm kiếm, lọc danh mục, sắp xếp, nhãn nguồn và nút bấm.
- Trạng thái thu thập, cảnh báo, một số lỗi xác thực và API hiển thị bằng tiếng Anh.
- Bộ phân loại lưu SQLite, mã source ID và dữ liệu đã thu thập **không đổi**; nhãn tiếng Anh chỉ là lớp hiển thị. Dữ liệu bài đăng từ các nguồn tiếng Trung **vẫn giữ nguyên ngôn ngữ gốc** (không có tính năng dịch tự động).

**Để thay đổi hiện lên trong ứng dụng đang chạy, bắt buộc build lại image từ fork.** Bấm Restart đơn thuần không thay đổi mã nguồn bên trong image cũ.

**Nếu Stack đang dùng `docker-compose.yml` của fork (có `build:` và `pull_policy: build`):**
1. Portainer → **Stacks → perkradar → Pull and redeploy** để cập nhật commit mới.
2. Compose cần build lại `local/perkradar-itmanager:18897` từ `Dockerfile` trong fork. Chỉ có một container; dữ liệu volume `perkradar_data` giữ nguyên.
3. Nếu Portainer Agent không hỗ trợ build Git Stack, theo phương án dự phòng ở mục 3: build image `local/perkradar-itmanager:18897` từ `https://github.com/hoangthang0106/PerkRadar.git#main`, rồi redeploy stack với `docker-compose-prebuilt.yml`. Không xóa volume.
4. Truy cập `http://LAN_IP:18897` và tải lại trang (Ctrl+Shift+R trên desktop, reload trên điện thoại). Giao diện hiện English.

**Bảo mật:** cần `PERKRADAR_ACCESS_TOKEN` ít nhất **32 ký tự**. Token ngắn sẽ làm trang báo `Access authentication is misconfigured` và healthcheck `unhealthy` — đây là vấn đề cấu hình độc lập với ngôn ngữ. Nhập token trong Environment variables của Portainer, không commit vào GitHub. Không mở HTTP LAN trực tiếp ra Internet.

## 1. Thông số triển khai

- **Host port = container port = 18897**; tiến trình Node thực sự lắng nghe 18897 qua biến `PORT`.
- **Một container duy nhất:** `perkradar`; không Caddy/FlareSolverr/database phụ.
- **Image:** `local/perkradar-itmanager:18897`. Compose chính sẽ build từ `Dockerfile` của fork khi endpoint hỗ trợ; Compose dự phòng dùng image bạn tự build qua Images/CLI.
- **Dữ liệu:** volume tên `perkradar_data` gắn vào `/data`, chứa SQLite.
- **Đăng nhập:** dùng **`PERKRADAR_ACCESS_TOKEN` ít nhất 32 ký tự** (không có tài khoản username/password riêng).
- Chỉ dùng trên LAN đáng tin cậy. HTTP LAN đặt `PERKRADAR_SECURE_COOKIE=0` để login được; **không publish ra Internet**.

## 2. Kiểm tra port 18897 trên máy chạy Docker

```sh
ss -ltnp '( sport = :18897 )'
docker ps -a --format 'table {{.Names}}\t{{.Ports}}'
docker ps -aq | xargs -r docker inspect --format '{{.Name}} {{json .HostConfig.PortBindings}}'
```

Chú ý: PhoneInfoga từng được *dự kiến* cấu hình `18897:18897` trong fork khác. Nếu PhoneInfoga đang chạy port đó, không Deploy PerkRadar đè lên.

## 3. Cách cài nhanh nhất — Git Stack sẽ tự build

**Đã sửa lỗi pull image ngày 26/11/2026:** `docker-compose.yml` dùng `build: context: .` cùng `pull_policy: build` để Docker Compose build image từ Dockerfile **ngay trong fork**, thay vì pull một image `local/perkradar-itmanager` không tồn tại trên Docker Hub.

**Với Stack Git `perkradar` đã tạo và báo lỗi "pull access denied":**
1. Vào **Stacks → perkradar → Pull and redeploy** để lấy bản Compose mới.
2. Kiểm tra các Environment variables `LAN_IP`, `PERKRADAR_ACCESS_TOKEN` vẫn còn.
3. Không xóa stack, không xóa `perkradar_data`. Lần build đầu phải tải Node/npm dependencies nên lâu hơn deploy image có sẵn.
4. Nếu báo lỗi "compose build operation failed / build unsupported", Docker endpoint của bạn đang thuộc nhóm Portainer không build Git Stack được. Làm **phương án dự phòng** dưới đây.

### Dự phòng khi Portainer Agent không build được

Portainer đã ghi nhận một số môi trường Agent từ phiên bản 2.29.2 không hỗ trợ build qua Git Stack; tài liệu: https://docs.portainer.io/faqs/known-issues/docker-compose-files-including-build-steps-fail

Bước A: build image từ fork trong **Images → Build a new image → URL**, cùng đúng Docker endpoint:
- Image name: `local/perkradar-itmanager:18897`.
- URL: `https://github.com/hoangthang0106/PerkRadar.git#main`.
- Dockerfile path: `Dockerfile` (nếu có ô này).

Nếu Portainer Image Builder URL không được, chạy trên Docker host:

```sh
docker build --pull -t local/perkradar-itmanager:18897 'https://github.com/hoangthang0106/PerkRadar.git#main'
```

Bước B: sửa **Compose path** trong **Stacks → perkradar → Edit stack settings** (hoặc tạo lại Git Stack chỉ khi chưa chạy và xác minh volume) từ `docker-compose.yml` sang **`docker-compose-prebuilt.yml`**, rồi redeploy. File dự phòng dùng image local đã build, không có `build:`. Không phải đăng nhập Docker Hub.

## 4. Tạo Portainer Git Stack từ fork

Chọn **Stacks → Add stack → Git repository**:

| Trường | Giá trị |
|---|---|
| Name | `perkradar` |
| Repository URL | `https://github.com/hoangthang0106/PerkRadar.git` |
| Repository reference | `refs/heads/main` |
| Compose path | `docker-compose.yml` |
| Authentication | Off (public repository) |

**Environment variables** — hai giá trị bắt buộc:

| Name | Value |
|---|---|
| `LAN_IP` | IP LAN đúng của máy/VM/LXC đang chạy Docker |
| `PERKRADAR_ACCESS_TOKEN` | Token do bạn tự tạo, ngẫu nhiên và dài ít nhất 32 ký tự |

Chỉ đặt token trong Portainer, **không ghi vào GitHub, không gửi token vào chat**. Nếu Portainer báo compose thiếu biến, kiểm tra tên biến có đúng từng chữ.

Sau khi xác nhận image đã tồn tại trong **Images** và cổng 18897 còn trống, nhấn **Deploy the stack**.

## 5. Truy cập / kiểm tra

- URL: `http://LAN_IP:18897`.
- Mở trang `/login`; nhập **PERKRADAR_ACCESS_TOKEN** để đăng nhập.
- **Containers → perkradar** phải là Running/Healthy; Published Ports `LAN_IP:18897:18897/tcp`.
- **Container Logs** giúp xem lỗi tải nguồn hoặc DB.
- Endpoint `/api/health` cần token khi đã bật xác thực. Có thể dùng CLI:
```sh
curl -fsS -H "Authorization: Bearer $PERKRADAR_ACCESS_TOKEN" http://127.0.0.1:18897/api/health
```
Lưu ý: ví dụ `127.0.0.1` này chỉ chạy khi port được bind loopback; cấu hình hiện tại bind **LAN_IP cụ thể**, nên khi gọi từ Docker host hãy thay `127.0.0.1` bằng `LAN_IP`.

## 6. Dữ liệu / hạn chế

- Ứng dụng lấy dữ liệu ưu đãi từ các nguồn công khai theo lịch hai giờ/lần; kết quả **không bảo đảm khuyến mãi còn hiệu lực**.
- Database SQLite trong volume `perkradar_data`; không xóa volume khi thay Stack. Sao lưu SQLite nhất quán trước khi nâng cấp.
- Dấu yêu thích/đã nhận lưu trong localStorage của **trình duyệt**, không tự đồng bộ giữa điện thoại và máy tính.
- Image build từ commit ở thời điểm bạn build. Khi code fork thay đổi, **cần build lại image rồi redeploy**, không tự cập nhật chỉ bằng Git Stack.
- Nếu file `docker-compose-prebuilt.yml` báo `pull access denied`, nghĩa là image local chưa được build đúng tag trên **đúng endpoint**. Nếu báo `reference not found`, kiểm tra reference đúng **refs/heads/main** (không phải master).
- Mở truy cập công cộng cần HTTPS và cấu hình bảo mật khác, không được dùng trực tiếp cấu hình HTTP LAN này.

**Trạng thái:** GitHub đã có Compose tự build và Compose dự phòng một container; chưa chạy Portainer thực tế, chưa xác minh thành công build hay port 18897 trên máy.
