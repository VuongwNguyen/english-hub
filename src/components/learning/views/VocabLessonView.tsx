'use client'

import type { LessonViewProps } from '../lesson-view-types'

/**
 * Stub view for this task (Task 5). Full vocab practice/quiz UI is Task 6.
 * Proves the dispatch-by-type + onTrackingEvent/onEvaluate wiring: a single
 * "I practiced this" action records a practice interaction, and "Check my
 * understanding" runs the rule-based vocab evaluation.
 */
export function VocabLessonView({
  item,
  onTrackingEvent,
  onEvaluate,
  isEvaluating,
}: LessonViewProps) {
  return (
    <section className="rounded-3xl border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-gold">Vocabulary</p>
      <h2 className="mt-2 font-display text-xl font-medium text-ink">{item.title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-ink-soft">{item.content}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={() => onTrackingEvent('interaction', { practiceCount: 1 })}
          className="rounded-full border border-hairline-strong px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-soft"
        >
          I practiced this
        </button>

        <button
          disabled={isEvaluating}
          onClick={() => onEvaluate({})}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
        >
          Check my understanding
        </button>
      </div>
    </section>
  )
}
