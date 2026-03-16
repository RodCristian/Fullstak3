type MetricCardProps = {
  label: string
  value: number | string
  description: string
}

export function MetricCard({ label, value, description }: MetricCardProps) {
  return (
    <article className="metric-card">
      <p className="metric-label">{label}</p>
      <strong className="metric-value">{value}</strong>
      <p className="metric-description">{description}</p>
    </article>
  )
}
