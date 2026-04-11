import type { HeatpumpSnapshot } from '@/lib/types'

function ProgressRow({
  label,
  value,
  active,
}: {
  label: string
  value: number | null
  active: boolean
}) {
  const display = value === null ? 'N/A' : `${Math.round(value)}%`

  return (
    <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-300">{label}</p>
          <p className="text-xs text-slate-500">{active ? 'On' : 'Off'}</p>
        </div>
        <p className="text-sm font-medium text-slate-100">{display}</p>
      </div>
      <div className="h-2 rounded-full bg-slate-800">
        <div
          className={`h-2 rounded-full ${active ? 'bg-sky-400' : 'bg-slate-600'}`}
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
    </div>
  )
}

export function ComponentStatus({ data }: { data?: HeatpumpSnapshot }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-50">Compressor &amp; pump status</h2>
        <p className="text-sm text-slate-400">Compressor frequency and live modulation levels.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-slate-400">Compressor frequency</p>
              <p className="mt-2 text-3xl font-semibold text-slate-50">
                {data ? `${data.compressorFreq.toFixed(0)} Hz` : '—'}
              </p>
            </div>
            <p className="text-sm text-slate-500">Max visualised: 80 Hz</p>
          </div>
          <div className="mt-4 h-3 rounded-full bg-slate-800">
            <div
              className="h-3 rounded-full bg-emerald-400"
              style={{ width: `${Math.min(((data?.compressorFreq ?? 0) / 80) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="grid gap-4">
          <ProgressRow label="Primary pump" value={data?.primaryPumpSpeed ?? null} active={(data?.primaryPumpSpeed ?? 0) > 0} />
          <ProgressRow label="Secondary pump" value={data?.secondaryPumpSpeed ?? null} active={(data?.secondaryPumpSpeed ?? 0) > 0} />
          <ProgressRow label="Fan speed" value={data?.fanSpeed ?? null} active={(data?.fanSpeed ?? 0) > 0} />
        </div>
      </div>
    </section>
  )
}
