/**
 * Personalization signal computation (Phase 5, section 9.5 of
 * docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md).
 *
 * This app has no real multi-user concept: DailyPlan is keyed only by
 * `date` (one global plan per day, see src/models/DailyPlan.ts), and
 * LearningSession/LessonEvaluation's optional userId/anonymousId fields are
 * never populated by any existing write path (checked
 * src/server/learning/evaluate-item.ts and tracking.ts — neither sets
 * them). So "personalization" here means "personalization for this single
 * app's history," not per-account — there is exactly one global signal,
 * not one per user. If multi-user support is added later, the queries
 * below are the natural place to add a userId/anonymousId filter.
 *
 * Signals considered per lessonType (one of listening/vocab/speaking/
 * writing/dev_english), over the last LOOKBACK_DAYS days:
 *   - low average evaluation score (LessonEvaluation.score)
 *   - often skipped (DailyPlan item status === 'skipped')
 *   - low completion rate (DailyPlan item status !== 'completed'/'done')
 *   - recently failed evaluation (LessonEvaluation.status === 'needs_retry'
 *     or passed === false), which also flags `needsRetry: true`
 *
 * Returns an empty list (graceful no-op) when there is not enough history
 * yet — this is what keeps fresh-DB / new-user rotation behavior
 * unchanged, per the task's non-negotiable fallback requirement.
 */
import { connectMongo } from '@/lib/mongoose'
import { getDateRangeForLastDays } from '@/lib/date'
import { DailyPlan } from '@/models/DailyPlan'
import { LessonEvaluation } from '@/models/LessonEvaluation'

export type LessonType =
  | 'listening'
  | 'vocab'
  | 'speaking'
  | 'writing'
  | 'dev_english'

export type WeakSkillSignal = {
  lessonType: LessonType
  /** 0-100, higher means weaker (more in need of review). */
  weaknessScore: number
  averageScore: number | null
  skipRate: number | null
  completionRate: number | null
  needsRetry: boolean
  /** Lesson ids from recent failed evaluations for this type, most recent first. */
  recentFailedLessonIds: string[]
}

export type PersonalizationSignal = {
  /** True when there was enough history to compute anything meaningful. */
  hasData: boolean
  /** Weak skills ranked from weakest to least-weak. Empty when !hasData. */
  weakSkills: WeakSkillSignal[]
  /**
   * Average recent evaluation score per lesson type, used by rotation to
   * bias difficultyScore selection. Only includes types with enough
   * evaluation samples.
   */
  averageScoreByType: Partial<Record<LessonType, number>>
}

const LOOKBACK_DAYS = 14
const MIN_EVALUATIONS_FOR_SIGNAL = 3
const MIN_PLAN_ITEMS_FOR_SIGNAL = 3

// Treat as "weak" once weaknessScore crosses this floor — keeps very mild
// signal from constantly nudging rotation around for users who are doing
// fine overall.
const WEAKNESS_THRESHOLD = 35

function isDone(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'done'
}

/**
 * Computes weak-skill / performance signal from recent app history.
 *
 * Looks at LessonEvaluation and DailyPlan records from the last
 * LOOKBACK_DAYS days (exclusive of `today`, matching the convention used by
 * src/server/rotation.ts's getRecentLessonIds/getRecentTopicGroups).
 *
 * Pure read — does not mutate anything. Callers (rotation.ts) decide what
 * to do with the result.
 */
export async function computePersonalizationSignal(
  today: string
): Promise<PersonalizationSignal> {
  await connectMongo()

  const range = getDateRangeForLastDays(today, LOOKBACK_DAYS)

  const [evaluations, recentPlans] = await Promise.all([
    LessonEvaluation.find({
      dateKey: { $gte: range.from, $lt: today },
    }).lean(),
    DailyPlan.find({
      date: { $gte: range.from, $lt: today },
    }).lean(),
  ])

  if (
    evaluations.length < MIN_EVALUATIONS_FOR_SIGNAL &&
    recentPlans.length === 0
  ) {
    return { hasData: false, weakSkills: [], averageScoreByType: {} }
  }

  const byType = new Map<
    LessonType,
    {
      scores: number[]
      failedLessonIds: string[]
      totalItems: number
      skippedItems: number
      completedItems: number
    }
  >()

  function bucket(type: string) {
    const key = type as LessonType
    if (!byType.has(key)) {
      byType.set(key, {
        scores: [],
        failedLessonIds: [],
        totalItems: 0,
        skippedItems: 0,
        completedItems: 0,
      })
    }
    return byType.get(key)!
  }

  for (const evaluation of evaluations) {
    const entry = bucket(evaluation.lessonType)
    entry.scores.push(evaluation.score ?? 0)

    const failed =
      evaluation.status === 'needs_retry' || evaluation.passed === false

    if (failed && evaluation.lessonId) {
      entry.failedLessonIds.push(evaluation.lessonId.toString())
    }
  }

  for (const plan of recentPlans) {
    for (const item of plan.items ?? []) {
      const entry = bucket(item.type)
      entry.totalItems += 1

      if (item.status === 'skipped') {
        entry.skippedItems += 1
      } else if (isDone(item.status)) {
        entry.completedItems += 1
      }
    }
  }

  const averageScoreByType: Partial<Record<LessonType, number>> = {}
  const weakSkills: WeakSkillSignal[] = []

  for (const [lessonType, entry] of byType.entries()) {
    const averageScore =
      entry.scores.length > 0
        ? entry.scores.reduce((sum, score) => sum + score, 0) /
          entry.scores.length
        : null

    if (averageScore !== null && entry.scores.length >= MIN_EVALUATIONS_FOR_SIGNAL) {
      averageScoreByType[lessonType] = averageScore
    }

    const skipRate =
      entry.totalItems > 0 ? entry.skippedItems / entry.totalItems : null
    const completionRate =
      entry.totalItems > 0 ? entry.completedItems / entry.totalItems : null

    const hasEnoughSignal =
      entry.scores.length >= MIN_EVALUATIONS_FOR_SIGNAL ||
      entry.totalItems >= MIN_PLAN_ITEMS_FOR_SIGNAL

    if (!hasEnoughSignal) continue

    // Weakness score: blends low average score, high skip rate, low
    // completion rate, and recent failures into a single 0-100 metric
    // (higher = weaker). Each component is optional (some may have no
    // data), so we average over whichever components are available.
    const components: number[] = []

    if (averageScore !== null) {
      components.push(Math.max(0, 100 - averageScore))
    }
    if (skipRate !== null) {
      components.push(skipRate * 100)
    }
    if (completionRate !== null) {
      components.push((1 - completionRate) * 100)
    }
    if (entry.failedLessonIds.length > 0) {
      components.push(100)
    }

    if (components.length === 0) continue

    const weaknessScore =
      components.reduce((sum, value) => sum + value, 0) / components.length

    if (weaknessScore < WEAKNESS_THRESHOLD) continue

    weakSkills.push({
      lessonType,
      weaknessScore,
      averageScore,
      skipRate,
      completionRate,
      needsRetry: entry.failedLessonIds.length > 0,
      recentFailedLessonIds: entry.failedLessonIds,
    })
  }

  weakSkills.sort((a, b) => b.weaknessScore - a.weaknessScore)

  return {
    hasData: weakSkills.length > 0 || Object.keys(averageScoreByType).length > 0,
    weakSkills,
    averageScoreByType,
  }
}
