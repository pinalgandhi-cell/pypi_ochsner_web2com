'use client'

import type { HeatpumpSnapshot } from '@/lib/types'

const modeLabels: Record<HeatpumpSnapshot['operatingMode'], string> = {
  heating: 'Heating',
  cooling: 'Cooling',
  dhw: 'DHW',
  standby: 'Standby',
  defrost: 'Defrost',
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value))
}

export function StatusBar({ data }: { data?: HeatpumpSnapshot }) {
  if (!data) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="h-16 animate-pulse rounded-xl bg-slate-800/70" />
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${data.online ? 'bg-emerald-400' : 'bg-rose-500'}`}
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-slate-100">
                {data.online ? 'System online' : 'System offline'}
              </p>
              <p className="text-xs text-slate-400">{modeLabels[data.operatingMode]}</p>
            </div>
          </div>
          <div className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
            Last refresh: {formatTimestamp(data.lastUpdated)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data.faultCodes.length === 0 ? (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
              No active faults
            </span>
          ) : (
            data.faultCodes.map((fault) => (
              <span
                key={fault.code}
                className={`rounded-full px-3 py-1 text-xs ${
                  fault.severity === 'error'
                    ? 'border border-rose-500/40 bg-rose-500/10 text-rose-200'
                    : fault.severity === 'warning'
                      ? 'border border-amber-500/40 bg-amber-500/10 text-amber-200'
                      : 'border border-sky-500/40 bg-sky-500/10 text-sky-200'
                }`}
              >
                {fault.code}: {fault.description}
              </span>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
