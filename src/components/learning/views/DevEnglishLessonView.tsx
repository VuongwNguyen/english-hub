'use client'

import { useState } from 'react'
import type { LessonViewProps } from '../lesson-view-types'

/**
 * Stub view for this task (Task 5). Full dev-english practice UI is Task 6.
 * Shares the same simple text+evaluate shape as WritingLessonView since the
 * backend evaluates both lesson types with the same rule-based heuristic.
 */
export function DevEnglishLessonView({
  item,
  onTrackingEvent,
  onEvaluate,
  isEvaluating,
}: LessonViewProps) {
  const [text, setText] = useState('')

  return (
    <section className="rounded-3xl border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-gold">Dev English</p>
      <h2 className="mt-2 font-display text-xl font-medium text-ink">{item.title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-ink-soft">{item.content}</p>

      <textarea
        value={text}
        onChange={(event) => {
          const value = event.target.value
          setText(value)
          onTrackingEvent('text_change', {
            typedWordCount: value.trim() ? value.trim().split(/\s+/).length : 0,
            typedCharacterCount: value.length,
            draftText: value,
          })
        }}
        rows={6}
        placeholder="Write your response here..."
        className="mt-4 w-full rounded-2xl border border-hairline bg-surface-soft p-4 text-ink outline-none focus:border-accent"
      />

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          disabled={isEvaluating}
          onClick={() => onEvaluate({ text })}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
        >
          Check my answer
        </button>
      </div>
    </section>
  )
}
