'use client'

import Link from 'next/link'
import { LESSON_TYPE_LABELS } from '@/lib/lesson-labels'
import type { DailyPlanItemDTO } from '@/types/english'

type Props = {
  item: DailyPlanItemDTO
  isLoading?: boolean
  onSkip: () => void
  onUndo: () => void
}

const TYPE_ICONS: Record<DailyPlanItemDTO['type'], string> = {
  listening: '🎧',
  vocab: '📚',
  speaking: '🗣️',
  writing: '✍️',
  dev_english: '💻',
}

const STATUS_BADGE: Record<DailyPlanItemDTO['status'], string> = {
  pending: 'border border-gold-bright/50 text-gold',
  in_progress: 'bg-gold-soft text-gold',
  completed: 'bg-accent-tint text-accent-soft',
  skipped: 'bg-terracotta-tint text-terracotta',
}

const STATUS_LABEL: Record<DailyPlanItemDTO['status'], string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  skipped: 'Skipped',
}

export function LessonStatusCard({ item, isLoading, onSkip, onUndo }: Props) {
  const isActionable = item.status === 'pending' || item.status === 'in_progress'

  return (
    <article className="rounded-3xl border border-hairline bg-surface p-5 shadow-card transition-shadow hover:shadow-none sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-2xl" aria-hidden="true">
            {TYPE_ICONS[item.type]}
          </span>

          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gold">
              {LESSON_TYPE_LABELS[item.type]}
            </p>

            <h3 className="mt-1 font-display text-lg font-medium text-ink">
              {item.title}
            </h3>

            <p className="mt-1 text-sm text-muted">
              {item.estimatedMinutes} min
              {typeof item.progressPercent === 'number' && item.progressPercent > 0
                ? ` · ${Math.round(item.progressPercent)}% done`
                : ''}
            </p>
          </div>
        </div>

        <span
          className={`w-fit shrink-0 rounded-full px-3 py-1 text-sm ${STATUS_BADGE[item.status]}`}
        >
          {STATUS_LABEL[item.status]}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/learn/${item.id}`}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface transition-transform hover:scale-[1.02]"
        >
          {item.status === 'in_progress' ? 'Continue' : 'Open lesson'}
        </Link>

        {isActionable && (
          <button
            disabled={isLoading}
            onClick={onSkip}
            className="rounded-full bg-terracotta-tint px-4 py-2 text-sm font-medium text-terracotta disabled:opacity-50"
          >
            Skip
          </button>
        )}

        {!isActionable && (
          <button
            disabled={isLoading}
            onClick={onUndo}
            className="rounded-full border border-hairline-strong px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-soft disabled:opacity-50"
          >
            Undo
          </button>
        )}
      </div>
    </article>
  )
}
