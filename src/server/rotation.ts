/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectMongo } from '@/lib/mongoose'
import { getDateRangeForLastDays } from '@/lib/date'
import { DailyPlan } from '@/models/DailyPlan'
import { Lesson } from '@/models/Lesson'
import { recalculateDailyStats } from '@/server/stats'
import { Types } from 'mongoose'

const DAILY_TYPES = [
  'listening',
  'vocab',
  'speaking',
  'writing',
  'dev_english',
] as const

async function getRecentLessonIds(today: string, days = 7) {
  const range = getDateRangeForLastDays(today, days)

  const recentPlans = await DailyPlan.find({
    date: {
      $gte: range.from,
      $lt: today,
    },
  }).lean()

  const ids = new Set<string>()

  for (const plan of recentPlans) {
    for (const item of plan.items ?? []) {
      if (item.lessonId) {
        ids.add(item.lessonId.toString())
      }
    }
  }

  return Array.from(ids)
}

async function pickLesson(type: string, excludeIds: string[]) {
  const freshCandidates = await Lesson.aggregate([
    {
      $match: {
        type,
        isActive: true,
        _id: {
          $nin: excludeIds.map((id) => new Types.ObjectId(id)),
        },
      },
    },
    { $sample: { size: 1 } },
  ])

  if (freshCandidates[0]) {
    return freshCandidates[0]
  }

  const fallbackCandidates = await Lesson.aggregate([
    {
      $match: {
        type,
        isActive: true,
      },
    },
    { $sample: { size: 1 } },
  ])

  if (!fallbackCandidates[0]) {
    throw new Error(`No active lesson found for type: ${type}`)
  }

  return fallbackCandidates[0]
}

function snapshotLesson(lesson: any) {
  return {
    lessonId: lesson._id,
    type: lesson.type,
    title: lesson.title,
    content: lesson.content,
    sourceUrl: lesson.sourceUrl ?? null,
    estimatedMinutes: lesson.estimatedMinutes ?? 5,
    wordsCount: lesson.wordsCount ?? 0,
    speakingMinutes: lesson.speakingMinutes ?? 0,
    writingSentences: lesson.writingSentences ?? 0,
    status: 'pending',
    completedAt: null,
  }
}

function pickThemeFromLessons(lessons: any[]) {
  const topicCount = new Map<string, number>()

  for (const lesson of lessons) {
    const topic = lesson.topic || 'Daily English'
    topicCount.set(topic, (topicCount.get(topic) || 0) + 1)
  }

  const sorted = Array.from(topicCount.entries()).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] ?? 'Daily English'
}

export async function getOrCreateTodayPlan(date: string) {
  await connectMongo()

  const existingPlan = await DailyPlan.findOne({ date })

  if (existingPlan) {
    return existingPlan
  }

  const recentLessonIds = await getRecentLessonIds(date, 7)

  const selectedLessons = []

  for (const type of DAILY_TYPES) {
    const lesson = await pickLesson(type, recentLessonIds)
    selectedLessons.push(lesson)
  }

  const theme = pickThemeFromLessons(selectedLessons)

  try {
    const plan = await DailyPlan.create({
      date,
      theme,
      items: selectedLessons.map(snapshotLesson),
    })

    await recalculateDailyStats(date)

    return plan
  } catch (error: any) {
    if (error.code === 11000) {
      const plan = await DailyPlan.findOne({ date })
      if (plan) return plan
    }

    throw error
  }
}
