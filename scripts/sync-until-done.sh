#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

DB_NAME="${DB_NAME:-english_daily_hub}"

# Only pull MONGODB_URI from .env.local (never override SYNC_* vars the
# caller may have passed on the command line — those must win over the
# file's defaults).
if [ -z "$MONGODB_URI" ] && [ -f .env.local ]; then
  MONGODB_URI=$(grep -m1 '^MONGODB_URI=' .env.local | sed -E 's/^MONGODB_URI=//; s/^"(.*)"$/\1/')
fi

MONGO_TARGET="${MONGODB_URI:-$DB_NAME}"

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
  mongosh "$MONGO_TARGET" --quiet --eval "
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

  PENDING=$(mongosh "$MONGO_TARGET" --quiet --eval "db.sync_tasks.countDocuments({ status: 'pending' })")
  RUNNING=$(mongosh "$MONGO_TARGET" --quiet --eval "db.sync_tasks.countDocuments({ status: 'running' })")
  SUCCESS=$(mongosh "$MONGO_TARGET" --quiet --eval "db.sync_tasks.countDocuments({ status: 'success' })")
  FAILED=$(mongosh "$MONGO_TARGET" --quiet --eval "db.sync_tasks.countDocuments({ status: 'failed' })")
  RETRYABLE_FAILED=$(mongosh "$MONGO_TARGET" --quiet --eval "db.sync_tasks.countDocuments({ status: 'failed', attempts: { \$lt: $SYNC_TASK_MAX_ATTEMPTS } })")
  TOTAL=$(mongosh "$MONGO_TARGET" --quiet --eval "db.sync_tasks.countDocuments()")

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
mongosh "$MONGO_TARGET" --quiet --eval "
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
