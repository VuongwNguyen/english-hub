import { connectMongo } from '@/lib/mongoose'
import { Lesson } from '@/models/Lesson'
import { computeQualityScore } from '@/server/learning/quality'
import { computeDifficultyScore } from '@/server/learning/difficulty'

// Mirrors `toSlug()` in src/server/backfill-lesson-slugs.ts (which itself
// mirrors the not-yet-created `toSlug()` from src/server/external/normalize.ts,
// introduced in Task B3). Kept as a local helper here so seed.ts has no
// dependency on that module until it exists.
function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function withSlug<T extends { type: string; title: string }>(lesson: T): T & { slug: string } {
  return { ...lesson, slug: toSlug(`${lesson.type}-${lesson.title}`) }
}

const lessons = [
  {
    title: 'Debugging phrases',
    topic: 'dev',
    level: 'A2',
    type: 'vocab',
    content: [
      'The app keeps crashing.',
      'I need to check the logs.',
      'The API returned the wrong data.',
      'I fixed the bug.',
      'I will test it again.',
    ].join('\n'),
    estimatedMinutes: 5,
    wordsCount: 5,
  },
  {
    title: 'Talk about a bug',
    topic: 'dev',
    level: 'A2',
    type: 'speaking',
    content: 'Talk for 1 minute: What bug did you fix today?',
    estimatedMinutes: 5,
    speakingMinutes: 1,
  },
  {
    title: 'Write about your workday',
    topic: 'work',
    level: 'A2',
    type: 'writing',
    content: [
      'Write 3 sentences:',
      '1. Today I worked on...',
      '2. I had a problem with...',
      '3. Tomorrow I will...',
    ].join('\n'),
    estimatedMinutes: 5,
    writingSentences: 3,
  },
  {
    title: 'BBC Learning English short listening',
    topic: 'listening',
    level: 'A2',
    type: 'listening',
    content: 'Open the listening source and listen for 5 minutes. Write down one sentence you understand.',
    sourceUrl: 'https://www.bbc.co.uk/learningenglish',
    estimatedMinutes: 5,
  },
  {
    title: 'API error phrases',
    topic: 'dev',
    level: 'A2',
    type: 'dev_english',
    content: [
      'The request failed.',
      'The server returned an error.',
      'The response is empty.',
      'I need to retry the request.',
      'The endpoint is not working.',
    ].join('\n'),
    estimatedMinutes: 5,
    wordsCount: 5,
  },
].map(withSlug)

export async function seedLessons() {
  await connectMongo()

  const count = await Lesson.countDocuments()

  if (count > 0) {
    return {
      inserted: 0,
      skipped: true,
      reason: 'Lessons already exist',
    }
  }

  const generatedLessons = generateLessons().map((lesson) => ({
    ...lesson,
    qualityScore: computeQualityScore(lesson),
    difficultyScore: computeDifficultyScore(lesson),
  }))

  await Lesson.insertMany(generatedLessons)

  return {
    inserted: generatedLessons.length,
    skipped: false,
  }
}

function generateLessons() {
  const listening = Array.from({ length: 20 }).map((_, index) => ({
    title: `Listening Practice ${index + 1}`,
    topic: index % 2 === 0 ? 'daily' : 'work',
    level: 'A2',
    type: 'listening',
    content:
      'Listen for 5 minutes. Write down one phrase you can understand. Do not worry about understanding everything.',
    sourceUrl:
      index % 2 === 0
        ? 'https://www.bbc.co.uk/learningenglish'
        : 'https://learningenglish.voanews.com/',
    estimatedMinutes: 5,
    wordsCount: 0,
    speakingMinutes: 0,
    writingSentences: 0,
    isActive: true,
  })).map(withSlug)

  const vocabTopics = [
    'debugging',
    'daily life',
    'meetings',
    'API',
    'deployment',
    'testing',
    'planning',
    'errors',
    'communication',
    'work',
  ]

  const vocab = Array.from({ length: 20 }).map((_, index) => ({
    title: `Vocabulary Pack ${index + 1}`,
    topic: vocabTopics[index % vocabTopics.length],
    level: 'A2',
    type: 'vocab',
    content: [
      'I need to check this.',
      'This issue is annoying.',
      'Let me try again.',
      'The result looks wrong.',
      'I found the problem.',
    ].join('\n'),
    estimatedMinutes: 5,
    wordsCount: 5,
    speakingMinutes: 0,
    writingSentences: 0,
    isActive: true,
  })).map(withSlug)

  const speaking = Array.from({ length: 20 }).map((_, index) => ({
    title: `Speaking Prompt ${index + 1}`,
    topic: index % 2 === 0 ? 'work' : 'daily',
    level: 'A2',
    type: 'speaking',
    content:
      'Speak for 1 minute. Use simple sentences. Topic: What did you do today?',
    estimatedMinutes: 5,
    wordsCount: 0,
    speakingMinutes: 1,
    writingSentences: 0,
    isActive: true,
  })).map(withSlug)

  const writing = Array.from({ length: 20 }).map((_, index) => ({
    title: `Writing Prompt ${index + 1}`,
    topic: index % 2 === 0 ? 'journal' : 'work',
    level: 'A2',
    type: 'writing',
    content: [
      'Write 3 simple sentences:',
      '1. Today I...',
      '2. I had a problem with...',
      '3. Tomorrow I will...',
    ].join('\n'),
    estimatedMinutes: 5,
    wordsCount: 0,
    speakingMinutes: 0,
    writingSentences: 3,
    isActive: true,
  })).map(withSlug)

  const devEnglish = Array.from({ length: 20 }).map((_, index) => ({
    title: `Dev English ${index + 1}`,
    topic: ['debugging', 'API', 'deploy', 'testing'][index % 4],
    level: 'A2',
    type: 'dev_english',
    content: [
      'I am debugging the login flow.',
      'The API response is incorrect.',
      'I need to check the server logs.',
      'The app works on my machine.',
      'I will test it again before release.',
    ].join('\n'),
    estimatedMinutes: 5,
    wordsCount: 5,
    speakingMinutes: 0,
    writingSentences: 0,
    isActive: true,
  })).map(withSlug)

  return [...lessons, ...listening, ...vocab, ...speaking, ...writing, ...devEnglish]
}
