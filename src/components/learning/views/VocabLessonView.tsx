'use client'

import { useMemo, useState } from 'react'
import type { LessonViewProps } from '../lesson-view-types'

// completion.ts: vocab passes when practiceCount >= 5 OR evaluation score
// >= 60. There is no stored quiz/target-word list on the Lesson model (see
// evaluation.ts's module doc comment), so the self-check below is built
// directly from item.content's lines.
const PRACTICE_GOAL = 5

type VocabEntry = {
  word: string
  definition: string
}

/**
 * Turns item.content's lines into practiceable entries. Two shapes are seen
 * in the data today (per section 18's "remain usable even with imperfect
 * generated lessons" guidance, this is intentionally tolerant of both):
 *   - `- word: definition` (generateVocabLessons() in
 *     generate-lessons-from-cache.ts, word-pack style lessons)
 *   - plain one-phrase-per-line content (the static/seeded vocab packs
 *     currently in the DB, e.g. "I need to check this.")
 * Each non-empty line becomes one practiceable item; a leading "- " bullet
 * is stripped, and a "word: definition" split is applied only when a colon
 * is present.
 */
function parseVocabEntries(content: string): VocabEntry[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const withoutBullet = line.replace(/^-\s*/, '')
      const separatorIndex = withoutBullet.indexOf(':')

      if (separatorIndex === -1) {
        return { word: withoutBullet, definition: '' }
      }

      return {
        word: withoutBullet.slice(0, separatorIndex).trim(),
        definition: withoutBullet.slice(separatorIndex + 1).trim(),
      }
    })
    .filter((entry) => entry.word.length > 0)
}

export function VocabLessonView({
  item,
  onTrackingEvent,
  onEvaluate,
  isEvaluating,
}: LessonViewProps) {
  const entries = useMemo(() => parseVocabEntries(item.content), [item.content])

  // practiceCount is sent to the tracking API as an absolute value (the
  // route does $set, not $inc — see src/server/learning/tracking.ts), so we
  // keep the running total locally and resend the full count each time a
  // word is marked practiced.
  const [practicedWords, setPracticedWords] = useState<Set<string>>(new Set())
  const practiceCount = practicedWords.size

  function markPracticed(word: string) {
    if (practicedWords.has(word)) return

    const next = new Set(practicedWords)
    next.add(word)
    setPracticedWords(next)
    onTrackingEvent('interaction', { practiceCount: next.size })
  }

  function markAllPracticed() {
    if (entries.length === 0) return
    const next = new Set(entries.map((entry) => entry.word))
    setPracticedWords(next)
    onTrackingEvent('interaction', { practiceCount: next.size })
  }

  const canEvaluate = !isEvaluating

  return (
    <section className="rounded-3xl border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-gold">Vocabulary</p>
      <h2 className="mt-2 font-display text-xl font-medium text-ink">{item.title}</h2>

      {entries.length === 0 ? (
        <p className="mt-3 whitespace-pre-wrap text-ink-soft">{item.content}</p>
      ) : (
        <div className="mt-4 grid gap-2">
          {entries.map((entry) => {
            const practiced = practicedWords.has(entry.word)

            return (
              <button
                key={entry.word}
                onClick={() => markPracticed(entry.word)}
                className={`flex items-start justify-between gap-3 rounded-2xl border p-3 text-left transition-colors ${
                  practiced
                    ? 'border-accent-tint bg-accent-tint/30'
                    : 'border-hairline bg-surface-soft hover:border-hairline-strong'
                }`}
              >
                <span>
                  <span className="font-medium text-ink">{entry.word}</span>
                  {entry.definition && (
                    <span className="ml-2 text-sm text-ink-soft">{entry.definition}</span>
                  )}
                </span>
                <span className="text-xs uppercase tracking-wide text-ink-soft">
                  {practiced ? 'Practiced' : 'Tap to practice'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-ink-soft">
        <span>
          {practiceCount} / {Math.max(entries.length, PRACTICE_GOAL)} practiced
        </span>
        <span>Your progress is saved automatically.</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {entries.length > 0 && practiceCount < entries.length && (
          <button
            onClick={markAllPracticed}
            className="rounded-full border border-hairline-strong px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-soft"
          >
            I know these words
          </button>
        )}

        <button
          disabled={!canEvaluate}
          onClick={() => onEvaluate({})}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
        >
          {isEvaluating ? 'Checking...' : 'Check my understanding'}
        </button>
      </div>
    </section>
  )
}
