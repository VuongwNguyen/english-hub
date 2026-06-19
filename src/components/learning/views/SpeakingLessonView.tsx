'use client'

import { useEffect, useRef, useState } from 'react'
import type { LessonViewProps } from '../lesson-view-types'

// completion.ts: speaking passes when recordedSeconds >= 20 OR
// speechAttemptCount >= 2 (section 8.4). The UI mirrors that 20s target as
// the "speak for N seconds" goal, but never blocks Stop/Check before it —
// the learner can stop early or check a short/typed attempt at any time,
// same as the other lesson views having no primary Done button.
const TARGET_SECONDS = 20

// record_progress is tracked roughly every 1 second per section 8.3.
const RECORD_PROGRESS_INTERVAL_MS = 1000

// ---------------------------------------------------------------------------
// Minimal ambient typing for the nonstandard Web Speech API
// (SpeechRecognition / webkitSpeechRecognition). lib.dom.d.ts does not
// declare these. Only the handful of members this component actually uses
// are typed; everything else is left out intentionally since this is a
// best-effort optional enhancement, not a contract the rest of the app
// depends on.
// ---------------------------------------------------------------------------
type SpeechRecognitionResultLike = {
  isFinal: boolean
  0: { transcript: string }
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: unknown) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function isMediaRecorderSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined'
  )
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length
}

type RecorderState = 'idle' | 'recording' | 'stopped'

