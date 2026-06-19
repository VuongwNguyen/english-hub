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
 * 3. Else (all completed/skipped) — go to the daily summary (/today/summary,
 *    section 5.5) instead of disabling the button.
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
        onClick={() => router.push('/today/summary')}
        className={`rounded-full bg-accent px-6 py-3 text-sm font-medium text-surface transition-transform hover:scale-[1.02] ${className ?? ''}`}
      >
        See today&apos;s summary
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
