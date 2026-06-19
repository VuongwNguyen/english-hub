'use client'

import { useEffect, useRef } from 'react'

const DEFAULT_DEBOUNCE_MS = 800

/**
 * Shared debounced `text_change` tracking for Writing / Dev English views
 * (docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md section 6.4 payload fields:
 * typedWordCount, typedCharacterCount, draftText).
 *
 * Sends a tracking event `debounceMs` after the learner stops typing, so we
 * don't fire a network request on every keystroke. The latest value is
 * always flushed (via the trailing timer), so the final draft is never
 * lost even if the learner stops typing right as the component unmounts.
 */
export function useDebouncedTextTracking(
  text: string,
  onTrackingEvent: (eventType: string, payload?: Record<string, unknown>) => Promise<void>,
  debounceMs: number = DEFAULT_DEBOUNCE_MS
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRenderRef = useRef(true)

  useEffect(() => {
    // Skip the initial mount (empty draft, nothing to report yet).
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      const trimmed = text.trim()
      onTrackingEvent('text_change', {
        typedWordCount: trimmed ? trimmed.split(/\s+/).length : 0,
        typedCharacterCount: text.length,
        draftText: text,
      })
    }, debounceMs)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, debounceMs])
}
