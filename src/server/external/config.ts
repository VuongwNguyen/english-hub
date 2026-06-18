export function getSyncConfig() {
  const mode = process.env.SYNC_MODE ?? 'normal'

  const isAggressive = mode === 'aggressive'

  return {
    mode,
    refreshDays: Number(
      process.env.SYNC_REFRESH_DAYS ?? (isAggressive ? 365 : 30)
    ),
    datamuseMax: Number(
      process.env.SYNC_DATAMUSE_MAX ?? (isAggressive ? 100 : 30)
    ),
    tatoebaLimit: Number(
      process.env.SYNC_TATOEBA_LIMIT ?? (isAggressive ? 100 : 30)
    ),
    workerBatchSize: Number(process.env.SYNC_WORKER_BATCH_SIZE ?? 50),
    workerConcurrency: Number(process.env.SYNC_WORKER_CONCURRENCY ?? 3),
    maxAttempts: Number(process.env.SYNC_TASK_MAX_ATTEMPTS ?? 3),
    requestSleepMs: Number(process.env.SYNC_REQUEST_SLEEP_MS ?? 150),
  }
}
