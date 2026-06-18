# English Hub — Sync Until Done Script

## 1. Mục tiêu

Hiện tại project có command:

```bash
SYNC_MODE=aggressive yarn sync:tasks:run
```

Command này chỉ xử lý **một batch sync task** rồi dừng.

Nếu muốn xử lý hết toàn bộ `sync_tasks`, người dùng đang phải chạy thủ công:

```bash
for i in {1..200}; do
  echo "=== SYNC ROUND $i ==="
  SYNC_MODE=aggressive yarn sync:tasks:run
done
```

Cách này không tối ưu vì:

```text
- Phải đoán số vòng.
- Nếu 200 vòng chưa đủ thì vẫn còn pending task.
- Nếu task mới được sinh thêm trong quá trình sync thì khó biết khi nào xong.
- Không tự reset task running bị kẹt.
- Không tự generate lessons sau khi sync xong.
```

Mục tiêu là tạo script:

```bash
yarn sync:until-done
```

Script này sẽ chạy sync worker liên tục cho đến khi không còn task nào có thể xử lý.

---

## 2. Expected behavior

Script cần làm:

```text
1. Đọc database name từ env hoặc mặc định english_daily_hub.
2. Kiểm tra trạng thái sync_tasks trước mỗi round.
3. Reset task running bị kẹt quá 30 phút về pending.
4. Nếu còn pending task thì chạy sync worker.
5. Nếu còn failed task nhưng attempts < maxAttempts thì chạy tiếp.
6. Nếu không còn pending, không còn running, không còn retryable failed thì dừng.
7. Sau khi dừng, tự chạy generate:lessons.
8. In final report:
   - words count
   - example_sentences count
   - lessons count
   - sync_tasks count by status
```

---

## 3. Important rules

Không được:

```text
- Không chạy external APIs trong /api/today.
- Không phá sync worker hiện tại.
- Không hardcode database production.
- Không xóa sync_tasks.
- Không reset toàn bộ failed task vô điều kiện.
- Không chạy vô hạn nếu task bị stuck.
```

Được phép:

```text
- Tạo bash script trong scripts/.
- Thêm package script vào package.json.
- Dùng mongosh để query MongoDB.
- Dùng env để config batch size, concurrency, max attempts.
```

---

## 4. File cần tạo

Tạo file:

```text
scripts/sync-until-done.sh
```

Nội dung:

