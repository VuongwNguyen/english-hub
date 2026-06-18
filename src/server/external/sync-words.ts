import { connectMongo } from '@/lib/mongoose'
import { Word } from '@/models/Word'
import { ApiSyncRun } from '@/models/ApiSyncRun'
import { seedTopics } from '@/server/data/seed-topics'
import { fetchDictionaryWord } from './dictionary'
import { fetchRelatedWords } from './datamuse'
import { normalizeWord } from './normalize'
import { sleep } from './http'

export async function syncWordsFromExternalApis() {
  await connectMongo()

  const run = await ApiSyncRun.create({
    sourceKey: 'dictionary_datamuse',
    jobName: 'sync_words',
    status: 'running',
    params: {
      topics: seedTopics.map((topic) => topic.key),
    },
    startedAt: new Date(),
  })

  let insertedCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

  try {
    const wordsToSync = new Map<
      string,
      {
        topics: string[]
        relatedWords: string[]
        tags: string[]
        sourceUrls: string[]
      }
    >()

    for (const topic of seedTopics) {
      for (const word of topic.words) {
        const normalized = normalizeWord(word)
        const existing = wordsToSync.get(normalized)

        wordsToSync.set(normalized, {
          topics: Array.from(new Set([...(existing?.topics ?? []), topic.key])),
          relatedWords: existing?.relatedWords ?? [],
          tags: existing?.tags ?? [],
          sourceUrls: existing?.sourceUrls ?? [],
        })
      }

      try {
        const related = await fetchRelatedWords({
          meaningLike: topic.key,
          topics: [topic.key],
          max: 20,
        })

        for (const item of related) {
          const normalized = normalizeWord(item.word)
          const existing = wordsToSync.get(normalized)

          wordsToSync.set(normalized, {
            topics: Array.from(
              new Set([...(existing?.topics ?? []), topic.key])
            ),
            relatedWords: Array.from(
              new Set([...(existing?.relatedWords ?? []), item.word])
            ),
            tags: Array.from(new Set([...(existing?.tags ?? []), ...item.tags])),
            sourceUrls: Array.from(
              new Set([...(existing?.sourceUrls ?? []), item.sourceUrl])
            ),
          })
        }
      } catch {
        errorCount++
      }
    }

    for (const [word, meta] of wordsToSync.entries()) {
      try {
        const dictionaryData = await fetchDictionaryWord(word)

        if (!dictionaryData) {
          skippedCount++
          continue
        }

        const result = await Word.updateOne(
          { normalizedWord: word },
          {
            $set: {
              word: dictionaryData.word,
              normalizedWord: word,
              phonetic: dictionaryData.phonetic,
              phonetics: dictionaryData.phonetics,
              definitions: dictionaryData.definitions,
              fetchedAt: new Date(),
              isActive: true,
            },
            $addToSet: {
              topics: { $each: meta.topics },
              relatedWords: { $each: meta.relatedWords },
              tags: { $each: meta.tags },
              sourceNames: {
                $each: ['free_dictionary_api', 'datamuse'],
              },
              sourceUrls: {
                $each: [dictionaryData.sourceUrl, ...meta.sourceUrls],
              },
            },
          },
          { upsert: true }
        )

        if (result.upsertedCount > 0) insertedCount++
        else updatedCount++

        await sleep(150)
      } catch {
        errorCount++
      }
    }

    await ApiSyncRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: 'success',
          insertedCount,
          updatedCount,
          skippedCount,
          errorCount,
          finishedAt: new Date(),
        },
      }
    )

    return {
      insertedCount,
      updatedCount,
      skippedCount,
      errorCount,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    await ApiSyncRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: 'failed',
          errorMessage,
          insertedCount,
          updatedCount,
          skippedCount,
          errorCount,
          finishedAt: new Date(),
        },
      }
    )

    throw error
  }
}
