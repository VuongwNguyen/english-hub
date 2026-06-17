export function LoadingState({
  message = 'Loading...',
}: {
  message?: string
}) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}
