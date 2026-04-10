import type { HeatpumpHistoryResponse, HeatpumpSnapshot } from '@/lib/types'

function Stat({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  )
}

export function EnergyPanel({
  data,
  history,
}: {
  data?: HeatpumpSnapshot
  history?: HeatpumpHistoryResponse
}) {
  const averageCop = data && data.energyConsumedMonth > 0 ? data.energyOutputMonth / data.energyConsumedMonth : history?.summary.averageCop ?? 0

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-50">Energy &amp; efficiency</h2>
        <p className="text-sm text-slate-400">Daily and monthly output, input, COP, and runtime.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Thermal output"
          value={data ? `${data.energyOutputToday.toFixed(1)} / ${data.energyOutputMonth.toFixed(1)} kWh` : '—'}
          subtitle="Today / this month"
        />
        <Stat
          label="Electrical consumed"
          value={data ? `${data.energyConsumedToday.toFixed(1)} / ${data.energyConsumedMonth.toFixed(1)} kWh` : '—'}
          subtitle="Today / this month"
        />
        <Stat label="Average COP" value={averageCop ? averageCop.toFixed(2) : '—'} subtitle="Month-to-date performance" />
        <Stat label="Run hours today" value={data ? `${data.runHoursToday.toFixed(1)} h` : '—'} />
      </div>
    </section>
  )
}
