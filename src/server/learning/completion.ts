/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Completion-rule logic (Phase 3, section 7.4 of
 * docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md).
 *
 * "Item should be completed when: tracking progress is enough AND
 * evaluation passes" (section 6 philosophy). This module combines:
 *   - tracking-side numbers, read from the item's LearningSession.metrics
 *     (accumulated via Task 2's tracking/event route) — e.g. listening's
 *     audioProgressPercent, vocab's practiceCount, speaking's
 *     recordedSeconds/speechAttemptCount.
 *   - the evaluation-side score, computed by evaluation.ts from the
 *     evaluate request's `input`.
 *
 * v1 rules (section 7.4), exactly:
 *   Listening:    audioProgressPercent >= 75 AND quiz score >= 60
 *   Vocab:        practiceCount >= 5 OR quiz score >= 60
 *   Speaking:     recordedSeconds >= 20 OR speechAttemptCount >= 2
 *                 (transcript keyword check is a feedback bonus only, not a
 *                 hard requirement, per section 8.4)
 *   Writing:      score >= 60
 *   Dev English:  score >= 60
 */

import type { LessonType } from '@/server/learning/evaluation'

export type SessionMetricsForCompletion = {
  audioProgressPercent?: number | null
  practiceCount?: number | null
  recordedSeconds?: number | null
  speechAttemptCount?: number | null
}

export type CompletionDecisionInput = {
  lessonType: LessonType
  score: number
  metrics: SessionMetricsForCompletion
}

export function isCompletionRuleSatisfied({
  lessonType,
  score,
  metrics,
}: CompletionDecisionInput): boolean {
  const passedEvaluation = score >= 60

  switch (lessonType) {
    case 'listening': {
      const audioProgressPercent = metrics.audioProgressPercent ?? 0
      return audioProgressPercent >= 75 && passedEvaluation
    }
    case 'vocab': {
      const practiceCount = metrics.practiceCount ?? 0
      return practiceCount >= 5 || passedEvaluation
    }
    case 'speaking': {
      const recordedSeconds = metrics.recordedSeconds ?? 0
      const speechAttemptCount = metrics.speechAttemptCount ?? 0
      return recordedSeconds >= 20 || speechAttemptCount >= 2
    }
    case 'writing':
    case 'dev_english':
      return passedEvaluation
    default:
      return passedEvaluation
  }
}
