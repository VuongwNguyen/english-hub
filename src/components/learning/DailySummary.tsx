'use client'

import Link from 'next/link'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { computeActiveMinutes, LESSON_TYPE_LABELS } from '@/lib/lesson-labels'
import type { DailyPlanDTO } from '@/types/english'

type Props = {
  plan: DailyPlanDTO | null
  loading: boolean
}

/**
 * Daily summary screen (spec section 5.5). Shown once every DailyPlan item
 * is completed or skipped.
 *
 * Skipped items intentionally do NOT appear in the "Completed:" checkmark
 * list (calm tone, no "you missed X" language) — they simply don't show up,
 * rather than being called out negatively.
 */
export function DailySummary({ plan, loading }: Props) {
  if (loading) {
    return <LoadingState message="Loading your summary..." />
  }

  if (!plan) {
    return (
      <EmptyState
        title="Could not load your summary."
        description="Please refresh the page."
      />
    )
  }

  const activeMinutes = computeActiveMinutes(plan.items)

  const completedItems = plan.items.filter((item) => item.status === 'completed')

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-t-2 border-hairline border-t-gold-bright bg-surface p-6 text-center shadow-card sm:p-8">
        <h1 className="font-display text-3xl font-medium text-ink">
          Nice work.
        </h1>

        <p className="mt-2 text-ink-soft">
          You practiced English for {activeMinutes} minute
          {activeMinutes === 1 ? '' : 's'} today.
        </p>

        {completedItems.length > 0 && (
          <div className="mx-auto mt-6 max-w-xs text-left">
            <p className="text-xs uppercase tracking-[0.25em] text-gold">
              Completed
            </p>

            <ul className="mt-3 grid gap-2">
              {completedItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 text-ink"
                >
                  <span className="text-accent" aria-hidden="true">
                    ✓
                  </span>
                  {LESSON_TYPE_LABELS[item.type]}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-8 text-sm text-muted">
          Come back tomorrow for a fresh set.
        </p>

        <Link
          href="/today"
          className="mt-6 inline-block rounded-full bg-accent px-6 py-3 text-sm font-medium text-surface transition-transform hover:scale-[1.02]"
        >
          Back to Today
        </Link>
      </section>
    </div>
  )
}
