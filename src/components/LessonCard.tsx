import type { DailyPlanItemDTO } from '@/types/english'

type Props = {
  item: DailyPlanItemDTO
  isLoading?: boolean
  onDone: () => void
  onSkip: () => void
  onUndo: () => void
}

const statusStyles = {
  pending: 'border border-gold-bright/50 text-gold',
  done: 'bg-accent-tint text-accent-soft',
  skipped: 'bg-terracotta-tint text-terracotta',
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
    <article className="rounded-3xl border border-t-2 border-hairline border-t-gold-bright bg-surface p-6 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gold">
            {item.type.replace('_', ' ')}
          </p>

          <h3 className="mt-2 font-display text-xl font-medium text-ink">
            {item.title}
          </h3>

          <p className="mt-1 text-sm text-muted">
            {item.estimatedMinutes} minutes · {statusLabel}
          </p>
        </div>

        <span
          className={`w-fit rounded-full px-3 py-1 text-sm ${statusStyles[item.status]}`}
        >
          {statusLabel}
        </span>
      </div>

      <pre className="mt-5 whitespace-pre-wrap rounded-2xl bg-surface-soft p-4 font-sans text-sm leading-6 text-ink-soft">
        {item.content}
      </pre>

      {item.sourceUrl && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-sm text-ink-soft underline underline-offset-2 hover:text-ink"
        >
          Open source
        </a>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          disabled={isLoading}
          onClick={onDone}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          Done
        </button>

        <button
          disabled={isLoading}
          onClick={onSkip}
          className="rounded-full bg-terracotta-tint px-4 py-2 text-sm font-medium text-terracotta disabled:opacity-50"
        >
          Skip
        </button>

        {item.status !== 'pending' && (
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
