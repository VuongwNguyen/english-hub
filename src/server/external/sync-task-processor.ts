/* eslint-disable @typescript-eslint/no-explicit-any */
import { SyncTask } from '@/models/SyncTask'
import { Word } from '@/models/Word'
import { ExampleSentence } from '@/models/ExampleSentence'
import { fetchRelatedWords } from './datamuse'
import { fetchDictionaryWord } from './dictionary'
import { searchTatoebaSentences } from './tatoeba'
import { getSyncConfig } from './config'
import { normalizeWord, toSlug } from './normalize'
import { sleep } from './http'

export async function processSyncTask(task: any) {
  if (task.type === 'datamuse_expand') return processDatamuseExpandTask(task)
  if (task.type === 'dictionary_enrich')
    return processDictionaryEnrichTask(task)
  if (task.type === 'tatoeba_sentence_search')
    return processTatoebaSentenceSearchTask(task)
  throw new Error(`Unknown sync task type: ${task.type}`)
}

async function processDatamuseExpandTask(task: any) {
  const config = getSyncConfig()

  const relatedWords = await fetchRelatedWords({
    meaningLike: task.keyword,
    topics: [task.topic],
    max: config.datamuseMax,
  })

  for (const item of relatedWords) {
    const normalizedWord = normalizeWord(item.word)

    await Word.updateOne(
      { normalizedWord },
      {
        $setOnInsert: {
          word: item.word,
          normalizedWord,
          phonetic: '',
          phonetics: [],
          definitions: [],
          fetchedAt: null,
          isActive: true,
        },
        $addToSet: {
          topics: task.topic,
          topicGroups: task.topicGroup,
          relatedWords: { $each: [task.keyword] },
          tags: { $each: item.tags ?? [] },
          sourceNames: 'datamuse',
          sourceUrls: item.sourceUrl,
        },
      },
      { upsert: true }
    )

    await SyncTask.updateOne(
      { taskKey: `dictionary-${toSlug(normalizedWord)}` },
      {
        $setOnInsert: {
          taskKey: `dictionary-${toSlug(normalizedWord)}`,
          type: 'dictionary_enrich',
          status: 'pending',
          topic: task.topic,
          topicGroup: task.topicGroup,
          keyword: normalizedWord,
          attempts: 0,
          priority: 0,
          lockedAt: null,
          finishedAt: null,
          lastError: '',
        },
      },
      { upsert: true }
    )
  }

  await sleep(config.requestSleepMs)
}

async function processDictionaryEnrichTask(task: any) {
  const config = getSyncConfig()
  const normalizedWord = normalizeWord(task.keyword)

  const existing = await Word.findOne({ normalizedWord }).lean<any>()

  if (existing && isFreshWord(existing, config.refreshDays)) {
    await Word.updateOne(
      { normalizedWord },
      {
        $addToSet: {
          topics: task.topic,
          topicGroups: task.topicGroup,
          sourceNames: 'free_dictionary_api',
        },
      }
    )
    return
  }

  const result = await fetchDictionaryWord(normalizedWord)

  if (!result) {
    return
  }

  await Word.updateOne(
    { normalizedWord },
    {
      $set: {
        word: result.word,
        normalizedWord,
        phonetic: result.phonetic,
        phonetics: result.phonetics,
        definitions: result.definitions,
        fetchedAt: result.fetchedAt,
        isActive: true,
      },
      $addToSet: {
        topics: task.topic,
        topicGroups: task.topicGroup,
        sourceNames: result.sourceName,
        sourceUrls: result.sourceUrl,
      },
    },
    { upsert: true }
  )

  await sleep(config.requestSleepMs)
}

function isFreshWord(word: any, refreshDays: number) {
  if (!word.fetchedAt) return false
  if (!word.definitions || word.definitions.length === 0) return false

  const ageMs = Date.now() - new Date(word.fetchedAt).getTime()
  const refreshMs = refreshDays * 24 * 60 * 60 * 1000

  return ageMs <= refreshMs
}

async function processTatoebaSentenceSearchTask(task: any) {
  const config = getSyncConfig()

  const sentences = await searchTatoebaSentences({
    keyword: task.keyword,
    lang: 'eng',
    minWords: 3,
    maxWords: 14,
    limit: config.tatoebaLimit,
  })

  for (const sentence of sentences) {
    if (!isGoodSentence(sentence.text)) continue

    await ExampleSentence.updateOne(
      { sourceName: sentence.sourceName, externalId: sentence.externalId },
      {
        $set: {
          text: sentence.text,
          normalizedText: sentence.normalizedText,
          contentHash: sentence.contentHash,
          lang: sentence.lang,
          wordCount: sentence.wordCount,
          sourceName: sentence.sourceName,
          sourceUrl: sentence.sourceUrl,
          externalId: sentence.externalId,
          license: sentence.license,
          attribution: sentence.attribution,
          hasAudio: sentence.hasAudio,
          audioReuseAllowed: sentence.audioReuseAllowed,
          fetchedAt: sentence.fetchedAt,
          isActive: sentence.isActive,
          level: guessSentenceLevel(sentence.text),
        },
        $addToSet: {
          topics: task.topic,
          topicGroups: task.topicGroup,
          keywords: { $each: sentence.keywords },
        },
      },
      { upsert: true }
    )
  }

  await sleep(config.requestSleepMs)
}

function isGoodSentence(text: string) {
  const trimmed = text.trim()

  if (trimmed.length < 10 || trimmed.length > 180) return false
  if (/[[\]{}<>]/.test(trimmed)) return false

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  if (wordCount > 18) return false

  return true
}

function guessSentenceLevel(text: string) {
  const wordCount = text.split(/\s+/).filter(Boolean).length

  if (wordCount <= 6) return 'A1'
  if (wordCount <= 10) return 'A2'
  if (wordCount <= 14) return 'B1'
  return 'B2'
}