```bash
#!/usr/bin/env bash
set -e

DB_NAME="${DB_NAME:-english_daily_hub}"

SYNC_MODE="${SYNC_MODE:-aggressive}"
SYNC_WORKER_BATCH_SIZE="${SYNC_WORKER_BATCH_SIZE:-150}"
SYNC_WORKER_CONCURRENCY="${SYNC_WORKER_CONCURRENCY:-5}"
SYNC_TASK_MAX_ATTEMPTS="${SYNC_TASK_MAX_ATTEMPTS:-3}"

STALE_RUNNING_MINUTES="${STALE_RUNNING_MINUTES:-30}"
SLEEP_BETWEEN_ROUNDS="${SLEEP_BETWEEN_ROUNDS:-2}"
MAX_ROUNDS="${MAX_ROUNDS:-0}"

ROUND=1

echo "======================================"
echo "English Hub Sync Until Done"
echo "======================================"
echo "DB_NAME=$DB_NAME"
echo "SYNC_MODE=$SYNC_MODE"
echo "SYNC_WORKER_BATCH_SIZE=$SYNC_WORKER_BATCH_SIZE"
echo "SYNC_WORKER_CONCURRENCY=$SYNC_WORKER_CONCURRENCY"
echo "SYNC_TASK_MAX_ATTEMPTS=$SYNC_TASK_MAX_ATTEMPTS"
echo "STALE_RUNNING_MINUTES=$STALE_RUNNING_MINUTES"
echo "SLEEP_BETWEEN_ROUNDS=$SLEEP_BETWEEN_ROUNDS"
echo "MAX_ROUNDS=$MAX_ROUNDS"
echo "======================================"

command -v mongosh >/dev/null 2>&1 || {
  echo "mongosh is required but not installed or not in PATH."
  exit 1
}

while true; do
  echo ""
  echo "=== ROUND $ROUND ==="

  # Reset stale running tasks.
  mongosh "$DB_NAME" --quiet --eval "
    db.sync_tasks.updateMany(
      {
        status: 'running',
        lockedAt: {
          \$lt: new Date(Date.now() - $STALE_RUNNING_MINUTES * 60 * 1000)
        }
      },
      {
        \$set: {
          status: 'pending',
          lockedAt: null,
          lastError: 'Reset stale running task by sync-until-done'
        }
      }
    )
  " > /dev/null

  PENDING=$(mongosh "$DB_NAME" --quiet --eval "db.sync_tasks.countDocuments({ status: 'pending' })")
  RUNNING=$(mongosh "$DB_NAME" --quiet --eval "db.sync_tasks.countDocuments({ status: 'running' })")
  SUCCESS=$(mongosh "$DB_NAME" --quiet --eval "db.sync_tasks.countDocuments({ status: 'success' })")
  FAILED=$(mongosh "$DB_NAME" --quiet --eval "db.sync_tasks.countDocuments({ status: 'failed' })")
  RETRYABLE_FAILED=$(mongosh "$DB_NAME" --quiet --eval "db.sync_tasks.countDocuments({ status: 'failed', attempts: { \$lt: $SYNC_TASK_MAX_ATTEMPTS } })")
  TOTAL=$(mongosh "$DB_NAME" --quiet --eval "db.sync_tasks.countDocuments()")

  echo "total=$TOTAL success=$SUCCESS pending=$PENDING running=$RUNNING failed=$FAILED retryable_failed=$RETRYABLE_FAILED"

  if [ "$PENDING" -eq 0 ] && [ "$RUNNING" -eq 0 ] && [ "$RETRYABLE_FAILED" -eq 0 ]; then
    echo ""
    echo "No runnable sync tasks left."
    break
  fi

  if [ "$MAX_ROUNDS" -gt 0 ] && [ "$ROUND" -gt "$MAX_ROUNDS" ]; then
    echo ""
    echo "Reached MAX_ROUNDS=$MAX_ROUNDS. Stop without marking sync as done."
    break
  fi

  SYNC_MODE="$SYNC_MODE" \
  SYNC_WORKER_BATCH_SIZE="$SYNC_WORKER_BATCH_SIZE" \
  SYNC_WORKER_CONCURRENCY="$SYNC_WORKER_CONCURRENCY" \
  SYNC_TASK_MAX_ATTEMPTS="$SYNC_TASK_MAX_ATTEMPTS" \
  yarn sync:tasks:run

  ROUND=$((ROUND + 1))

  sleep "$SLEEP_BETWEEN_ROUNDS"
done

echo ""
echo "Generating lessons..."
yarn generate:lessons

echo ""
echo "Final counts:"
mongosh "$DB_NAME" --quiet --eval "
  print('words:', db.words.countDocuments())
  print('example_sentences:', db.example_sentences.countDocuments())
  print('lessons:', db.lessons.countDocuments())
  print('sync_tasks:', db.sync_tasks.countDocuments())
  printjson(
    db.sync_tasks.aggregate([
      {
        \$group: {
          _id: '\$status',
          count: { \$sum: 1 }
        }
      },
      { \$sort: { count: -1 } }
    ]).toArray()
  )
"

echo ""
echo "Done."
```

Sau khi tạo file, nhớ chmod:

```bash
chmod +x scripts/sync-until-done.sh
```

---

## 5. Update package.json

Thêm scripts:

```json
{
  "scripts": {
    "sync:until-done": "./scripts/sync-until-done.sh",
    "sync:until-done:aggressive": "SYNC_MODE=aggressive SYNC_WORKER_BATCH_SIZE=150 SYNC_WORKER_CONCURRENCY=5 ./scripts/sync-until-done.sh",
    "sync:until-done:safe": "SYNC_MODE=normal SYNC_WORKER_BATCH_SIZE=20 SYNC_WORKER_CONCURRENCY=1 ./scripts/sync-until-done.sh"
  }
}
```

Không xóa các scripts hiện có.

Đặc biệt phải giữ:

```json
{
  "sync:tasks:seed": "...",
  "sync:tasks:run": "...",
  "generate:lessons": "..."
}
```

Nếu package.json chưa có `sync:tasks:seed` và `sync:tasks:run`, thêm vào:

```json
{
  "scripts": {
    "sync:tasks:seed": "tsx --env-file=.env.local src/server/run-seed-sync-tasks.ts",
    "sync:tasks:run": "tsx --env-file=.env.local src/server/run-sync-worker.ts"
  }
}
```

Nếu project không dùng `--env-file`, giữ style hiện tại của project.

---

## 6. Usage

Chạy MongoDB:

```bash
docker compose up -d
```

Seed tasks:

```bash
yarn sync:sources
yarn sync:tasks:seed
```

Chạy sync đến khi hết task:

```bash
yarn sync:until-done:aggressive
```

Hoặc chạy bản safe:

