import { connectMongo } from '@/lib/mongoose'
import { SyncTask } from '@/models/SyncTask'
import { getSyncConfig } from './config'
import { processSyncTask } from './sync-task-processor'

export async function runSyncWorker() {
  await connectMongo()

  const config = getSyncConfig()

  const tasks = await SyncTask.find({
    status: { $in: ['pending', 'failed'] },
    attempts: { $lt: config.maxAttempts },
  })
    .sort({ priority: -1, createdAt: 1 })
    .limit(config.workerBatchSize)

  let successCount = 0
  let failedCount = 0

  const chunks = chunk(tasks, config.workerConcurrency)

  for (const group of chunks) {
    await Promise.all(
      group.map(async (task) => {
        try {
          const locked = await SyncTask.findOneAndUpdate(
            { _id: task._id, status: { $in: ['pending', 'failed'] } },
            {
              $set: { status: 'running', lockedAt: new Date(), lastError: '' },
              $inc: { attempts: 1 },
            },
            { returnDocument: 'after' }
          )

          if (!locked) return

          await processSyncTask(locked)

          await SyncTask.updateOne(
            { _id: locked._id },
            { $set: { status: 'success', finishedAt: new Date(), lockedAt: null } }
          )

          successCount++
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error'

          await SyncTask.updateOne(
            { _id: task._id },
            { $set: { status: 'failed', lockedAt: null, lastError: message } }
          )

          failedCount++
        }
      })
    )
  }

  return {
    pickedCount: tasks.length,
    successCount,
    failedCount,
  }
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}
