import type { TodayProgress } from '@/types/english'

type Props = {
  progress: TodayProgress
  theme?: string | null
}

export function ProgressCard({ progress, theme }: Props) {
  return (
    <section className="rounded-3xl border border-t-2 border-hairline border-t-gold-bright bg-surface p-6 shadow-card">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">Today&apos;s theme</p>
          <h2 className="font-display text-2xl font-medium text-ink">
            {theme ?? 'Daily English'}
          </h2>
        </div>

        <div className="text-left sm:text-right">
          <p className="font-display text-4xl font-medium text-accent">
            {progress.done}/{progress.total}
          </p>
          <p className="text-sm text-muted">items done</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-accent-tint p-4">
          <p className="font-display text-2xl font-medium text-accent">
            {progress.minutesSpent}
          </p>
          <p className="text-sm text-ink-soft/80">minutes</p>
        </div>

        <div className="rounded-2xl bg-accent-tint p-4">
          <p className="font-display text-2xl font-medium text-accent">
            {progress.wordsLearned}
          </p>
          <p className="text-sm text-ink-soft/80">phrases</p>
        </div>

        <div className="rounded-2xl bg-accent-tint p-4">
          <p className="font-display text-2xl font-medium text-accent">
            {progress.speakingMinutes}
          </p>
          <p className="text-sm text-ink-soft/80">speaking min</p>
        </div>

        <div className="rounded-2xl bg-accent-tint p-4">
          <p className="font-display text-2xl font-medium text-accent">
            {progress.writingSentences}
          </p>
          <p className="text-sm text-ink-soft/80">sentences</p>
        </div>
      </div>
    </section>
  )
}
