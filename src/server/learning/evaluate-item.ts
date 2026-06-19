/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Orchestration for POST /api/today/items/:itemId/evaluate (Phase 3,
 * section 7.3-7.4 of docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md).
 *
 * Responsibility of this module: load today's DailyPlan + item, run
 * rule-based scoring (evaluation.ts), upsert the LessonEvaluation record
 * (idempotent on dailyPlanId+itemId, see section 13.1), decide completion
 * by combining tracking-side LearningSession metrics with the evaluation
 * score (completion.ts), and update the DailyPlan item + DailyStats when an
 * item newly completes. The route handler stays thin.
 *
 * Idempotency (section 13.1):
 *   - "Evaluation should update existing record for same dailyPlanId +
 *     itemId" -> findOneAndUpdate with upsert on that unique key, never
 *     create+duplicate.
 *   - "Completed item should not increment stats twice" -> if the item is
 *     already done (isItemDone), we update the evaluation record (so
 *     feedback/score reflect the latest attempt) but do NOT re-set
 *     completedAt and do NOT re-run the completion transition. We still
 *     call recalculateDailyStats for consistency, but since it recomputes
 *     totals from scratch from plan.items (not an $inc), re-running it for
 *     an item that is already 'completed' is naturally idempotent — it does
 *     not double count.
 */
import { connectMongo } from '@/lib/mongoose'
import { getVietnamTodayDate } from '@/lib/date'
import { DailyPlan } from '@/models/DailyPlan'
import { LearningSession } from '@/models/LearningSession'
import { LessonEvaluation } from '@/models/LessonEvaluation'
import { recalculateDailyStats } from '@/server/stats'
import { isItemDone } from '@/server/learning/progress'
import {
  evaluateLesson,
  type EvaluationInput,
  type LessonType,
} from '@/server/learning/evaluation'
import { isCompletionRuleSatisfied } from '@/server/learning/completion'

export class EvaluateItemError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const VALID_LESSON_TYPES: LessonType[] = [
  'listening',
  'vocab',
  'speaking',
  'writing',
  'dev_english',
]

type EvaluateItemInput = {
  itemId: string
  lessonType?: string
  input?: EvaluationInput
}

export async function evaluateItem({
  itemId,
  lessonType: requestedLessonType,
  input,
}: EvaluateItemInput) {
  await connectMongo()

  const today = getVietnamTodayDate()

  const plan = await DailyPlan.findOne({ date: today })

  if (!plan) {
    throw new EvaluateItemError('Today plan not found', 404)
  }

  const item = plan.items.id(itemId)

  if (!item) {
    throw new EvaluateItemError('Daily plan item not found', 404)
  }

  const lessonType = (requestedLessonType ?? item.type) as LessonType

  if (!VALID_LESSON_TYPES.includes(lessonType)) {
    throw new EvaluateItemError('Invalid or missing lessonType', 400)
  }

  const safeInput: EvaluationInput = input ?? {}

  // Run rule-based scoring (no external API calls).
  const { score, rubric, feedback } = evaluateLesson(lessonType, safeInput)
  const passed = score >= 60

  // Pull tracking-side numbers from the LearningSession, NOT from the
  // evaluate request body — the request `input` only supplies content to
  // score (quizAnswers/text/transcript), while completion's "tracking
  // progress is enough" half reads accumulated session metrics.
  const session = await LearningSession.findOne({
    dailyPlanId: plan._id,
    itemId,
  })

  const sessionMetrics = session?.metrics
    ? session.metrics.toObject
      ? session.metrics.toObject()
      : session.metrics
    : {}

  const alreadyDone = isItemDone(item.status)

  const evaluationStatus = passed ? 'evaluated' : 'needs_retry'

  // Idempotent upsert: update existing LessonEvaluation for this
  // dailyPlanId+itemId rather than creating a duplicate.
  const evaluation = await LessonEvaluation.findOneAndUpdate(
    { dailyPlanId: plan._id, itemId },
    {
      $set: {
        dateKey: today,
        dailyPlanId: plan._id,
        itemId,
        lessonId: item.lessonId,
        lessonType,
        status: evaluationStatus,
        score,
        passed,
        rubric,
        answers: safeInput.quizAnswers ?? null,
        userInput: {
          text: safeInput.text ?? null,
          transcript: safeInput.transcript ?? null,
          selectedAnswers: safeInput.selectedAnswers ?? undefined,
        },
        feedback,
      },
    },
    { upsert: true, new: true }
  )

  // Decide completion by combining tracking progress (session metrics) with
  // the evaluation outcome.
  const completionSatisfied = isCompletionRuleSatisfied({
    lessonType,
    score,
    metrics: {
      audioProgressPercent: sessionMetrics.audioProgressPercent,
      practiceCount: sessionMetrics.practiceCount,
      recordedSeconds: sessionMetrics.recordedSeconds,
      speechAttemptCount: sessionMetrics.speechAttemptCount,
    },
  })

  if (!alreadyDone && completionSatisfied) {
    item.status = 'completed'
    item.completedAt = new Date()
    item.progressPercent = 100

    await plan.save()
  }

  // recalculateDailyStats recomputes totals from scratch from plan.items
  // each time (not an $inc), so calling it again for an already-completed
  // item is naturally idempotent and does not double count.
  await recalculateDailyStats(today)

  return {
    evaluation: {
      score: evaluation.score,
      passed: evaluation.passed,
      feedback: {
        summary: evaluation.feedback?.summary,
        strengths: evaluation.feedback?.strengths ?? [],
        improvements: evaluation.feedback?.improvements ?? [],
        ...(evaluation.feedback?.correctedText
          ? { correctedText: evaluation.feedback.correctedText }
          : {}),
      },
    },
    item: {
      status: isItemDone(item.status) ? 'completed' : item.status,
      progressPercent: item.progressPercent ?? 0,
    },
  }
}
