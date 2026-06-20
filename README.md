# English Daily Hub

Ứng dụng học tiếng Anh hằng ngày dành cho lập trình viên bận rộn. Mỗi ngày
người học nhận một kế hoạch ngắn gồm 5 dạng bài, theo dõi tiến độ tự động và
xem lại thống kê theo tuần.

## Tính năng

### Trải nghiệm học hằng ngày

- Tạo một kế hoạch ổn định cho từng ngày theo múi giờ Việt Nam.
- Mỗi ngày có đúng 5 dạng bài: Listening, Vocabulary, Speaking, Writing và
  Dev English, với tổng thời gian mục tiêu khoảng 20–30 phút.
- Daily Learning Hub hiển thị tiến độ, thời gian học và bài nên tiếp tục.
- Focus Mode tại `/learn/[itemId]` chỉ hiển thị một bài để giảm phân tâm.
- Cho phép skip và hoàn tác; bỏ qua bài không bị coi là thất bại.
- Tự chuyển tới tổng kết khi toàn bộ bài đã hoàn thành hoặc được bỏ qua.
- Không sử dụng streak gây áp lực; comeback được ghi nhận theo hướng tích cực.

### Luyện tập, tracking và đánh giá

- Tự chuyển trạng thái `pending → in_progress` khi người học bắt đầu tương tác.
- Heartbeat 15 giây chỉ chạy khi tab đang hiển thị, trình duyệt online và người
  học vừa có hoạt động.
- Theo dõi thời gian active, số từ đã luyện, nội dung đã nhập, tiến độ audio và
  thời lượng ghi âm.
- Listening hỗ trợ audio khi có URL phát trực tiếp, fallback đọc nội dung khi
  không có audio và tạo mini quiz từ lesson.
- Vocabulary cho phép đánh dấu từng từ/cụm từ đã luyện.
- Speaking dùng `MediaRecorder`, hỗ trợ transcript qua Web Speech API khi trình
  duyệt cung cấp và có fallback nhập nội dung khi không dùng được microphone.
- Writing và Dev English theo dõi bản nháp và số lượng từ.
- Chấm điểm rule-based theo từng dạng bài, hiển thị score, điểm mạnh, phần cần
  cải thiện và yêu cầu retry khi chưa đạt.
- Kết hợp tracking với kết quả đánh giá trước khi đánh dấu hoàn thành; các lần
  gọi lặp được xử lý idempotent để không cộng trùng thống kê.

### Nội dung và cá nhân hóa

- Tránh lặp lesson trong 7 ngày gần nhất và hạn chế lặp nhóm chủ đề.
- Ưu tiên lesson ít được dùng, chất lượng cao và có độ khó phù hợp.
- Phân tích lịch sử 14 ngày để nhận diện kỹ năng yếu dựa trên điểm số, skip,
  completion và mức độ tương tác.
- Tăng `reviewPriority` sau lần đánh giá không đạt để nội dung tương tự có cơ
  hội xuất hiện lại.
- Dùng virtual fallback nếu cơ sở dữ liệu thiếu lesson cho một dạng bài.
- Taxonomy bao phủ chủ đề đời sống, xã hội, kiến thức, công việc, công nghệ và
  nhiều lĩnh vực khác, không giới hạn ở tiếng Anh cho lập trình viên.

### Dữ liệu và vận hành

- Đồng bộ Dictionary API, Datamuse và Tatoeba vào MongoDB trước khi tạo lesson.
- Chuẩn hóa, deduplicate và upsert dữ liệu để chạy lại không tạo bản ghi trùng.
- Sync task queue có batch, concurrency, retry, resume và reset task bị kẹt.
- Safe/aggressive mode cho các quy mô đồng bộ khác nhau.
- Tự sinh lesson đa dạng từ word và example-sentence cache.
- Data Health API thống kê words, sentences, lessons, topic coverage, task
  status và các sync run gần nhất.
- Tổng kết cuối ngày, thống kê tuần và lịch sử 30 ngày.

Luồng dữ liệu bên ngoài được thiết kế theo hướng:

```text
External APIs
  → sync tasks
  → chuẩn hóa và loại trùng
  → MongoDB
  → tạo lesson
  → daily rotation
```

