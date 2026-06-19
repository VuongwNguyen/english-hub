/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectMongo } from '@/lib/mongoose'
import { getDateRangeForLastDays } from '@/lib/date'
import { DailyPlan } from '@/models/DailyPlan'
import { Lesson } from '@/models/Lesson'
import { recalculateDailyStats } from '@/server/stats'
import { createVirtualFallbackLesson } from '@/server/external/generate-lessons-from-cache'
import {
  computePersonalizationSignal,
  type PersonalizationSignal,
} from '@/server/learning/personalization'
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
 * Personalization-aware ranking applied ON TOP OF the existing
 * useCount/qualityScore/lastUsedAt sort, within the top-20 fresh
 * candidates shortlist (section 9.6-9.7).
 *
 * This never changes WHICH 5 types get an item (always all 5 — see
 * getOrCreateTodayPlan), it only re-ranks candidates *within* one type's
 * shortlist:
 *   1. Lessons whose id is in a weak-skill's recentFailedLessonIds, or with
 *      higher reviewPriority, are preferred (section 9.7: "increase
 *      reviewPriority... future plan should include similar practice").
 *   2. When there's enough evaluation history for this type
 *      (averageScoreByType has a sample), prefer difficultyScore closer to
 *      a target derived from recent performance: low average score ->
 *      prefer easier lessons (lower difficultyScore); high average score
 *      -> prefer harder lessons (higher difficultyScore).
 *
 * When `signal.hasData` is false (fresh DB / no history yet), this
 * function is not consulted at all by pickLesson — callers must check
 * that first so behavior is byte-for-byte identical to the pre-Task-11
 * implementation for new users.
 */
function rankCandidatesWithPersonalization(
  candidates: any[],
  type: string,
  signal: PersonalizationSignal
): any[] {
  const weakSkill = signal.weakSkills.find((skill) => skill.lessonType === type)
  const averageScore = signal.averageScoreByType[type as keyof typeof signal.averageScoreByType]

  // Target difficulty: map recent average score (0-100) to a desired
  // difficultyScore (0-100). Low performance -> easier content; high
  // performance -> harder content. 50/50 maps to mid-range difficulty.
  const targetDifficulty =
    typeof averageScore === 'number' ? averageScore : null

  const failedIds = new Set(weakSkill?.recentFailedLessonIds ?? [])

  function candidateScore(lesson: any): number {
    let score = 0

    if (failedIds.has(lesson._id?.toString())) {
      score += 1000
    }

    score += (lesson.reviewPriority ?? 0) * 10

    if (targetDifficulty !== null) {
      const difficultyScore = lesson.difficultyScore ?? 50
      const distance = Math.abs(difficultyScore - targetDifficulty)
      // Closer distance -> higher score. Max distance is 100.
      score += (100 - distance) / 10
    }

    return score
  }

  return [...candidates].sort((a, b) => candidateScore(b) - candidateScore(a))
}

/**
 * Lesson rotation fallback chain:
 * 1. Prefer active lessons not used in last 7 days, avoiding the topicGroups
 *    used in the last 3 recent plans, ordered by least-used/highest-quality
 *    first, then pick a uniformly random lesson from that shortlist.
 *    When personalization data is available (section 9.6-9.7), the
 *    shortlist is re-ranked first (weak-skill/reviewPriority/difficulty
 *    match) and the pick is biased toward the top of that re-ranked list
 *    instead of being uniformly random across all 20.
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
  recentTopicGroups: string[],
  personalizationSignal?: PersonalizationSignal
) {
  const validExcludeIds = excludeIds.filter((id) => Types.ObjectId.isValid(id))

  const baseQuery = {
    type,
    isActive: true,
    _id: {
      $nin: validExcludeIds.map((id) => new Types.ObjectId(id)),
    },
    topicGroup: { $nin: recentTopicGroups.slice(0, 3) },
  }

  const freshCandidates = await Lesson.find(baseQuery)
    .sort({ useCount: 1, qualityScore: -1, lastUsedAt: 1 })
    .limit(20)
    .lean()

  if (freshCandidates.length > 0) {
    // Graceful fallback: with no personalization history at all, behavior
    // is identical to before Task 11 — uniformly random pick from the
    // top-20 useCount/qualityScore/lastUsedAt shortlist.
    if (!personalizationSignal?.hasData) {
      return randomPick(freshCandidates)
    }

    // With personalization data, the useCount/qualityScore-sorted top-20
    // above may not contain any lesson with elevated reviewPriority (e.g.
    // a popular lesson type with hundreds of candidates). Separately fetch
    // a small reviewPriority-sorted slice and merge it in so weak-skill /
    // failed-retry lessons get a real chance to be re-ranked to the top,
    // not just lessons that happened to already have low useCount.
    let candidatePool = freshCandidates
    const hasReviewPriorityInPool = freshCandidates.some(
      (lesson: any) => (lesson.reviewPriority ?? 0) > 0
    )

    if (!hasReviewPriorityInPool) {
      const priorityCandidates = await Lesson.find({
        ...baseQuery,
        reviewPriority: { $gt: 0 },
      })
        .sort({ reviewPriority: -1, qualityScore: -1 })
        .limit(5)
        .lean()

      if (priorityCandidates.length > 0) {
        const seenIds = new Set(
          freshCandidates.map((lesson: any) => lesson._id.toString())
        )
        candidatePool = [
          ...freshCandidates,
          ...priorityCandidates.filter(
            (lesson: any) => !seenIds.has(lesson._id.toString())
          ),
        ]
      }
    }

    // Re-rank the merged shortlist and bias the random pick toward its top
    // (rather than a hard top-1 pick) so there is still variety day to
    // day, but weak-skill/quality/difficulty matches are favored.
    const ranked = rankCandidatesWithPersonalization(
      candidatePool,
      type,
      personalizationSignal
    )
    const topSlice = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 3)))
    return randomPick(topSlice)
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

/**
 * Increments reviewPriority on a Lesson after a failed evaluation
 * (section 9.7: "increase reviewPriority for related lesson/topic/skill").
 *
 * Lives in rotation.ts (rather than evaluate-item.ts) because reviewPriority
 * is purely a rotation-selection concern — evaluate-item.ts's job is
 * scoring/completion, and rotation.ts is the only module that reads
 * reviewPriority back out (via rankCandidatesWithPersonalization above).
 * Keeping the write next to the read keeps the "what does reviewPriority
 * mean and who touches it" surface in one file. evaluate-item.ts calls this
 * as a small, explicit side effect after persisting the LessonEvaluation.
 *
 * Safe to call for virtual fallback lessons too — lessonId in that case is
 * a throwaway ObjectId that doesn't match any real Lesson document, so the
 * update simply matches zero documents.
 */
export async function bumpLessonReviewPriority(lessonId: unknown) {
  if (!lessonId) return

  await connectMongo()

  await Lesson.updateOne(
    { _id: lessonId },
    { $inc: { reviewPriority: 1 } }
  )
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

  // Personalization (section 9.5-9.7): computed once per plan generation.
  // computePersonalizationSignal returns hasData: false when there isn't
  // enough evaluation/plan history yet, in which case pickLesson takes the
  // exact same code path as before Task 11 (uniform random pick from the
  // top-20 shortlist) — this is the graceful fallback for fresh DBs / new
  // users required by the task.
  const personalizationSignal = await computePersonalizationSignal(date)

  const selectedLessons = []

  for (const type of DAILY_TYPES) {
    const lesson = await pickLesson(
      type,
      recentLessonIds,
      recentTopicGroups,
      personalizationSignal
    )
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
