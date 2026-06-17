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
          className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-slate-50">{entry.date}</p>

              <p className="mt-1 text-sm text-slate-400">
                {entry.theme ?? 'No theme'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-slate-300">
              <span className="rounded-full bg-slate-800 px-3 py-1">
                {entry.doneItems}/{entry.totalItems} done
              </span>
              <span className="rounded-full bg-slate-800 px-3 py-1">
                {entry.skippedItems} skipped
              </span>
              <span className="rounded-full bg-slate-800 px-3 py-1">
                {entry.minutesSpent} minutes
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
