import type { DailyPlanItemDTO } from '@/types/english'

type Props = {
  item: DailyPlanItemDTO
  isLoading?: boolean
  onDone: () => void
  onSkip: () => void
  onUndo: () => void
}

export function LessonCard({
  item,
  isLoading,
  onDone,
  onSkip,
  onUndo,
}: Props) {
  const statusLabel = {
    pending: 'Pending',
    done: 'Done',
    skipped: 'Skipped',
  }[item.status]

  return (
    <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
            {item.type.replace('_', ' ')}
          </p>

          <h3 className="mt-2 text-xl font-semibold">
            {item.title}
          </h3>

          <p className="mt-1 text-sm text-slate-400">
            {item.estimatedMinutes} minutes · {statusLabel}
          </p>
        </div>

        <span className="w-fit rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">
          {statusLabel}
        </span>
      </div>

      <pre className="mt-5 whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">
        {item.content}
      </pre>

      {item.sourceUrl && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-sm text-slate-300 underline"
        >
          Open source
        </a>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          disabled={isLoading}
          onClick={onDone}
          className="rounded-2xl bg-slate-50 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          Done
        </button>

        <button
          disabled={isLoading}
          onClick={onSkip}
          className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 disabled:opacity-50"
        >
          Skip
        </button>

        {item.status !== 'pending' && (
          <button
            disabled={isLoading}
            onClick={onUndo}
            className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 disabled:opacity-50"
          >
            Undo
          </button>
        )}
      </div>
    </article>
  )
}
