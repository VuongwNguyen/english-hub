'use client'

import Link from 'next/link'
import { LESSON_TYPE_LABELS } from '@/lib/lesson-labels'
import type { DailyPlanItemDTO } from '@/types/english'

type Props = {
  item: DailyPlanItemDTO
}

export function LessonProgressHeader({ item }: Props) {
  const percent = Math.round(item.progressPercent ?? 0)

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Link
        href="/today"
        className="text-sm font-medium text-ink-soft transition-colors hover:text-accent"
      >
        ← Back to Today
      </Link>

      <div className="flex items-center gap-3 sm:flex-1 sm:justify-end">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">
          {LESSON_TYPE_LABELS[item.type]} · {percent}%
        </p>

        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-soft">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
          />
        </div>
      </div>
    </header>
  )
}
