import type { TodayProgress } from '@/types/english'

type Props = {
  progress: TodayProgress
  theme?: string | null
}

export function ProgressCard({ progress, theme }: Props) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-400">Today&apos;s theme</p>
          <h2 className="text-2xl font-semibold">
            {theme ?? 'Daily English'}
          </h2>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-3xl font-bold">
            {progress.done}/{progress.total}
          </p>
          <p className="text-sm text-slate-400">items done</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-2xl font-semibold">{progress.minutesSpent}</p>
          <p className="text-sm text-slate-400">minutes</p>
        </div>

        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-2xl font-semibold">{progress.wordsLearned}</p>
          <p className="text-sm text-slate-400">phrases</p>
        </div>

        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-2xl font-semibold">{progress.speakingMinutes}</p>
          <p className="text-sm text-slate-400">speaking min</p>
        </div>

        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-2xl font-semibold">{progress.writingSentences}</p>
          <p className="text-sm text-slate-400">sentences</p>
        </div>
      </div>
    </section>
  )
}
