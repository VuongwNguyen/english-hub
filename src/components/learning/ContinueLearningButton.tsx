'use client'

import { useRouter } from 'next/navigation'
import type { DailyPlanItemDTO } from '@/types/english'

type Props = {
  items: DailyPlanItemDTO[]
  className?: string
}

/**
 * Priority logic (spec 5.3):
 * 1. First item with status `in_progress`.
 * 2. Else first `pending` item.
 * 3. Else (all completed/skipped) — there is no daily summary route yet
 *    (that's a later task), so we disable the button and show a calm
 *    "All done for today" label instead of linking to a route that
 *    doesn't exist.
 */
function findNextItem(items: DailyPlanItemDTO[]) {
  return (
    items.find((item) => item.status === 'in_progress') ??
    items.find((item) => item.status === 'pending') ??
    null
  )
}

export function ContinueLearningButton({ items, className }: Props) {
  const router = useRouter()
  const nextItem = findNextItem(items)

  if (!nextItem) {
    return (
      <button
        disabled
        className={`rounded-full bg-surface-soft px-6 py-3 text-sm font-medium text-muted ${className ?? ''}`}
      >
        All done for today
      </button>
    )
  }

  return (
    <button
      onClick={() => router.push(`/learn/${nextItem.id}`)}
      className={`rounded-full bg-accent px-6 py-3 text-sm font-medium text-surface transition-transform hover:scale-[1.02] ${className ?? ''}`}
    >
      Continue Learning
    </button>
  )
}
