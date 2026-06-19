'use client'

import type { LessonViewProps } from '../lesson-view-types'

/**
 * Minimal stub for this task (Task 5). The real audio player + audio
 * progress tracking + quiz-after-75% flow is Task 7
 * (docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md section 8.1-8.2). This stub
 * only proves the dispatch-by-type + onEvaluate wiring using the generic
 * "answered all questions" completeness heuristic the evaluate API already
 * supports when there's no real quiz UI yet.
 */
export function ListeningLessonView({
  item,
  onTrackingEvent,
  onEvaluate,
  isEvaluating,
}: LessonViewProps) {
  return (
    <section className="rounded-3xl border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-gold">Listening</p>
      <h2 className="mt-2 font-display text-xl font-medium text-ink">{item.title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-ink-soft">{item.content}</p>

      <p className="mt-4 text-sm text-muted">
        Full audio player and listening quiz are coming soon. For now, mark
        that you listened to continue.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={() =>
            onTrackingEvent('audio_progress', { audioProgressPercent: 100 })
          }
          className="rounded-full border border-hairline-strong px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-soft"
        >
          I listened to this
        </button>

        <button
          disabled={isEvaluating}
          onClick={() =>
            onEvaluate({
              quizAnswers: [{ questionId: 'main_idea', answer: 'heard_it' }],
            })
          }
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
        >
          Check understanding
        </button>
      </div>
    </section>
  )
}