Trang học hằng ngày chỉ đọc dữ liệu từ MongoDB, không gọi trực tiếp API bên
ngoài.

## Công nghệ

- Next.js 16 App Router
- React 19
- TypeScript 5
- Tailwind CSS 4
- MongoDB và Mongoose
- Zod

## Yêu cầu

- Node.js 20.9 trở lên
- Yarn
- Docker và Docker Compose, hoặc một MongoDB server có sẵn
- `mongosh` nếu sử dụng các lệnh `sync:until-done`

## Cài đặt

### 1. Cài dependency

```bash
yarn install
```

### 2. Khởi động MongoDB

Repository có sẵn cấu hình Docker Compose:

```bash
docker compose up -d
```

MongoDB sẽ chạy tại `mongodb://localhost:27017`.

### 3. Tạo file môi trường

Tạo `.env.local` ở thư mục gốc:

```dotenv
MONGODB_URI=mongodb://localhost:27017/english-daily-hub
ADMIN_SYNC_KEY=thay-bang-mot-chuoi-bi-mat
```

`MONGODB_URI` là bắt buộc. `ADMIN_SYNC_KEY` dùng để xác thực các API quản trị
trong môi trường local. Các route quản trị và đồng bộ hiện bị vô hiệu hóa khi
`NODE_ENV=production`.

Các biến tùy chọn cho pipeline đồng bộ:

```dotenv
SYNC_MODE=normal
SYNC_REFRESH_DAYS=30
SYNC_DATAMUSE_MAX=30
SYNC_TATOEBA_LIMIT=30
SYNC_WORKER_BATCH_SIZE=50
SYNC_WORKER_CONCURRENCY=3
SYNC_TASK_MAX_ATTEMPTS=3
SYNC_REQUEST_SLEEP_MS=150
```

### 4. Nạp dữ liệu mẫu

Cách nhanh nhất để chạy ứng dụng:

```bash
yarn seed
```

Lệnh này chỉ thêm dữ liệu khi collection lesson đang trống.

### 5. Chạy development server

```bash
yarn dev
```

