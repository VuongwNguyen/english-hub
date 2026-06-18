export function LoadingState({
  message = 'Loading...',
}: {
  message?: string
}) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-hairline bg-surface px-6 py-12 text-center shadow-card">
      <p className="text-sm text-muted">{message}</p>
    </div>
  )
}
