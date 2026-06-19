/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectMongo } from '@/lib/mongoose'
import { Word } from '@/models/Word'
import { ExampleSentence } from '@/models/ExampleSentence'
import { Lesson } from '@/models/Lesson'
import { listeningLessons } from '@/server/data/listening-lessons'
import { topicTaxonomy } from '@/server/data/topic-taxonomy'
import { toSlug } from './normalize'
import { computeQualityScore } from '@/server/learning/quality'
import { computeDifficultyScore } from '@/server/learning/difficulty'

export async function generateLessonsFromCachedData() {
  await connectMongo()

  const listeningResult = await upsertListeningLessons()
  const vocabResult = await generateVocabLessons()
  const sentenceResult = await generateSentenceLessons()
  const speakingResult = await generateSpeakingLessons()
  const writingResult = await generateWritingLessons()

  return {
    listeningResult,
    vocabResult,
    sentenceResult,
    speakingResult,
    writingResult,
  }
}

async function upsertListeningLessons() {
  let inserted = 0
  let updated = 0

  for (const lesson of listeningLessons) {
    const result = await Lesson.updateOne(
      { slug: lesson.slug },
      {
        $set: {
          ...lesson,
          qualityScore: computeQualityScore(lesson),
          difficultyScore: computeDifficultyScore(lesson),
          generatedFrom: 'static_listening_tasks',
          regeneratedAt: new Date(),
        },
        $setOnInsert: {
          useCount: 0,
          lastUsedAt: null,
          lastUsedDate: null,
        },
      },
      { upsert: true }
    )

    if (result.upsertedCount > 0) inserted++
    else updated++
  }

  return { inserted, updated }
}

async function generateVocabLessons() {
  const topics = await Word.distinct('topics')

  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const topic of topics) {
    const words = await Word.find({
      topics: topic,
      isActive: true,
    })
      .limit(5)
      .lean()

    if (words.length < 3) {
      skipped++
      continue
    }

    const content = words
      .map((word: any) => {
        const firstDefinition = word.definitions?.[0]?.definition ?? ''
        return `- ${word.word}: ${firstDefinition}`
      })
      .join('\n')

    const slug = `vocab-${toSlug(topic)}`
    const topicGroup = (words[0] as any)?.topicGroups?.[0] ?? 'general'
    const title = `Vocabulary pack: ${topic}`

    const result = await Lesson.updateOne(
      { slug },
      {
        $set: {
          slug,
          title,
          topic,
          topicGroup,
          level: 'A2',
          type: 'vocab',
          content,
          estimatedMinutes: 5,
          wordsCount: words.length,
          speakingMinutes: 0,
          writingSentences: 0,
          sourceNames: ['free_dictionary_api', 'datamuse'],
          sourceUrls: ['https://dictionaryapi.dev/', 'https://www.datamuse.com/api/'],
          isActive: true,
          generatedFrom: 'words_cache',
          regeneratedAt: new Date(),
          qualityScore: computeQualityScore({
            title,
            type: 'vocab',
            content,
            wordsCount: words.length,
          }),
          difficultyScore: computeDifficultyScore({
            title,
            type: 'vocab',
            content,
          }),
        },
        $setOnInsert: {
          useCount: 0,
          lastUsedAt: null,
          lastUsedDate: null,
        },
      },
      { upsert: true }
    )

    if (result.upsertedCount > 0) inserted++
    else updated++
  }

  return { inserted, updated, skipped }
}

async function generateSentenceLessons() {
  const topics = await ExampleSentence.distinct('topics')

  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const topic of topics) {
    const sentences = await ExampleSentence.find({
      topics: topic,
      isActive: true,
    })
      .limit(5)
      .lean()

    if (sentences.length < 3) {
      skipped++
      continue
    }

    const content = [
      'Read these sentences out loud:',
      '',
      ...sentences.map((sentence: any) => `- ${sentence.text}`),
    ].join('\n')

    const slug = `dev-english-sentences-${toSlug(topic)}`
    const topicGroup = (sentences[0] as any)?.topicGroups?.[0] ?? 'general'
    const title = `Sentence practice: ${topic}`

    const result = await Lesson.updateOne(
      { slug },
      {
        $set: {
          slug,
          title,
          topic,
          topicGroup,
          level: 'A2',
          type: 'dev_english',
          content,
          estimatedMinutes: 5,
          wordsCount: 0,
          speakingMinutes: 0,
          writingSentences: 0,
          sourceNames: ['tatoeba'],
          sourceUrls: ['https://api.tatoeba.org/'],
          isActive: true,
          generatedFrom: 'example_sentences_cache',
          regeneratedAt: new Date(),
          qualityScore: computeQualityScore({ title, type: 'dev_english', content }),
          difficultyScore: computeDifficultyScore({ title, type: 'dev_english', content }),
        },
        $setOnInsert: {
          useCount: 0,
          lastUsedAt: null,
          lastUsedDate: null,
        },
      },
      { upsert: true }
    )

    if (result.upsertedCount > 0) inserted++
    else updated++
  }

  return { inserted, updated, skipped }
}

