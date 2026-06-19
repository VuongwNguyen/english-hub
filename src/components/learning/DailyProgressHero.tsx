import { computeActiveMinutes } from '@/lib/lesson-labels'
import type { DailyPlanItemDTO, TodayProgress } from '@/types/english'
import { ContinueLearningButton } from './ContinueLearningButton'

type Props = {
  progress: TodayProgress
  items: DailyPlanItemDTO[]
  theme?: string | null
}

export function DailyProgressHero({ progress, items, theme }: Props) {
  const activeMinutes = computeActiveMinutes(items)

  const completedCount = progress.done
  const totalCount = progress.total
  const percent =
    totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0

  return (
    <section className="rounded-3xl border border-t-2 border-hairline border-t-gold-bright bg-surface p-6 shadow-card sm:p-8">
      <p className="text-sm uppercase tracking-[0.3em] text-gold">
        {theme ?? 'Today'}
      </p>

      <h1 className="mt-2 font-display text-3xl font-medium text-ink">
        Today&apos;s English
      </h1>

      <p className="mt-2 text-ink-soft">
        Five small lessons. No pressure.
      </p>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-2xl font-medium text-accent">
            {completedCount} / {totalCount} completed
          </p>
          <p className="mt-1 text-sm text-muted">
            {activeMinutes} active minute{activeMinutes === 1 ? '' : 's'} today
          </p>
        </div>

        <ContinueLearningButton items={items} />
      </div>

      <div className="mt-6">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-soft">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </section>
  )
}