Mở [http://localhost:3000](http://localhost:3000).

Các trang chính:

- `/today`: kế hoạch và tiến độ hôm nay
- `/learn/[itemId]`: chế độ học tập trung
- `/today/summary`: tổng kết sau khi hoàn thành kế hoạch
- `/stats`: thống kê tuần và lịch sử học

## Đồng bộ dữ liệu bên ngoài

Các nguồn hiện tại:

- Free Dictionary API: định nghĩa, phiên âm và thông tin từ vựng
- Datamuse: khám phá từ liên quan theo chủ đề
- Tatoeba: câu ví dụ tiếng Anh

Không cần API key cho ba nguồn này. Pipeline tôn trọng giới hạn batch và không
tải hoặc tái sử dụng Tatoeba audio.

Chạy toàn bộ pipeline:

```bash
yarn data:bootstrap:tasks
```

Hoặc chạy từng bước:

```bash
yarn sync:sources
yarn sync:tasks:seed
yarn sync:tasks:run
yarn generate:lessons
```

Để worker tiếp tục chạy đến khi xử lý hết task:

```bash
yarn sync:until-done
```

Hai cấu hình có sẵn:

```bash
yarn sync:until-done:safe
yarn sync:until-done:aggressive
```

Chế độ `aggressive` tăng số lượng dữ liệu, batch size và concurrency; chỉ nên
dùng khi MongoDB và các API nguồn chịu được tải tương ứng.

Kiểm tra sức khỏe dữ liệu trong development:

```bash
curl \
  -H "x-admin-key: $ADMIN_SYNC_KEY" \
  http://localhost:3000/api/admin/data-health
```

## Scripts

| Lệnh | Mô tả |
| --- | --- |
| `yarn dev` | Chạy development server |
| `yarn build` | Build production |
| `yarn start` | Chạy production server sau khi build |
| `yarn lint` | Kiểm tra ESLint |
| `yarn seed` | Nạp bộ lesson mẫu |
| `yarn backfill:lesson-slugs` | Bổ sung slug cho lesson cũ |
| `yarn sync:sources` | Khởi tạo/cập nhật danh sách nguồn dữ liệu |
| `yarn sync:words` | Đồng bộ từ vựng trực tiếp |
| `yarn sync:sentences` | Đồng bộ câu ví dụ trực tiếp |
| `yarn sync:tasks:seed` | Tạo các sync task |
| `yarn sync:tasks:run` | Chạy một lượt sync worker |
| `yarn generate:lessons` | Tạo lesson từ dữ liệu đã cache |
| `yarn data:bootstrap:tasks` | Chạy pipeline task đầy đủ |
| `yarn sync:until-done` | Lặp worker đến khi hết task |

## Cấu trúc thư mục

```text
src/
├── app/                  # Pages và Route Handlers
├── components/           # UI và các lesson view
├── lib/                  # MongoDB, date, auth và helper dùng chung
├── models/               # Mongoose models
├── server/
│   ├── external/         # Client API và pipeline đồng bộ
│   ├── learning/         # Tracking, evaluation, completion, personalization
│   └── data/             # Taxonomy và dữ liệu nền
└── types/                # Kiểu dữ liệu dùng chung

docs/                     # Tài liệu kiến trúc và kế hoạch triển khai
scripts/                  # Script vận hành pipeline
docker-compose.yml        # MongoDB cho môi trường local
```

## Kiểm tra trước khi commit

```bash
yarn lint
npx tsc --noEmit
yarn build
```

Hiện repository chưa cấu hình test runner tự động.

## Trạng thái và kế hoạch

Các tính năng dưới đây đã có tài liệu thiết kế nhưng **chưa được triển khai**
trong code hiện tại:

- Dịch nội dung lesson sang tiếng Việt theo yêu cầu, cache kết quả trên lesson.
- Thay bộ chấm điểm rule-based bằng AI grading qua local `claude` CLI.

Các giới hạn hiện tại:

- Chưa có authentication hoặc dữ liệu tách theo user.
- Personalization sử dụng toàn bộ lịch sử của một người dùng duy nhất.
- Chưa có speech-to-text đồng nhất giữa các trình duyệt; Web Speech API chỉ là
  khả năng bổ sung khi được hỗ trợ.
- Listening thường dùng link nguồn và fallback đọc nội dung vì model chưa có
  trường audio URL chuyên biệt.

## Chạy production

```bash
yarn build
yarn start
```

Môi trường production cần kết nối được tới MongoDB. Các route quản trị/sync
đang bị khóa hoàn toàn ở production; nếu cần vận hành chúng từ xa, phải bổ sung
cơ chế xác thực phù hợp thay vì chỉ mở lại route. Ứng dụng hiện được thiết kế
cho một người dùng và chưa có hệ thống đăng nhập; cần bổ sung authentication và
phân tách dữ liệu theo user trước khi triển khai như một dịch vụ nhiều người
dùng.

## Tài liệu thêm

- [`docs/API_DATA_INTEGRATION.md`](docs/API_DATA_INTEGRATION.md): kiến trúc đồng bộ API
- [`docs/AGGRESSIVE_DATA_PIPELINE.md`](docs/AGGRESSIVE_DATA_PIPELINE.md): pipeline dữ liệu dung lượng lớn
- [`docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md`](docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md): thiết kế trải nghiệm học
- [`docs/AI_AGENT_IMPLEMENTATION.md`](docs/AI_AGENT_IMPLEMENTATION.md): hướng dẫn triển khai bằng agent
- [`docs/EXPAND_TOPIC_TAXONOMY_AGENT.md`](docs/EXPAND_TOPIC_TAXONOMY_AGENT.md): mở rộng taxonomy
- [`docs/SYNC_UNTIL_DONE_AGENT.md`](docs/SYNC_UNTIL_DONE_AGENT.md): worker chạy đến khi hết task
- [`docs/superpowers/specs/2026-06-20-vietnamese-translation-design.md`](docs/superpowers/specs/2026-06-20-vietnamese-translation-design.md): thiết kế dịch tiếng Việt
- [`docs/superpowers/specs/2026-06-20-ai-grading-design.md`](docs/superpowers/specs/2026-06-20-ai-grading-design.md): thiết kế AI grading
