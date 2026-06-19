'use client'

import type { LessonViewProps } from '../lesson-view-types'

/**
 * Minimal stub for this task (Task 5). The real MediaRecorder-based
 * recording loop + transcript fallback is Task 8
 * (docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md section 8.3-8.4). This stub
 * only proves the dispatch-by-type + onEvaluate wiring using the simple
 * recordedSeconds-based pass rule the evaluate API already supports.
 */
export function SpeakingLessonView({
  item,
  onTrackingEvent,
  onEvaluate,
  isEvaluating,
}: LessonViewProps) {
  return (
    <section className="rounded-3xl border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-gold">Speaking</p>
      <h2 className="mt-2 font-display text-xl font-medium text-ink">{item.title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-ink-soft">{item.content}</p>

      <p className="mt-4 text-sm text-muted">
        Microphone recording is coming soon. For now, mark a practice attempt
        to continue.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={() =>
            onTrackingEvent('record_progress', {
              recordedSeconds: 20,
              speechAttemptCount: 1,
            })
          }
          className="rounded-full border border-hairline-strong px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-soft"
        >
          I practiced speaking
        </button>

        <button
          disabled={isEvaluating}
          onClick={() =>
            onEvaluate({ recordedSeconds: 20, speechAttemptCount: 1 })
          }
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
        >
          Check my attempt
        </button>
      </div>
    </section>
  )
}
