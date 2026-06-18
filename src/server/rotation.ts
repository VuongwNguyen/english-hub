/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectMongo } from '@/lib/mongoose'
import { getDateRangeForLastDays } from '@/lib/date'
import { DailyPlan } from '@/models/DailyPlan'
import { Lesson } from '@/models/Lesson'
import { recalculateDailyStats } from '@/server/stats'
import { createVirtualFallbackLesson } from '@/server/external/generate-lessons-from-cache'
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

async function getRecentTopicGroups(today: string, days = 7) {
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

  const validIds = Array.from(ids).filter((id) => Types.ObjectId.isValid(id))

  const lessons = await Lesson.find(
    { _id: { $in: validIds.map((id) => new Types.ObjectId(id)) } },
    { topicGroup: 1 }
  ).lean()

  const topicGroups = new Set<string>()

  for (const lesson of lessons) {
    if (lesson.topicGroup) {
      topicGroups.add(lesson.topicGroup)
    }
  }

  return Array.from(topicGroups)
}

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

/**
 * Lesson rotation fallback chain:
 * 1. Prefer active lessons not used in last 7 days, avoiding the topicGroups
 *    used in the last 3 recent plans, ordered by least-used/highest-quality
 *    first, then pick a uniformly random lesson from that shortlist.
 * 2. If no fresh lesson exists, pick active lesson with lowest useCount
 *    and oldest lastUsedAt/createdAt (topicGroup is NOT filtered here —
 *    diversity is a soft preference, not a hard requirement, and this
 *    escape valve's job is to always return something).
 * 3. If no lesson exists at all for a type, use the virtual built-in
 *    fallback (never persisted as a real Lesson document).
 *
 * Note: excludeIds may contain ids of virtual fallback lessons that were
 * embedded into a past DailyPlan snapshot (e.g. "virtual-listening-...").
 * Those are not valid ObjectId strings, so they must be filtered out
 * before being used in a `$nin: [...new Types.ObjectId(id)]` match —
 * otherwise `new Types.ObjectId(id)` throws. Excluding them from the
 * "recently used" set is also semantically correct: a virtual fallback
 * was never really "used up" from the real lesson pool.
 */
async function pickLesson(
  type: string,
  excludeIds: string[],
  recentTopicGroups: string[]
) {
  const validExcludeIds = excludeIds.filter((id) => Types.ObjectId.isValid(id))

  const freshCandidates = await Lesson.find({
    type,
    isActive: true,
    _id: {
      $nin: validExcludeIds.map((id) => new Types.ObjectId(id)),
    },
    topicGroup: { $nin: recentTopicGroups.slice(0, 3) },
  })
    .sort({ useCount: 1, qualityScore: -1, lastUsedAt: 1 })
    .limit(20)
    .lean()

  if (freshCandidates.length > 0) {
    return randomPick(freshCandidates)
  }

  const leastUsed = await Lesson.findOne({
    type,
    isActive: true,
  })
    .sort({
      useCount: 1,
      qualityScore: -1,
      lastUsedAt: 1,
      createdAt: 1,
    })
    .lean()

  if (leastUsed) {
    return leastUsed
  }

  return createVirtualFallbackLesson(type)
}

/**
 * Builds the DailyPlanItem snapshot for a selected lesson.
 *
 * Virtual fallback lessons (see createVirtualFallbackLesson) have a
 * STRING `_id` like "virtual-listening-1750000000000" — not a valid
 * ObjectId. DailyPlanItemSchema.lessonId is typed as Schema.Types.ObjectId
 * (required), so persisting that string directly would fail Mongoose
 * validation. Rather than relaxing the schema (which would weaken typing
 * for the common/real-lesson case), we generate a fresh throwaway
 * ObjectId for virtual lessons. It intentionally doesn't reference any
 * real Lesson document — this is an emergency-only path expected to be
 * rare/never hit given the size of the real lesson pool — and the
 * virtual nature stays inspectable via sourceUrl/content/title, which
 * are copied through unchanged.
 */
function snapshotLesson(lesson: any) {
  return {
    lessonId: lesson.isVirtualFallback ? new Types.ObjectId() : lesson._id,
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
  const recentTopicGroups = await getRecentTopicGroups(date, 7)

  const selectedLessons = []

  for (const type of DAILY_TYPES) {
    const lesson = await pickLesson(type, recentLessonIds, recentTopicGroups)
    selectedLessons.push(lesson)
  }

  const theme = pickThemeFromLessons(selectedLessons)

  try {
    const plan = await DailyPlan.create({
      date,
      theme,
      items: selectedLessons.map(snapshotLesson),
    })

    // Only update usage tracking for real database lessons. Virtual
    // fallback lessons (isVirtualFallback: true) are never persisted to
    // the Lesson collection, so there is nothing to update for them.
    const realLessonIds = selectedLessons
      .filter((lesson) => !lesson.isVirtualFallback)
      .map((lesson) => lesson._id)

    if (realLessonIds.length > 0) {
      await Lesson.updateMany(
        { _id: { $in: realLessonIds } },
        {
          $inc: { useCount: 1 },
          $set: {
            lastUsedAt: new Date(),
            lastUsedDate: date,
          },
        }
      )
    }

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
