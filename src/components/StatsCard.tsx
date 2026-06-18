type Props = {
  label: string
  value: string | number
}

export function StatsCard({ label, value }: Props) {
  return (
    <div className="rounded-2xl bg-accent-tint p-4">
      <p className="font-display text-2xl font-medium text-accent">{value}</p>
      <p className="text-sm text-ink-soft/80">{label}</p>
    </div>
  )
}