async function generateSpeakingLessons() {
  let inserted = 0
  let updated = 0

  for (const topicItem of topicTaxonomy) {
    const topic = topicItem.key
    const topicGroup = topicItem.group
    const slug = `speaking-${toSlug(topic)}`

    const content = [
      `Speak for 1 minute about ${topic}.`,
      'Use simple sentences.',
      'Try to use at least 3 words from today’s vocabulary.',
    ].join('\n')
    const title = `Speaking prompt: ${topic}`

    const result = await Lesson.updateOne(
      { slug },
      {
        $set: {
          slug,
          title,
          topic,
          topicGroup,
          level: 'A2',
          type: 'speaking',
          content,
          estimatedMinutes: 5,
          wordsCount: 0,
          speakingMinutes: 1,
          writingSentences: 0,
          sourceNames: ['internal'],
          sourceUrls: [],
          isActive: true,
          generatedFrom: 'internal_template',
          regeneratedAt: new Date(),
          qualityScore: computeQualityScore({ title, type: 'speaking', content }),
          difficultyScore: computeDifficultyScore({ title, type: 'speaking', content }),
        },
        $setOnInsert: {
          useCount: 0,
          lastUsedAt: null,
          lastUsedDate: null,
        },
      },
      { upsert: true }
    )

    if (result.upsertedCount > 0) inserted++
    else updated++
  }

  return { inserted, updated }
}

async function generateWritingLessons() {
  let inserted = 0
  let updated = 0

  for (const topicItem of topicTaxonomy) {
    const topic = topicItem.key
    const topicGroup = topicItem.group
    const slug = `writing-${toSlug(topic)}`

    const content = [
      `Write 3 sentences about ${topic}:`,
      '1. Today I...',
      '2. I had a problem with...',
      '3. Tomorrow I will...',
    ].join('\n')
    const title = `Writing prompt: ${topic}`

    const result = await Lesson.updateOne(
      { slug },
      {
        $set: {
          slug,
          title,
          topic,
          topicGroup,
          level: 'A2',
          type: 'writing',
          content,
          estimatedMinutes: 5,
          wordsCount: 0,
          speakingMinutes: 0,
          writingSentences: 3,
          sourceNames: ['internal'],
          sourceUrls: [],
          isActive: true,
          generatedFrom: 'internal_template',
          regeneratedAt: new Date(),
          qualityScore: computeQualityScore({ title, type: 'writing', content }),
          difficultyScore: computeDifficultyScore({ title, type: 'writing', content }),
        },
        $setOnInsert: {
          useCount: 0,
          lastUsedAt: null,
          lastUsedDate: null,
        },
      },
      { upsert: true }
    )

    if (result.upsertedCount > 0) inserted++
    else updated++
  }

  return { inserted, updated }
}

/**
 * Builds an in-memory "virtual" fallback lesson for the given type.
 *
 * This is NOT persisted to MongoDB — it's a pure factory function consumed
 * by rotation.ts (task B11) as an emergency safety net when no real lesson
 * exists in the DB for a given type. The `_id` is intentionally a string,
 * not a Mongo ObjectId, since these objects never touch the database.
 *
 * qualityScore/difficultyScore are computed (not left at the schema default
 * of 0) even though this object is never persisted: rotation.ts's
 * `pickLesson()` only consults real Lesson.find() queries when sorting by
 * qualityScore (this object short-circuits that path entirely, returned
 * only when no real lesson exists for the type), so the score is never
 * actually compared against other lessons today. It's computed anyway so
 * the values are sane/non-zero if a future caller (e.g. Task 11's
 * personalization work) starts reading qualityScore off DailyPlanItem
 * snapshots for display or weighting purposes.
 */
export function createVirtualFallbackLesson(type: string) {
  const lesson = buildVirtualFallbackLesson(type)

  return {
    ...lesson,
    qualityScore: computeQualityScore(lesson),
    difficultyScore: computeDifficultyScore(lesson),
  }
}

function buildVirtualFallbackLesson(type: string) {
  const base = {
    _id: `virtual-${type}-${Date.now()}`,
    slug: `virtual-${type}`,
    topic: 'fallback',
    level: 'A2',
    type,
    estimatedMinutes: 5,
    wordsCount: 0,
    speakingMinutes: 0,
    writingSentences: 0,
    sourceNames: ['internal_fallback'],
    sourceUrls: [],
    isActive: true,
    isVirtualFallback: true,
  }

  if (type === 'listening') {
    return {
      ...base,
      title: '5-minute listening practice',
      content: [
        'Open any English listening source you like.',
        'Listen for 5 minutes.',
        'Write down 3 words you hear.',
        'Repeat 1 sentence out loud.',
      ].join('\n'),
      sourceUrls: ['https://www.bbc.co.uk/learningenglish'],
    }
  }

  if (type === 'vocab') {
    return {
      ...base,
      title: 'Basic vocabulary practice',
      content: [
        '- work: something you do as a job or task',
        '- learn: to get knowledge or skill',
        '- practice: to do something repeatedly to improve',
      ].join('\n'),
      wordsCount: 3,
    }
  }

  if (type === 'speaking') {
    return {
      ...base,
      title: 'Simple speaking practice',
      content: 'Speak for 1 minute about what you did today.',
      speakingMinutes: 1,
    }
  }

  if (type === 'writing') {
    return {
      ...base,
      title: 'Simple writing practice',
      content: [
        'Write 3 sentences:',
        '1. Today I...',
        '2. I learned...',
        '3. Tomorrow I will...',
      ].join('\n'),
      writingSentences: 3,
    }
  }

  return {
    ...base,
    title: 'Simple dev English practice',
    content: [
      'I fixed a bug.',
      'I checked the logs.',
      'I tested the app again.',
    ].join('\n'),
    wordsCount: 3,
  }
}
