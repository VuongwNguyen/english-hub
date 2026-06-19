'use client'

import { useEffect, useRef } from 'react'

const DEFAULT_DEBOUNCE_MS = 800

/**
 * Shared debounced `text_change` tracking for Writing / Dev English views
 * (docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md section 6.4 payload fields:
 * typedWordCount, typedCharacterCount, draftText).
 *
 * Sends a tracking event `debounceMs` after the learner stops typing, so we
 * don't fire a network request on every keystroke. If the component unmounts
 * while a trailing event is still pending (e.g. the learner navigates away
 * right after typing, before the debounce window elapses), the pending
 * event is flushed synchronously on unmount instead of being cancelled, so
 * the final draft is never lost.
 */
export function useDebouncedTextTracking(
  text: string,
  onTrackingEvent: (eventType: string, payload?: Record<string, unknown>) => Promise<void>,
  debounceMs: number = DEFAULT_DEBOUNCE_MS
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRenderRef = useRef(true)
  // Always points at a flush closure over the latest text/callback, kept
  // current from inside the effect below (never written during render) so
  // the unmount detector can flush the most recent value.
  const pendingFlushRef = useRef<(() => void) | null>(null)
  // True only while this render's debounce timer is still the "live" one,
  // i.e. it hasn't been cancelled by a restart (text/debounceMs change) or
  // already fired naturally. Read by the unmount-detector effect below.
  const timerIsLiveRef = useRef(false)

  useEffect(() => {
    // Skip the initial mount (empty draft, nothing to report yet).
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    const flush = () => {
      const trimmed = text.trim()
      onTrackingEvent('text_change', {
        typedWordCount: trimmed ? trimmed.split(/\s+/).length : 0,
        typedCharacterCount: text.length,
        draftText: text,
      })
    }
    pendingFlushRef.current = flush

    timerRef.current = setTimeout(() => {
      timerRef.current = null
      timerIsLiveRef.current = false
      flush()
    }, debounceMs)
    timerIsLiveRef.current = true

    return () => {
      // This cleanup runs both when `text`/`debounceMs` change (the effect
      // re-running to restart the debounce) and on unmount. In the
      // re-running case we must NOT flush here — that would fire a network
      // request on every keystroke and defeat debouncing. Just cancel the
      // stale timer; if a new render follows, the code above sets a fresh
      // one. If this turns out to be the final unmount instead, the
      // mount-ordered effect below (whose cleanup runs AFTER this one, since
      // React unwinds effects in declaration order) detects
      // `timerIsLiveRef` and flushes synchronously.
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [text, onTrackingEvent, debounceMs])

  useEffect(() => {
    // Declared after the effect above, so React runs ITS cleanup after the
    // one above on unmount — letting us tell "component unmounted while a
    // timer was live" apart from "effect re-ran to restart the debounce"
    // (the above cleanup already nulled timerRef in both cases, so we can't
    // rely on timerRef alone; timerIsLiveRef tells us whether the timer that
    // was just cancelled was still pending, i.e. never fired and isn't being
    // immediately replaced because we're unmounting, not re-rendering).
    return () => {
      if (timerIsLiveRef.current) {
        timerIsLiveRef.current = false
        pendingFlushRef.current?.()
      }
    }
  }, [])
}