```bash
yarn sync:until-done:safe
```

Hoặc custom:

```bash
SYNC_MODE=aggressive \
SYNC_WORKER_BATCH_SIZE=200 \
SYNC_WORKER_CONCURRENCY=5 \
yarn sync:until-done
```

---

## 7. Run in background

Nếu muốn chạy nền:

```bash
nohup yarn sync:until-done:aggressive > sync.log 2>&1 &
```

Theo dõi log:

```bash
tail -f sync.log
```

---

## 8. Monitor progress

Có thể check bằng mongosh:

```bash
mongosh english_daily_hub --quiet --eval "
  db.sync_tasks.aggregate([
    {
      \$group: {
        _id: '\$status',
        count: { \$sum: 1 }
      }
    },
    { \$sort: { count: -1 } }
  ]).toArray()
"
```

Check count data:

```bash
mongosh english_daily_hub --quiet --eval "
  print('words:', db.words.countDocuments())
  print('example_sentences:', db.example_sentences.countDocuments())
  print('lessons:', db.lessons.countDocuments())
"
```

---

## 9. Failed task handling

Script không được reset mọi failed task vô điều kiện.

Nó chỉ xử lý failed task còn retry được:

```text
status = failed
attempts < SYNC_TASK_MAX_ATTEMPTS
```

Nếu failed task đã hết attempts, script sẽ bỏ qua.

Để xem lỗi:

```bash
mongosh english_daily_hub --quiet --eval "
  db.sync_tasks.find(
    { status: 'failed' },
    {
      type: 1,
      topic: 1,
      keyword: 1,
      attempts: 1,
      lastError: 1
    }
  ).limit(20).toArray()
"
```

Nếu user muốn retry toàn bộ failed task thủ công:

```bash
mongosh english_daily_hub --quiet --eval "
  db.sync_tasks.updateMany(
    { status: 'failed' },
    {
      \$set: {
        status: 'pending',
        attempts: 0,
        lockedAt: null,
        lastError: ''
      }
    }
  )
"
```

Không đưa command này vào script tự động.

---

## 10. Acceptance Criteria

Hoàn thành khi:

```text
[ ] Có file scripts/sync-until-done.sh.
[ ] File có quyền executable.
[ ] package.json có script sync:until-done.
[ ] package.json có script sync:until-done:aggressive.
[ ] package.json có script sync:until-done:safe.
[ ] Script đọc DB_NAME từ env, mặc định english_daily_hub.
[ ] Script đọc SYNC_MODE từ env, mặc định aggressive.
[ ] Script đọc batch size/concurrency/max attempts từ env.
[ ] Script reset running task bị kẹt quá 30 phút.
[ ] Script chạy yarn sync:tasks:run theo từng round.
[ ] Script dừng khi không còn pending/running/retryable failed.
[ ] Script tự chạy yarn generate:lessons sau khi dừng.
[ ] Script in final counts.
[ ] yarn sync:until-done:safe chạy được.
[ ] yarn sync:until-done:aggressive chạy được.
```

---

## 11. Important warning for AI agent

Không chạy full `sync:until-done:aggressive` trong lúc build/test của coding agent.

Vì full sync có thể mất rất lâu.

Khi agent test implementation, chỉ dùng:

```bash
MAX_ROUNDS=1 SYNC_WORKER_BATCH_SIZE=5 SYNC_WORKER_CONCURRENCY=1 yarn sync:until-done
```

Sau đó chạy:

```bash
yarn build
```

Full sync là operational task, user sẽ tự chạy sau.

---

## 12. Final Agent Prompt

Use this prompt:

```text
Read docs/SYNC_UNTIL_DONE_AGENT.md.

Implement a robust sync-until-done script for the English Hub project.

Requirements:
1. Create scripts/sync-until-done.sh.
2. Make it executable.
3. Add package.json scripts:
   - sync:until-done
   - sync:until-done:aggressive
   - sync:until-done:safe
4. Ensure existing sync scripts still work.
5. The script must loop until there are no pending tasks, no running tasks, and no retryable failed tasks.
6. Reset stale running tasks older than 30 minutes.
7. Run yarn sync:tasks:run each round.
8. Run yarn generate:lessons after sync is done.
9. Print final counts.
10. Do not run full aggressive sync during implementation test.
11. For testing, use:
    MAX_ROUNDS=1 SYNC_WORKER_BATCH_SIZE=5 SYNC_WORKER_CONCURRENCY=1 yarn sync:until-done
12. Run yarn build and fix all errors.

Do not call external APIs inside /api/today.
Do not delete any existing data.
Do not reset all failed tasks automatically.
```
