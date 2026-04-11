'use client'

import Link from 'next/link'
import { useState } from 'react'
import useSWR from 'swr'

import { ComponentStatus } from '@/components/ComponentStatus'
import { CostCalculator } from '@/components/CostCalculator'
import { EnergyPanel } from '@/components/EnergyPanel'
import { FaultLog } from '@/components/FaultLog'
import { MetricCards } from '@/components/MetricCards'
import { StatusBar } from '@/components/StatusBar'
import { TrendChart } from '@/components/TrendChart'
import type { HeatpumpHistoryResponse, HeatpumpSnapshot } from '@/lib/types'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`)
  }
  return response.json()
}

const RANGE_OPTIONS = ['1h', '6h', '24h', '7d'] as const
type RangeOption = (typeof RANGE_OPTIONS)[number]

function TemperatureOverview({ data }: { data?: HeatpumpSnapshot }) {
  const rows = [
    ['Source inlet', data ? `${data.sourceInletTemp.toFixed(1)}°C` : '—'],
    ['Source outlet', data ? `${data.sourceOutletTemp.toFixed(1)}°C` : '—'],
    ['DHW current / setpoint', data ? `${data.dhwTemp.toFixed(1)}°C / ${data.dhwSetpoint.toFixed(1)}°C` : '—'],
    ['Buffer tank', data ? (data.bufferTemp === null ? 'N/A' : `${data.bufferTemp.toFixed(1)}°C`) : '—'],
  ]

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-50">Temperature overview</h2>
        <p className="text-sm text-slate-400">Key source, DHW, and storage temperatures.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeOption>('24h')
  const {
    data,
    error,
    isLoading,
  } = useSWR<HeatpumpSnapshot>('/api/heatpump', fetcher, {
    refreshInterval: 30_000,
  })

  const {
    data: history,
    error: historyError,
  } = useSWR<HeatpumpHistoryResponse>(`/api/heatpump/history?range=${range}`, fetcher, {
    refreshInterval: 30_000,
  })

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-sky-300">Read-only monitoring dashboard</p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-50">Ochsner heat pump system</h1>
              <p className="max-w-3xl text-sm text-slate-400">
                Polling every 30 seconds with server-side route handlers. Saved Web2Com credentials from the admin page are used when present; otherwise the dashboard falls back to the configured environment data source.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
            >
              Admin connection settings
            </Link>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            The dashboard could not reach the current heat pump endpoint. Check the saved Web2Com connection under Admin connection settings, or fall back to the environment-based data source.
          </div>
        ) : null}
        {historyError ? (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            Historical charting data is unavailable. Live metrics may still be current.
          </div>
        ) : null}

        <StatusBar data={data} />
        <MetricCards data={data} />
        <TemperatureOverview data={data} />
        <TrendChart history={history} range={range} onRangeChange={setRange} />
        <EnergyPanel data={data} history={history} />
        <ComponentStatus data={data} />
        <FaultLog events={history?.events} />
        <CostCalculator />

        {isLoading && !data ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
            Loading live heat pump data...
          </div>
        ) : null}
      </div>
    </main>
  )
}
