'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { HeatpumpHistoryResponse } from '@/lib/types'

type RangeOption = '1h' | '6h' | '24h' | '7d'

const rangeOptions: RangeOption[] = ['1h', '6h', '24h', '7d']

function formatTick(timestamp: string, range: RangeOption): string {
  const date = new Date(timestamp)
  return new Intl.DateTimeFormat('en-GB', {
    month: range === '7d' ? 'short' : undefined,
    day: range === '7d' ? 'numeric' : undefined,
    hour: range === '7d' ? undefined : '2-digit',
    minute: range === '1h' ? '2-digit' : undefined,
  }).format(date)
}

export function TrendChart({
  history,
  range,
  onRangeChange,
}: {
  history?: HeatpumpHistoryResponse
  range: RangeOption
  onRangeChange: (range: RangeOption) => void
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Performance trend</h2>
          <p className="text-sm text-slate-400">
            Flow, return, outdoor, and DHW temperatures with COP on a secondary axis.
          </p>
          {history?.note ? <p className="mt-1 text-xs text-amber-200">{history.note}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {rangeOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onRangeChange(option)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                option === range
                  ? 'bg-sky-500 text-slate-950'
                  : 'border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="h-80">
        {history?.points?.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history.points}>
              <CartesianGrid stroke="#243244" strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={(value) => formatTick(value, range)} stroke="#94a3b8" />
              <YAxis yAxisId="temp" stroke="#94a3b8" unit="°C" />
              <YAxis yAxisId="cop" orientation="right" stroke="#f59e0b" domain={[0, 6]} />
              <Tooltip
                labelFormatter={(value) =>
                  new Intl.DateTimeFormat('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(value))
                }
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.75rem',
                }}
              />
              <Legend />
              <Line yAxisId="temp" type="monotone" dataKey="flowTemp" name="Flow temp" stroke="#38bdf8" dot={false} strokeWidth={2} />
              <Line yAxisId="temp" type="monotone" dataKey="returnTemp" name="Return temp" stroke="#c084fc" dot={false} strokeWidth={2} />
              <Line yAxisId="temp" type="monotone" dataKey="outdoorTemp" name="Outdoor temp" stroke="#34d399" dot={false} strokeWidth={2} />
              <Line yAxisId="temp" type="monotone" dataKey="dhwTemp" name="DHW temp" stroke="#f97316" dot={false} strokeWidth={2} />
              <Line
                yAxisId="cop"
                type="monotone"
                dataKey="cop"
                name="COP"
                stroke="#f59e0b"
                dot={false}
                strokeDasharray="6 6"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-700 text-sm text-slate-400">
            No trend data available for the selected period.
          </div>
        )}
      </div>
    </section>
  )
}
