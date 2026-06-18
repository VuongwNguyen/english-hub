import { connectMongo } from '@/lib/mongoose'
import { ExampleSentence } from '@/models/ExampleSentence'
import { ApiSyncRun } from '@/models/ApiSyncRun'
import { seedTopics } from '@/server/data/seed-topics'
import { searchTatoebaSentences } from './tatoeba'
import { normalizeText } from './normalize'
import { sleep } from './http'

export async function syncSentencesFromTatoeba() {
  await connectMongo()

  const run = await ApiSyncRun.create({
    sourceKey: 'tatoeba',
    jobName: 'sync_sentences',
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
    for (const topic of seedTopics) {
      for (const keyword of topic.words) {
        try {
          const sentences = await searchTatoebaSentences({
            keyword,
            lang: 'eng',
            minWords: 3,
            maxWords: 12,
            limit: 20,
          })

          for (const sentence of sentences) {
            if (!isGoodSentence(sentence.text)) {
              skippedCount++
              continue
            }

            const result = await ExampleSentence.updateOne(
              {
                sourceName: sentence.sourceName,
                externalId: sentence.externalId,
              },
              {
                $set: {
                  text: sentence.text,
                  normalizedText: normalizeText(sentence.text),
                  contentHash: sentence.contentHash,
                  lang: sentence.lang,
                  wordCount: sentence.wordCount,
                  sourceUrl: sentence.sourceUrl,
                  license: sentence.license,
                  attribution: sentence.attribution,
                  hasAudio: sentence.hasAudio,
                  audioReuseAllowed: sentence.audioReuseAllowed,
                  fetchedAt: new Date(),
                  isActive: true,
                  level: guessSentenceLevel(sentence.text),
                },
                $addToSet: {
                  topics: topic.key,
                  keywords: keyword.toLowerCase(),
                },
              },
              { upsert: true }
            )

            if (result.upsertedCount > 0) insertedCount++
            else updatedCount++
          }

          await sleep(200)
        } catch {
          errorCount++
        }
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

function isGoodSentence(text: string) {
  const trimmed = text.trim()

  if (trimmed.length < 10) return false
  if (trimmed.length > 180) return false
  if (/[\[\]{}<>]/.test(trimmed)) return false
  if (trimmed.split(/\s+/).length > 16) return false

  return true
}

function guessSentenceLevel(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length

  if (words <= 6) return 'A1'
  if (words <= 10) return 'A2'
  if (words <= 14) return 'B1'

  return 'B2'
}
