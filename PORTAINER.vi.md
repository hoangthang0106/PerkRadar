# PerkRadar — Hướng dẫn cài trên Portainer (Git Stack, port 18897:18897)

Repository của bạn: https://github.com/hoangthang0106/PerkRadar

## 1. Thông số triển khai

- **Host port = container port = 18897**; tiến trình Node thực sự lắng nghe 18897 qua biến `PORT`.
- **Một container duy nhất:** `perkradar`; không Caddy/FlareSolverr/database phụ.
- **Image:** `local/perkradar-itmanager:18897`. Đây là tên image **bạn cần build trên đúng Docker endpoint trước khi Deploy Git Stack**, không phải image có sẵn trên Docker Hub.
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

## 3. QUAN TRỌNG — Build image từ fork (một lần)

Repository PerkRadar gốc **không cung cấp image được khuyến nghị để pull trực tiếp**; Dockerfile có sẵn ở thư mục gốc.

Portainer có hạn chế build trực tiếp bằng Compose Git Stack khi Docker endpoint từ xa (xem https://docs.portainer.io/faqs/known-issues/docker-compose-files-including-build-steps-fail ). Vì vậy Compose trong fork đã **bỏ `build:`** để không đụng lỗi này.

Cách 1 — **Portainer giao diện web**:
1. Mở **Images → Build a new image** trên **đúng Docker endpoint** cần cài.
2. **Image name:** `local/perkradar-itmanager:18897`.
3. Chọn cách build từ **URL**.
4. **Repository/Git URL:** `https://github.com/hoangthang0106/PerkRadar.git#main`.
5. **Dockerfile path:** `Dockerfile` (nếu Portainer hiển thị trường này).
6. Nhấn **Build the image**. Kiểm tra Images có `local/perkradar-itmanager:18897` trước khi tạo Stack.

Cách 2 — **Docker CLI trên đúng host Docker** (dự phòng nếu Portainer Images không hỗ trợ URL Git):
```sh
docker build --pull -t local/perkradar-itmanager:18897 'https://github.com/hoangthang0106/PerkRadar.git#main'
```

Vì đây là Next.js, build cần tải package npm và có thể mất tài nguyên; trên Docker host cần đủ RAM, dung lượng đĩa và kết nối Internet. Không cần tạo thêm container khi ứng dụng chạy.

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
- Nếu Portainer Git Stack báo `image not found`, nghĩa là **chưa build image đúng tag trên đúng endpoint**. Nếu báo `reference not found`, kiểm tra reference đúng **refs/heads/main** (không phải master).
- Mở truy cập công cộng cần HTTPS và cấu hình bảo mật khác, không được dùng trực tiếp cấu hình HTTP LAN này.

**Trạng thái:** GitHub đã có Compose một container và tài liệu cài; chưa chạy Portainer thực tế và chưa kiểm tra port 18897 trên máy.
