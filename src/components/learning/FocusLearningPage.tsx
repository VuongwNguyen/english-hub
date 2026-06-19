'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import type { DailyPlanDTO, DailyPlanItemDTO } from '@/types/english'
import { LessonProgressHeader } from './LessonProgressHeader'
import { EvaluationFeedbackPanel, type EvaluationFeedbackDTO } from './EvaluationFeedbackPanel'
import { VocabLessonView } from './views/VocabLessonView'
import { WritingLessonView } from './views/WritingLessonView'
import { DevEnglishLessonView } from './views/DevEnglishLessonView'
import { ListeningLessonView } from './views/ListeningLessonView'
import { SpeakingLessonView } from './views/SpeakingLessonView'
import type { LessonViewProps } from './lesson-view-types'

type Props = {
  itemId: string
}

const HEARTBEAT_INTERVAL_MS = 15_000
// Heartbeats only count as "recent interaction" if the user did something
// (click/keydown/scroll) within this window (section 6.5).
const INTERACTION_FRESHNESS_MS = 60_000

const VIEW_BY_TYPE: Record<DailyPlanItemDTO['type'], (props: LessonViewProps) => React.JSX.Element> = {
  vocab: VocabLessonView,
  writing: WritingLessonView,
  dev_english: DevEnglishLessonView,
  listening: ListeningLessonView,
  speaking: SpeakingLessonView,
}

/**
 * Client-side orchestrator for /learn/[itemId] (Focus Learning screen,
 * docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md section 5.4).
 *
 * Data fetching approach: there is no GET /api/today/items/[itemId]
 * single-item endpoint yet. Per the task brief, option (a) is preferred —
 * fetch the full /api/today plan and find the item by id client-side. This
 * reuses the existing endpoint (which already returns full item content)
 * with no backend change, at the cost of an extra round-trip per item;
 * acceptable for a single learner's daily 5-item plan.
 */
