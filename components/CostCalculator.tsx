'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'

import { calculateCost } from '@/lib/ovoTariff'
import type { HeatpumpHistoryResponse } from '@/lib/types'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`)
  }
  return response.json()
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatUkDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00.000Z`))
}

function statCard(label: string, value: string, subtitle?: string) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  )
}

export function CostCalculator() {
  const today = new Date()
  const defaultFrom = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
  const [from, setFrom] = useState(formatDateInput(defaultFrom))
  const [to, setTo] = useState(formatDateInput(today))

  const {
    data: history,
    error: historyError,
    isLoading: historyLoading,
  } = useSWR<HeatpumpHistoryResponse>(`/api/heatpump/history?from=${from}&to=${to}`, fetcher, {
    refreshInterval: 30_000,
  })

  const {
    data: tariffData,
    error: tariffError,
  } = useSWR(`/api/tariff?from=${from}&to=${to}`, fetcher, {
    refreshInterval: 30_000,
  })

  const cost = useMemo(() => {
    if (!history) {
      return null
    }

    return calculateCost(
      history.summary.totalElectricalConsumed,
      new Date(`${from}T00:00:00.000Z`),
      new Date(`${to}T00:00:00.000Z`)
    )
  }, [from, history, to])

  const effectiveCostPerHeatKWh = useMemo(() => {
    if (!history || !cost || history.summary.totalThermalOutput <= 0) {
      return null
    }

    return cost.totalCostPounds / history.summary.totalThermalOutput
  }, [cost, history])

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-50">Cost calculator</h2>
        <p className="text-sm text-slate-400">
          Estimate electricity cost between two dates using the OVO Simpler Energy SVT unit rate.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[auto_auto_1fr]">
        <label className="space-y-2">
          <span className="text-sm text-slate-300">From</span>
          <input
            aria-label="From date"
            type="date"
            lang="en-GB"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
          />
          <p className="text-xs text-slate-500">Selected: {formatUkDate(from)}</p>
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">To</span>
          <input
            aria-label="To date"
            type="date"
            lang="en-GB"
            value={to}
            min={from}
            max={formatDateInput(today)}
            onChange={(event) => setTo(event.target.value)}
          />
          <p className="text-xs text-slate-500">Selected: {formatUkDate(to)}</p>
        </label>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm text-slate-400">Tariff rate display</p>
          {tariffError ? (
            <p className="mt-2 text-sm text-rose-300">Unable to load tariff periods.</p>
          ) : tariffData?.selectedRates?.length ? (
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              {tariffData.selectedRates.map(
                (period: { from: string; to: string; unitRate: number; standingCharge: number }) => (
                  <li key={`${period.from}-${period.to}`}>
                    {formatUkDate(period.from)} → {formatUkDate(period.to)}: {period.unitRate.toFixed(2)}p/kWh
                    <span className="text-slate-500"> • standing charge {period.standingCharge.toFixed(2)}p/day</span>
                  </li>
                )
              )}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">No tariff entries overlap the selected period.</p>
          )}
        </div>
      </div>

      {historyError ? (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          Failed to load the historical energy data required for the calculation.
        </div>
      ) : historyLoading ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-800/70" />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCard(
            'Total kWh consumed',
            history ? `${history.summary.totalElectricalConsumed.toFixed(2)} kWh` : '—'
          )}
          {statCard('Estimated cost', cost ? `£${cost.totalCostPounds.toFixed(2)}` : '—', cost ? `${cost.blendedUnitRatePence.toFixed(2)}p blended unit rate` : undefined)}
          {statCard('Average COP', history ? history.summary.averageCop.toFixed(2) : '—')}
          {statCard(
            'Effective cost per kWh of heat',
            effectiveCostPerHeatKWh !== null ? `£${effectiveCostPerHeatKWh.toFixed(3)}` : '—',
            'Calculated from total cost ÷ delivered heat'
          )}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <p className="text-sm text-slate-400">Calculation basis</p>
        {cost?.breakdown?.length ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {cost.breakdown.map((line) => (
              <li key={`${line.from}-${line.to}`}>
                {formatUkDate(line.from)} → {formatUkDate(line.to)}: {line.kWh.toFixed(2)} kWh × {line.unitRate.toFixed(2)}p = £
                {line.costPounds.toFixed(2)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-400">Select a valid date range to calculate cost.</p>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Rates shown are OVO Simpler Energy SVT. Prices vary by region. Always confirm your personal rate in your OVO account.
      </p>
    </section>
  )
}