export function SpeakingLessonView({
  item,
  onTrackingEvent,
  onEvaluate,
  isEvaluating,
}: LessonViewProps) {
  // Recomputed once per mount, not per render, but a plain function call is
  // cheap enough here and keeps SSR/CSR mismatches from a memoized
  // browser-only check out of the picture.
  const mediaRecorderSupported = isMediaRecorderSupported()

  const [recorderState, setRecorderState] = useState<RecorderState>('idle')
  const [recordedSeconds, setRecordedSeconds] = useState(0)
  const [speechAttemptCount, setSpeechAttemptCount] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [micError, setMicError] = useState<string | null>(null)
  const [fallbackTranscript, setFallbackTranscript] = useState('')
  const [useFallback, setUseFallback] = useState(!mediaRecorderSupported)

  // Refs holding live recording machinery so Stop / unmount / error paths
  // can all reach the same mic stream and timers, regardless of which path
  // triggered cleanup. Mic-track cleanup is safety-critical (section 8.3) so
  // it must not depend on component re-render state being current.
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const recordingStartedAtRef = useRef<number>(0)
  const attemptCountRef = useRef(0)

  function stopMicTracks() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Stopping an already-stopped/never-started recognizer can throw in
        // some browsers; never let that surface as a crash.
      }
      recognitionRef.current = null
    }

    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        // Already stopped/errored — ignore.
      }
    }
    mediaRecorderRef.current = null

    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
    streamRef.current = null
  }

  // Unconditional cleanup on unmount: if the learner navigates away mid
  // recording, the mic must not stay on.
  useEffect(() => {
    return () => {
      stopMicTracks()
    }
  }, [])

  function startSpeechRecognitionIfAvailable() {
    const RecognitionCtor = getSpeechRecognitionConstructor()
    if (!RecognitionCtor) return

    try {
      const recognition = new RecognitionCtor()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      let finalTranscript = ''

      recognition.onresult = (event) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i]
          const text = result[0]?.transcript ?? ''
          if (result.isFinal) {
            finalTranscript += `${text} `
          } else {
            interim += text
          }
        }
        setTranscript(`${finalTranscript}${interim}`.trim())
      }

      recognition.onerror = () => {
        // Live transcript is optional and best-effort; a recognition error
        // (e.g. no speech, network hiccup) should never interrupt the
        // recording itself.
      }

      recognition.onend = () => {
        recognitionRef.current = null
      }

      recognition.start()
      recognitionRef.current = recognition
    } catch {
      // Some browsers expose the constructor but throw on use (e.g. no mic
      // permission for speech recognition specifically, or a disabled
      // feature flag). Recording continues without a live transcript.
      recognitionRef.current = null
    }
  }

  async function handleStartRecording() {
    setMicError(null)

    if (!mediaRecorderSupported) {
      setUseFallback(true)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.start()

      const nextAttemptCount = attemptCountRef.current + 1
      attemptCountRef.current = nextAttemptCount
      setSpeechAttemptCount(nextAttemptCount)
      setTranscript('')
      setRecordedSeconds(0)
      setRecorderState('recording')

      recordingStartedAtRef.current = Date.now()
      onTrackingEvent('interaction', {})

      intervalRef.current = setInterval(() => {
        const elapsedSeconds = Math.floor(
          (Date.now() - recordingStartedAtRef.current) / 1000
        )
        setRecordedSeconds(elapsedSeconds)
        onTrackingEvent('record_progress', {
          recordedSeconds: elapsedSeconds,
          speechAttemptCount: nextAttemptCount,
        })
      }, RECORD_PROGRESS_INTERVAL_MS)

      startSpeechRecognitionIfAvailable()
    } catch (error) {
      // Permission denied, no device found, or any other getUserMedia
      // failure: never crash. Offer the calm fallback message + text input
      // so the learner can still attempt the practice.
      streamRef.current = null
      mediaRecorderRef.current = null
      setRecorderState('idle')
      setMicError(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Microphone access was not allowed. You can still practice by typing what you would say below.'
          : 'We could not access your microphone. You can still practice by typing what you would say below.'
      )
      setUseFallback(true)
    }
  }

  function handleStopRecording() {
    const finalSeconds = Math.floor(
      (Date.now() - recordingStartedAtRef.current) / 1000
    )

    stopMicTracks()
    setRecordedSeconds(finalSeconds)
    setRecorderState('stopped')

    onTrackingEvent('record_progress', {
      recordedSeconds: finalSeconds,
      speechAttemptCount: attemptCountRef.current,
    })
  }

  function handleCheckAttempt() {
    onEvaluate({
      recordedSeconds,
      speechAttemptCount: attemptCountRef.current,
      transcript: transcript || undefined,
    })
  }

  function handleCheckFallbackAttempt() {
    // No real microphone recording happened in this path, so recordedSeconds
    // has no meaningful real value. We send speechAttemptCount: 1 (one
    // typed attempt) and recordedSeconds: 0, and let evaluation.ts's
    // transcript-bonus logic (word count + keyword check) do the scoring
    // work from the typed text. This is a deliberate judgment call: it
    // keeps the fallback honest (no fabricated recording time) while still
    // letting a thoughtful typed answer pass via completion.ts's
    // speechAttemptCount-based OR-rule on a second attempt, or via a high
    // enough evaluation score in the meantime.
    const nextAttemptCount = attemptCountRef.current + 1
    attemptCountRef.current = nextAttemptCount
    setSpeechAttemptCount(nextAttemptCount)

    onTrackingEvent('record_progress', {
      recordedSeconds: 0,
      speechAttemptCount: nextAttemptCount,
    })

    onEvaluate({
      recordedSeconds: 0,
      speechAttemptCount: nextAttemptCount,
      transcript: fallbackTranscript || undefined,
    })
  }

  const showFallback = useFallback || !mediaRecorderSupported

  return (
    <section className="rounded-3xl border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-gold">Speaking</p>
      <h2 className="mt-2 font-display text-xl font-medium text-ink">{item.title}</h2>

      <p className="mt-3 text-ink-soft">Speak for {TARGET_SECONDS} seconds.</p>

      <div className="mt-3 rounded-2xl border border-hairline bg-surface-soft p-4">
        <p className="text-xs uppercase tracking-wide text-muted">Prompt</p>
        <p className="mt-1 whitespace-pre-wrap text-ink-soft">{item.content}</p>
      </div>

      {!showFallback && (
        <div className="mt-5 grid gap-3">
          {recorderState !== 'recording' ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleStartRecording}
                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface"
              >
                Start Recording
              </button>
              {recorderState === 'stopped' && (
                <span className="text-xs text-ink-soft">
                  Recorded {recordedSeconds} second{recordedSeconds === 1 ? '' : 's'} (attempt{' '}
                  {speechAttemptCount}). You can record again or check your attempt.
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-ink">
                Recording: {recordedSeconds} / {TARGET_SECONDS} seconds
              </span>
              <button
                onClick={handleStopRecording}
                className="rounded-full border border-hairline-strong px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-soft"
              >
                Stop
              </button>
            </div>
          )}

          {transcript && (
            <div className="rounded-2xl border border-hairline bg-surface-soft p-3">
              <p className="text-xs uppercase tracking-wide text-muted">Live transcript</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{transcript}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={isEvaluating || recorderState === 'idle' || recorderState === 'recording'}
              onClick={handleCheckAttempt}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
            >
              {isEvaluating ? 'Checking...' : 'Check my attempt'}
            </button>
            <span className="text-xs text-muted">Your progress is saved automatically.</span>
          </div>
        </div>
      )}

      {showFallback && (
        <div className="mt-5 grid gap-3">
          <p className="text-sm text-ink-soft">
            {micError ??
              'Microphone recording is not available in this browser. You can still practice by typing what you would say.'}
          </p>

          <textarea
            value={fallbackTranscript}
            onChange={(event) => setFallbackTranscript(event.target.value)}
            placeholder="Type what you would say out loud..."
            rows={4}
            className="w-full rounded-2xl border border-hairline bg-surface-soft p-3 text-sm text-ink outline-none focus:border-hairline-strong"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={isEvaluating || fallbackTranscript.trim().length === 0}
              onClick={handleCheckFallbackAttempt}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
            >
              {isEvaluating ? 'Checking...' : 'Check my attempt'}
            </button>
            <span className="text-xs text-muted">
              {countWords(fallbackTranscript)} word{countWords(fallbackTranscript) === 1 ? '' : 's'}
            </span>
          </div>

          {mediaRecorderSupported && (
            <button
              onClick={() => {
                setUseFallback(false)
                setMicError(null)
              }}
              className="justify-self-start text-xs text-ink-soft underline"
            >
              Try the microphone again
            </button>
          )}
        </div>
      )}
    </section>
  )
}
