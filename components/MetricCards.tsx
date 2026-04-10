import type { HeatpumpSnapshot } from '@/lib/types'

interface MetricCardProps {
  label: string
  value: string
  subtitle?: string
}

function MetricCard({ label, value, subtitle }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-50">{value}</p>
      {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
    </article>
  )
}

export function MetricCards({ data }: { data?: HeatpumpSnapshot }) {
  if (!data) {
    return (
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-800/70" />
        ))}
      </section>
    )
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Flow temperature"
        value={`${data.flowTemp.toFixed(1)}°C`}
        subtitle={`Setpoint guidance from controller • DHW target ${data.dhwSetpoint.toFixed(0)}°C`}
      />
      <MetricCard label="Return temperature" value={`${data.returnTemp.toFixed(1)}°C`} />
      <MetricCard label="Outdoor ambient" value={`${data.outdoorTemp.toFixed(1)}°C`} />
      <MetricCard label="Current COP" value={data.cop.toFixed(2)} subtitle="Coefficient of performance" />
    </section>
  )
}
