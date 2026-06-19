/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Automatic tracking event processing (Phase 2, section 6.4-6.5 of
 * docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md).
 *
 * Responsibility of this module: given a tracking event for a DailyPlan
 * item, find/create the LearningSession, apply metric deltas, recompute
 * progressPercent, flip DailyPlanItem status pending -> in_progress, and
 * keep DailyStats in sync. The route handler stays thin and only does
 * request parsing / response shaping.
 *
 * Idempotency note (judgment call, see report): activeSecondsDelta is
 * capped at 30s per event before being applied to both the session and
 * DailyStats. This bounds the damage of any single buggy/duplicate/
 * malicious event and keeps repeated identical events from meaningfully
 * inflating stats, but it is not full duplicate-event detection (e.g. an
 * exact replay of a `start` event will not double-count activeSeconds
 * since start carries no delta, but a replayed heartbeat with a delta will
 * add that capped delta again each time it's sent). True idempotency would
 * require a per-event dedupe log (e.g. client-generated event id), which
 * is out of scope for v1 per the task's idempotency design guidance.
 */
import { connectMongo } from '@/lib/mongoose'
import { getVietnamTodayDate } from '@/lib/date'
import { DailyPlan } from '@/models/DailyPlan'
import { DailyStats } from '@/models/DailyStats'
import { LearningSession } from '@/models/LearningSession'
import { recalculateDailyStats } from '@/server/stats'
import { isItemDone } from '@/server/learning/progress'

export const MAX_ACTIVE_SECONDS_DELTA = 30

export type TrackingEventType =
  | 'start'
  | 'heartbeat'
  | 'interaction'
  | 'audio_progress'
  | 'text_change'
  | 'record_progress'
  | 'evaluation'

export type TrackingEventPayload = {
  activeSecondsDelta?: number
  progressPercent?: number

  audioProgressPercent?: number
  currentTime?: number
  duration?: number

  viewedWordCount?: number
  totalWordCount?: number
  practiceCount?: number

  recordedSeconds?: number
  speechAttemptCount?: number

  typedWordCount?: number
  typedCharacterCount?: number
  draftText?: string

  interactionCount?: number
}

export class TrackingError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const EVENT_COUNT_KEY: Record<TrackingEventType, string | null> = {
  start: null,
  heartbeat: 'heartbeat',
  interaction: 'interaction',
  audio_progress: 'audioProgress',
  text_change: 'textChange',
  record_progress: 'record',
  evaluation: 'evaluation',
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/**
 * v1 progressPercent heuristics. These intentionally stay simple/rule-based
 * per the spec; deeper evaluation-aware completion logic is Phase 3.
 */
function computeProgressPercent(
  lessonType: string,
  metrics: Record<string, any>,
  explicitProgressPercent: number | undefined,
  previousProgressPercent: number
): number {
  // An explicit progressPercent from the client (e.g. a view that already
  // knows its own progress) wins, but never moves progress backwards.
  if (typeof explicitProgressPercent === 'number') {
    return clampPercent(
      Math.max(previousProgressPercent, explicitProgressPercent)
    )
  }

  let computed = previousProgressPercent

  switch (lessonType) {
    case 'vocab': {
      const viewed = metrics.viewedWordCount ?? 0
      const total = metrics.totalWordCount ?? 0
      const practice = metrics.practiceCount ?? 0

      const byWords = total > 0 ? (viewed / total) * 100 : 0
      const byPractice = (practice / 5) * 100

      computed = Math.max(byWords, byPractice)
      break
    }
    case 'listening': {
      computed = metrics.audioProgressPercent ?? 0
      break
    }
    case 'speaking': {
      const recordedSeconds = metrics.recordedSeconds ?? 0
      computed = (recordedSeconds / 20) * 100
      break
    }
    case 'writing':
    case 'dev_english': {
      const typedWords = metrics.typedWordCount ?? 0
      // 30 words is a reasonable v1 "enough to evaluate" threshold.
      computed = (typedWords / 30) * 100
      break
    }
    default: {
      computed = previousProgressPercent
    }
  }

  return clampPercent(Math.max(previousProgressPercent, computed))
}

type ProcessTrackingEventInput = {
  itemId: string
  eventType: TrackingEventType
  payload?: TrackingEventPayload
}

export async function processTrackingEvent({
  itemId,
  eventType,
  payload,
}: ProcessTrackingEventInput) {
  await connectMongo()

  const today = getVietnamTodayDate()

  const plan = await DailyPlan.findOne({ date: today })

  if (!plan) {
    throw new TrackingError('Today plan not found', 404)
  }

  const item = plan.items.id(itemId)

  if (!item) {
    throw new TrackingError('Daily plan item not found', 404)
  }

  const now = new Date()
  const safePayload = payload ?? {}

  // Cap activeSecondsDelta server-side regardless of what the client sends.
  const rawDelta = safePayload.activeSecondsDelta ?? 0
  const activeSecondsDelta = Math.max(
    0,
    Math.min(MAX_ACTIVE_SECONDS_DELTA, rawDelta)
  )

  // 1-2. Plan + item already found above.
  // 3. Create/get LearningSession (unique on dailyPlanId+itemId).
  const eventCountKey = EVENT_COUNT_KEY[eventType]

  const upsertUpdate: Record<string, any> = {
    $set: {
      dateKey: today,
      dailyPlanId: plan._id,
      itemId,
      lessonId: item.lessonId,
      lessonType: item.type,
      lastActiveAt: now,
    },
    $setOnInsert: {
      startedAt: now,
      status: 'active',
      activeSeconds: 0,
      progressPercent: 0,
    },
  }

  if (eventCountKey) {
    upsertUpdate.$inc = { [`eventCounts.${eventCountKey}`]: 1 }
  }

  let session = await LearningSession.findOneAndUpdate(
    { dailyPlanId: plan._id, itemId },
    upsertUpdate,
    { upsert: true, new: true }
  )

  // 4. pending -> in_progress on start/interaction (also covers any event
  // arriving for a pending item, since reaching this endpoint at all means
  // the learner is engaging with the item).
  if (item.status === 'pending') {
    item.status = 'in_progress'
    item.startedAt = item.startedAt ?? now
  }

  // 5. Update metrics from payload (only overwrite fields that were sent).
  const metricFields: Array<keyof TrackingEventPayload> = [
    'audioProgressPercent',
    'viewedWordCount',
    'totalWordCount',
    'practiceCount',
    'recordedSeconds',
    'speechAttemptCount',
    'typedWordCount',
    'typedCharacterCount',
    'interactionCount',
  ]

  const metricsUpdate: Record<string, any> = {}

  for (const field of metricFields) {
    const value = safePayload[field]
    if (typeof value === 'number') {
      metricsUpdate[field] = value
    }
  }

  const mergedMetrics = {
    ...(session.metrics?.toObject ? session.metrics.toObject() : session.metrics ?? {}),
    ...metricsUpdate,
  }

  // 6. Recalculate progressPercent.
  const nextProgressPercent = computeProgressPercent(
    item.type,
    mergedMetrics,
    safePayload.progressPercent,
    session.progressPercent ?? 0
  )

  const nextActiveSeconds = (session.activeSeconds ?? 0) + activeSecondsDelta

  const sessionUpdate: Record<string, any> = {
    $set: {
      metrics: mergedMetrics,
      progressPercent: nextProgressPercent,
      activeSeconds: nextActiveSeconds,
      lastActiveAt: now,
    },
  }

  // Evaluation completion itself is decided by Phase 3; tracking only
  // records that an evaluation event happened (eventCounts above).

  session = await LearningSession.findOneAndUpdate(
    { _id: session._id },
    sessionUpdate,
    { new: true }
  )

  // Mirror session activeSeconds/progressPercent onto the DailyPlan item so
  // /today and /learn can render without joining LearningSession.
  item.activeSeconds = (item.activeSeconds ?? 0) + activeSecondsDelta
  item.progressPercent = Math.max(
    item.progressPercent ?? 0,
    nextProgressPercent
  )

  await plan.save()

  // 7. Update DailyStats. recalculateDailyStats derives minutesSpent from
  // completed items' estimatedMinutes (existing convention), which this
  // event does not change unless the item just completed elsewhere. We
  // still call it so totalItems/doneItems/pendingItems stay consistent if
  // the in_progress transition just happened.
  await recalculateDailyStats(today)

  const stats = await DailyStats.findOne({ date: today })

  return {
    item: serializeTrackedItem(item),
    session: serializeTrackedSession(session),
    stats: stats
      ? {
          date: stats.date,
          totalItems: stats.totalItems,
          doneItems: stats.doneItems,
          skippedItems: stats.skippedItems,
          pendingItems: stats.pendingItems,
          minutesSpent: stats.minutesSpent,
        }
      : null,
  }
}

function serializeTrackedItem(item: any) {
  return {
    id: item._id.toString(),
    status: isItemDone(item.status) ? 'completed' : item.status,
    startedAt: item.startedAt ? item.startedAt.toISOString() : null,
    completedAt: item.completedAt ? item.completedAt.toISOString() : null,
    skippedAt: item.skippedAt ? item.skippedAt.toISOString() : null,
    activeSeconds: item.activeSeconds ?? 0,
    progressPercent: item.progressPercent ?? 0,
  }
}

function serializeTrackedSession(session: any) {
  return {
    id: session._id.toString(),
    dateKey: session.dateKey,
    dailyPlanId: session.dailyPlanId.toString(),
    itemId: session.itemId,
    lessonId: session.lessonId.toString(),
    lessonType: session.lessonType,
    status: session.status,
    startedAt: session.startedAt ? session.startedAt.toISOString() : null,
    lastActiveAt: session.lastActiveAt
      ? session.lastActiveAt.toISOString()
      : null,
    completedAt: session.completedAt
      ? session.completedAt.toISOString()
      : null,
    activeSeconds: session.activeSeconds ?? 0,
    progressPercent: session.progressPercent ?? 0,
    eventCounts: session.eventCounts
      ? session.eventCounts.toObject
        ? session.eventCounts.toObject()
        : session.eventCounts
      : {},
    metrics: session.metrics
      ? session.metrics.toObject
        ? session.metrics.toObject()
        : session.metrics
      : {},
  }
}

export const VALID_EVENT_TYPES: TrackingEventType[] = [
  'start',
  'heartbeat',
  'interaction',
  'audio_progress',
  'text_change',
  'record_progress',
  'evaluation',
]
