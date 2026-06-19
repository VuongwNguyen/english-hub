'use client'

import { useState } from 'react'
import type { LessonViewProps } from '../lesson-view-types'
import { useDebouncedTextTracking } from '../useDebouncedTextTracking'

// Soft minimum before "Check my answer" is enabled — matches the
// evaluation heuristic's full-marks word count (evaluation.ts treats 30
// words as "enough"), but we only require a small fraction of that so the
// learner isn't blocked harshly while still drafting (section 5.4: no
// guilt/pressure copy or hard gates).
const MIN_WORDS_TO_EVALUATE = 5

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function WritingLessonView({
  item,
  onTrackingEvent,
  onEvaluate,
  isEvaluating,
}: LessonViewProps) {
  const [text, setText] = useState('')

  useDebouncedTextTracking(text, onTrackingEvent)

  const wordCount = countWords(text)
  const canEvaluate = wordCount >= MIN_WORDS_TO_EVALUATE && !isEvaluating

  return (
    <section className="rounded-3xl border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-gold">Writing</p>
      <h2 className="mt-2 font-display text-xl font-medium text-ink">{item.title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-ink-soft">{item.content}</p>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={8}
        placeholder="Write your response here. A few sentences is a great start."
        className="mt-4 w-full rounded-2xl border border-hairline bg-surface-soft p-4 text-ink outline-none focus:border-accent"
      />

      <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
        <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
        <span>Your progress is saved automatically.</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          disabled={!canEvaluate}
          onClick={() => onEvaluate({ text })}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
        >
          {isEvaluating ? 'Checking...' : 'Check my answer'}
        </button>

        {!canEvaluate && !isEvaluating && (
          <span className="text-xs text-ink-soft">
            Write a little more, then check your answer.
          </span>
        )}
      </div>
    </section>
  )
}
