type Props = {
  label: string
  value: string | number
}

export function StatsCard({ label, value }: Props) {
  return (
    <div className="rounded-2xl bg-slate-800 p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  )
}
