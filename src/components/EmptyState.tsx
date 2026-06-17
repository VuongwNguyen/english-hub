export function EmptyState({
  title = 'Nothing here yet.',
  description,
  action,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
      <p className="font-medium text-slate-50">{title}</p>

      {description ? (
        <p className="text-sm text-slate-400">{description}</p>
      ) : null}

      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
