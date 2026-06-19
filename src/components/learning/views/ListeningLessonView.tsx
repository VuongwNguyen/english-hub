'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { LessonViewProps } from '../lesson-view-types'
import { generateListeningQuiz, type QuizQuestion } from '../listening-quiz'

// completion.ts: listening passes when audioProgressPercent >= 75 AND quiz
// score >= 60. The quiz only needs to appear once that threshold is
// reachable, so we gate the mini quiz on the same number here.
const AUDIO_PROGRESS_QUIZ_THRESHOLD = 75

// audio_progress events are throttled to roughly every 3-5 seconds per
// section 8.1, rather than firing on every `timeupdate` (which fires very
// frequently, multiple times a second).
const AUDIO_PROGRESS_THROTTLE_MS = 4000

// AUDIO EXTENSION DETECTION
// -------------------------
// The Lesson model (src/models/Lesson.ts) and the rotation/seed/generation
// code (src/server/rotation.ts, src/server/seed.ts,
// src/server/data/listening-lessons.ts,
// src/server/external/generate-lessons-from-cache.ts) have NO dedicated
// `audioUrl` field. The only candidate is `sourceUrl` / `sourceUrls`, and in
// every real listening lesson in this codebase that field points at a
// reference website's homepage (e.g. https://www.bbc.co.uk/learningenglish,
// https://learningenglish.voanews.com/), not a direct playable audio file.
// So the common case has NO usable audio, and per section 18's "No
// audioUrl" fallback guidance we show the lesson text directly instead.
//
// We still implement the real <audio> player path (gated on an actual
// audio file extension) in case a future sourceUrl ever points directly at
// a .mp3/.wav/etc file, so the view does not need another pass if that
// changes.
const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|ogg|m4a|aac|webm)(\?.*)?$/i

function getPlayableAudioUrl(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) return null
  return AUDIO_EXTENSION_PATTERN.test(sourceUrl) ? sourceUrl : null
}

type QuizAnswers = Record<string, string>

