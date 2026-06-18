import { connectMongo } from '@/lib/mongoose'
import { SyncTask } from '@/models/SyncTask'
import { topicTaxonomy } from '@/server/data/topic-taxonomy'
import { normalizeWord, toSlug } from './normalize'

type SyncTaskType = 'datamuse_expand' | 'dictionary_enrich' | 'tatoeba_sentence_search'

type TaskInput = {
  type: SyncTaskType
  taskKey: string
}

export async function seedSyncTasks() {
  await connectMongo()

  let insertedCount = 0
  let updatedCount = 0

  for (const topic of topicTaxonomy) {
    for (const rawKeyword of topic.words) {
      const keyword = normalizeWord(rawKeyword)

      const taskInputs: TaskInput[] = [
        {
          type: 'datamuse_expand',
          taskKey: `datamuse-${toSlug(topic.key)}-${toSlug(keyword)}`,
        },
        {
          type: 'tatoeba_sentence_search',
          taskKey: `tatoeba-${toSlug(topic.key)}-${toSlug(keyword)}`,
        },
      ]

      for (const input of taskInputs) {
        const result = await SyncTask.updateOne(
          { taskKey: input.taskKey },
          {
            $setOnInsert: {
              taskKey: input.taskKey,
              type: input.type,
              status: 'pending',
              topic: topic.key,
              topicGroup: topic.group,
              keyword,
              attempts: 0,
              priority: 0,
              lockedAt: null,
              finishedAt: null,
              lastError: '',
            },
          },
          { upsert: true }
        )

        if (result.upsertedCount > 0) insertedCount++
        else updatedCount++
      }
    }
  }

  return {
    insertedCount,
    updatedCount,
  }
}
