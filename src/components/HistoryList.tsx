import type { HistoryEntryDTO } from '@/types/english'

type Props = {
  entries: HistoryEntryDTO[]
}

export function HistoryList({ entries }: Props) {
  return (
    <div className="grid gap-3">
      {entries.map((entry) => (
        <article
          key={entry.id}
          className="rounded-2xl border border-t-2 border-hairline border-t-gold-bright bg-surface p-5 shadow-card"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display font-medium text-ink">{entry.date}</p>

              <p className="mt-1 text-sm text-muted">
                {entry.theme ?? 'No theme'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-accent-tint px-3 py-1 text-accent-soft">
                {entry.doneItems}/{entry.totalItems} done
              </span>
              <span className="rounded-full bg-terracotta-tint px-3 py-1 text-terracotta">
                {entry.skippedItems} skipped
              </span>
              <span className="rounded-full bg-surface-soft px-3 py-1 text-ink-soft">
                {entry.minutesSpent} minutes
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