function MiniQuiz({
  questions,
  answers,
  onSelect,
  onSubmit,
  isEvaluating,
}: {
  questions: QuizQuestion[]
  answers: QuizAnswers
  onSelect: (questionId: string, value: string) => void
  onSubmit: () => void
  isEvaluating?: boolean
}) {
  const allAnswered = questions.every((question) => Boolean(answers[question.id]))

  return (
    <div className="mt-5 grid gap-4 rounded-2xl border border-hairline bg-surface-soft p-4">
      <p className="text-sm font-medium text-ink">Quick check</p>

      {questions.map((question, index) => (
        <div key={question.id} className="grid gap-2">
          <p className="text-sm text-ink-soft">
            Question {index + 1}: {question.prompt}
          </p>
          <div className="grid gap-2">
            {question.options.map((option) => {
              const selected = answers[question.id] === option.value

              return (
                <button
                  key={option.value}
                  onClick={() => onSelect(question.id, option.value)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? 'border-accent-tint bg-accent-tint/30 text-ink'
                      : 'border-hairline bg-surface text-ink-soft hover:border-hairline-strong'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div>
        <button
          disabled={!allAnswered || isEvaluating}
          onClick={onSubmit}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
        >
          {isEvaluating ? 'Checking...' : 'Check answers'}
        </button>
        {!allAnswered && (
          <span className="ml-3 text-xs text-ink-soft">
            Answer both questions to check.
          </span>
        )}
      </div>
    </div>
  )
}

export function ListeningLessonView({
  item,
  onTrackingEvent,
  onEvaluate,
  isEvaluating,
}: LessonViewProps) {
  const audioUrl = useMemo(() => getPlayableAudioUrl(item.sourceUrl), [item.sourceUrl])

  const quizQuestions = useMemo(() => generateListeningQuiz(item.content), [item.content])

  const [audioProgressPercent, setAudioProgressPercent] = useState(
    item.progressPercent ?? 0
  )
  const [hasMarkedRead, setHasMarkedRead] = useState(false)
  const [answers, setAnswers] = useState<QuizAnswers>({})

  const showQuiz = audioProgressPercent >= AUDIO_PROGRESS_QUIZ_THRESHOLD

  // Throttle audio_progress tracking to roughly every 3-5 seconds rather
  // than on every `timeupdate` firing (which fires many times per second).
  // lastSentAtRef tracks wall-clock time of the last sent event;
  // pendingFlushRef/timerRef hold a trailing event so the final position
  // right before pause/seek/unmount is never silently dropped (the same
  // care Task 6's useDebouncedTextTracking takes around its debounce timer).
  const lastSentAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingFlushRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      // Flush any trailing progress update on unmount so it is not lost.
      pendingFlushRef.current?.()
      pendingFlushRef.current = null
    }
  }, [])

  function sendAudioProgress(percent: number, currentTime: number, duration: number) {
    const flush = () => {
      lastSentAtRef.current = Date.now()
      onTrackingEvent('audio_progress', {
        audioProgressPercent: percent,
        currentTime,
        duration,
      })
    }

    const elapsed = Date.now() - lastSentAtRef.current

    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (elapsed >= AUDIO_PROGRESS_THROTTLE_MS) {
      pendingFlushRef.current = null
      flush()
      return
    }

    // Schedule the latest value to fire once the throttle window elapses,
    // so we don't lose the most recent progress update even if no further
    // timeupdate events arrive before then.
    pendingFlushRef.current = flush
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      pendingFlushRef.current = null
      flush()
    }, AUDIO_PROGRESS_THROTTLE_MS - elapsed)
  }

  function handlePlay() {
    onTrackingEvent('interaction', {})
  }

  function handleTimeUpdate(event: React.SyntheticEvent<HTMLAudioElement>) {
    const audio = event.currentTarget
    if (!audio.duration || Number.isNaN(audio.duration)) return

    const percent = Math.min(100, (audio.currentTime / audio.duration) * 100)
    setAudioProgressPercent((previous) => Math.max(previous, percent))
    sendAudioProgress(percent, audio.currentTime, audio.duration)
  }

  function handleEnded() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingFlushRef.current = null
    lastSentAtRef.current = Date.now()
    setAudioProgressPercent(100)
    onTrackingEvent('audio_progress', { audioProgressPercent: 100 })
  }

  // No-audio fallback: the learner reads the lesson text directly and marks
  // it read, which drives audioProgressPercent to 100 immediately so the
  // existing AND-rule in completion.ts (audioProgressPercent >= 75 AND quiz
  // score >= 60) is satisfied without any modification to that rule.
  function handleMarkRead() {
    if (hasMarkedRead) return
    setHasMarkedRead(true)
    onTrackingEvent('interaction', {})
    setAudioProgressPercent(100)
    onTrackingEvent('audio_progress', { audioProgressPercent: 100 })
  }

  function handleSelectAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }))
  }

  function handleSubmitQuiz() {
    const expectedAnswers: Record<string, string> = {}
    for (const question of quizQuestions) {
      expectedAnswers[question.id] = question.correctValue
    }

    onEvaluate({
      quizAnswers: quizQuestions.map((question) => ({
        questionId: question.id,
        answer: answers[question.id] ?? '',
      })),
      expectedAnswers,
    })
  }

  return (
    <section className="rounded-3xl border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-gold">Listening</p>
      <h2 className="mt-2 font-display text-xl font-medium text-ink">{item.title}</h2>

      {audioUrl ? (
        <>
          <p className="mt-3 text-ink-soft">Listen to this short audio.</p>
          <audio
            controls
            src={audioUrl}
            className="mt-3 w-full"
            onPlay={handlePlay}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
          />
          <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
            <span>Progress: {Math.round(audioProgressPercent)}%</span>
            <span>Your progress is saved automatically.</span>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 whitespace-pre-wrap text-ink-soft">{item.content}</p>
          {!hasMarkedRead && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={handleMarkRead}
                className="rounded-full border border-hairline-strong px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-soft"
              >
                I read this
              </button>
              <span className="text-xs text-muted">
                No audio is available for this lesson today, so read the text above.
              </span>
            </div>
          )}
        </>
      )}

      {showQuiz && quizQuestions.length > 0 && (
        <MiniQuiz
          questions={quizQuestions}
          answers={answers}
          onSelect={handleSelectAnswer}
          onSubmit={handleSubmitQuiz}
          isEvaluating={isEvaluating}
        />
      )}

      {showQuiz && quizQuestions.length === 0 && (
        <div className="mt-5 grid gap-3 rounded-2xl border border-hairline bg-surface-soft p-4">
          <p className="text-sm text-ink-soft">
            This lesson is too short to build a quiz automatically. You can still
            check understanding to continue.
          </p>
          <button
            disabled={isEvaluating}
            onClick={() => onEvaluate({ quizAnswers: [], selectedAnswers: ['acknowledged'] })}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            {isEvaluating ? 'Checking...' : 'Check understanding'}
          </button>
        </div>
      )}
    </section>
  )
}
