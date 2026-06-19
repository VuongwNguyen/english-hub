import type { DailyPlanItemDTO } from '@/types/english'
import type { EvaluationFeedbackDTO } from './EvaluationFeedbackPanel'

/**
 * Shared lesson view contract (docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md
 * section 10.1). Names are adapted to this codebase's existing
 * DailyPlanItemDTO / tracking+evaluate API shapes rather than the spec's
 * illustrative `DailyPlanItem` / `Lesson` / `LearningSession` model types,
 * per the spec's own "Adapt names to existing code" note:
 *
 * - `item` is the DailyPlanItemDTO (title/content/type/status/progress all
 *   live directly on it already — there is no separate `Lesson` DTO exposed
 *   to the client today, so `lesson` is omitted; `item.content` /
 *   `item.title` stand in for it).
 * - `session` is omitted from the props passed down to each per-type view
 *   for this task's stub-level scope; views that need live session metrics
 *   (Phase 4 tasks) can read them from the tracking event response inside
 *   FocusLearningPage and pass down narrower props as needed later.
 * - `evaluation` matches the evaluate API's `evaluation` response shape.
 * - `onTrackingEvent` / `onEvaluate` / `onSkip` / `onNext` match the spec
 *   verbatim.
 */
export type LessonViewProps = {
  item: DailyPlanItemDTO
  evaluation?: EvaluationFeedbackDTO | null
  onTrackingEvent: (eventType: string, payload?: Record<string, unknown>) => Promise<void>
  onEvaluate: (input: Record<string, unknown>) => Promise<void>
  onSkip: () => Promise<void>
  onNext: () => void
  isEvaluating?: boolean
}