export function FocusLearningPage({ itemId }: Props) {
  const router = useRouter()

  const [plan, setPlan] = useState<DailyPlanDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<EvaluationFeedbackDTO | null>(null)
  const [isSkipping, setIsSkipping] = useState(false)

  // Initialized to 0 (not Date.now()) to keep render pure; the real
  // timestamp is set by the interaction-tracking effect below on mount.
  const lastInteractionRef = useRef<number>(0)
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const item = plan?.items.find((candidate) => candidate.id === itemId) ?? null

  const loadPlan = useCallback(async () => {
    const response = await fetch('/api/today', { cache: 'no-store' })

    if (!response.ok) {
      throw new Error('Failed to load today plan')
    }

    const data: DailyPlanDTO = await response.json()
    setPlan(data)
    return data
  }, [])

  useEffect(() => {
    let active = true

    async function run() {
      try {
        await loadPlan()
      } catch (error) {
        console.error(error)
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    run()

    return () => {
      active = false
    }
  }, [loadPlan])

  const sendTrackingEvent = useCallback(
    async (eventType: string, payload?: Record<string, unknown>) => {
      try {
        const response = await fetch(
          `/api/today/items/${itemId}/tracking/event`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventType, payload }),
          }
        )

        if (!response.ok) {
          throw new Error('Failed to send tracking event')
        }

        const data = await response.json()

        // Mirror the updated item fields (status/progressPercent/
        // activeSeconds) back into the loaded plan so the header and footer
        // reflect the latest server state without a full refetch.
        setPlan((current) => {
          if (!current) return current

          return {
            ...current,
            items: current.items.map((candidate) =>
              candidate.id === itemId
                ? {
                    ...candidate,
                    status: data.item?.status ?? candidate.status,
                    progressPercent:
                      data.item?.progressPercent ?? candidate.progressPercent,
                    activeSeconds:
                      data.item?.activeSeconds ?? candidate.activeSeconds,
                    startedAt: data.item?.startedAt ?? candidate.startedAt,
                  }
                : candidate
            ),
          }
        })
      } catch (error) {
        // Tracking is best-effort; never break the learning UI over it.
        console.error(error)
      }
    },
    [itemId]
  )

  // 'start' tracking event on mount. Deferred via queueMicrotask so the
  // effect body itself does not synchronously invoke a function that sets
  // state (the tracking call's eventual setPlan update happens after the
  // network round-trip regardless, but this keeps the effect body itself
  // free of a direct setState-triggering call per the react-hooks rules).
  useEffect(() => {
    if (!item) return

    let cancelled = false

    queueMicrotask(() => {
      if (!cancelled) sendTrackingEvent('start')
    })

    return () => {
      cancelled = true
    }
    // Only fire once per mounted item, not on every item field change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  // Track "recent interaction" for heartbeat gating (section 6.5). Also
  // seeds the initial timestamp on mount, so opening the lesson counts as
  // an interaction without needing Date.now() during render.
  useEffect(() => {
    function markInteraction() {
      lastInteractionRef.current = Date.now()
    }

    markInteraction()

    window.addEventListener('click', markInteraction)
    window.addEventListener('keydown', markInteraction)
    window.addEventListener('scroll', markInteraction, { passive: true })

    return () => {
      window.removeEventListener('click', markInteraction)
      window.removeEventListener('keydown', markInteraction)
      window.removeEventListener('scroll', markInteraction)
    }
  }, [])

  // 15s heartbeat, gated by tab visibility + online status + recent
  // interaction (section 6.5). Cleared on unmount/route change.
  useEffect(() => {
    if (!item || item.status === 'completed' || item.status === 'skipped') {
      return
    }

    function tick() {
      const isVisible = document.visibilityState === 'visible'
      const isOnline = navigator.onLine
      const interactedRecently =
        Date.now() - lastInteractionRef.current < INTERACTION_FRESHNESS_MS

      if (isVisible && isOnline && interactedRecently) {
        sendTrackingEvent('heartbeat', { activeSecondsDelta: 15 })
      }
    }

    heartbeatTimerRef.current = setInterval(tick, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
    }
    // Intentionally depend on item?.id/item?.status rather than the whole
    // `item` object: progressPercent/activeSeconds mutate on every tracking
    // response, which would otherwise tear down and restart the interval
    // every 15s instead of running a stable heartbeat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, item?.status, sendTrackingEvent])

  const handleEvaluate = useCallback(
    async (input: Record<string, unknown>) => {
      if (!item) return

      try {
        setIsEvaluating(true)

        const response = await fetch(`/api/today/items/${itemId}/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonType: item.type, input }),
        })

        if (!response.ok) {
          throw new Error('Failed to evaluate item')
        }

        const data = await response.json()
        setEvaluation(data.evaluation)

        setPlan((current) => {
          if (!current) return current

          return {
            ...current,
            items: current.items.map((candidate) =>
              candidate.id === itemId
                ? {
                    ...candidate,
                    status: data.item?.status ?? candidate.status,
                    progressPercent:
                      data.item?.progressPercent ?? candidate.progressPercent,
                  }
                : candidate
            ),
          }
        })
      } catch (error) {
        console.error(error)
      } finally {
        setIsEvaluating(false)
      }
    },
    [item, itemId]
  )

  const handleSkip = useCallback(async () => {
    try {
      setIsSkipping(true)

      const response = await fetch(`/api/today/items/${itemId}/skip`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to skip item')
      }

      const data: DailyPlanDTO = await response.json()
      setPlan(data)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSkipping(false)
    }
  }, [itemId])

  const handleNext = useCallback(() => {
    // No global "next item" concept exists outside of
    // ContinueLearningButton's priority logic on /today (built in Task 4).
    // Rather than re-implement that logic here, navigate back to /today and
    // let Continue Learning decide where to go next.
    router.push('/today')
  }, [router])

  if (loading) {
    return <LoadingState message="Loading your lesson..." />
  }

  if (loadError || !plan) {
    return (
      <EmptyState
        title="Could not load this lesson."
        description="Please go back to Today and try again."
      />
    )
  }

  if (!item) {
    return (
      <EmptyState
        title="This lesson is not part of today's plan."
        description="It may have already been replaced by a new daily plan."
      />
    )
  }

  const ViewComponent = VIEW_BY_TYPE[item.type]

  const isDoneOrSkipped = item.status === 'completed' || item.status === 'skipped'
  const showNext = isDoneOrSkipped || evaluation !== null

  return (
    <div className="grid gap-6">
      <LessonProgressHeader item={item} />

      <ViewComponent
        item={item}
        evaluation={evaluation}
        onTrackingEvent={sendTrackingEvent}
        onEvaluate={handleEvaluate}
        onSkip={handleSkip}
        onNext={handleNext}
        isEvaluating={isEvaluating}
      />

      {evaluation && <EvaluationFeedbackPanel evaluation={evaluation} />}

      <footer className="flex flex-col items-center gap-4 px-2 text-center">
        <p className="text-sm text-muted">Progress saved automatically.</p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {!isDoneOrSkipped && (
            <button
              disabled={isSkipping}
              onClick={handleSkip}
              className="rounded-full bg-terracotta-tint px-5 py-2.5 text-sm font-medium text-terracotta disabled:opacity-50"
            >
              Skip
            </button>
          )}

          {showNext && (
            <button
              onClick={handleNext}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-surface transition-transform hover:scale-[1.02]"
            >
              Next Lesson
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
