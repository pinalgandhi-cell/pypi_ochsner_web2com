export interface TariffPeriod {
  from: string
  to: string
  unitRate: number
  standingCharge: number
}

export interface CostBreakdownLine {
  from: string
  to: string
  days: number
  kWh: number
  unitRate: number
  costPounds: number
}

export interface CostResult {
  totalCostPounds: number
  blendedUnitRatePence: number
  breakdown: CostBreakdownLine[]
}

export const OVO_SVT_RATES: TariffPeriod[] = [
  { from: '2025-01-01', to: '2025-03-31', unitRate: 24.50, standingCharge: 61.64 },
  { from: '2025-04-01', to: '2025-06-30', unitRate: 24.99, standingCharge: 53.94 },
  { from: '2025-07-01', to: '2025-09-30', unitRate: 25.00, standingCharge: 53.94 },
  { from: '2025-10-01', to: '2025-12-31', unitRate: 24.99, standingCharge: 53.94 },
  { from: '2026-01-01', to: '2026-03-31', unitRate: 26.34, standingCharge: 61.64 },
  { from: '2026-04-01', to: '2026-06-30', unitRate: 24.67, standingCharge: 57.21 },
]

const DAY_MS = 24 * 60 * 60 * 1000

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function overlapDays(fromDate: Date, toDate: Date, period: TariffPeriod): number {
  const rangeStart = startOfDay(fromDate)
  const rangeEnd = startOfDay(toDate)
  const periodStart = parseDate(period.from)
  const periodEnd = parseDate(period.to)
  const overlapStart = Math.max(rangeStart.getTime(), periodStart.getTime())
  const overlapEnd = Math.min(rangeEnd.getTime(), periodEnd.getTime())

  if (overlapEnd < overlapStart) {
    return 0
  }

  return Math.floor((overlapEnd - overlapStart) / DAY_MS) + 1
}

export function getRateForDate(date: Date): TariffPeriod | null {
  const normalized = startOfDay(date).getTime()
  return (
    OVO_SVT_RATES.find((period) => {
      const from = parseDate(period.from).getTime()
      const to = parseDate(period.to).getTime()
      return normalized >= from && normalized <= to
    }) ?? null
  )
}

export function calculateCost(kWh: number, fromDate: Date, toDate: Date): CostResult {
  const normalizedStart = startOfDay(fromDate)
  const normalizedEnd = startOfDay(toDate)

  if (normalizedEnd < normalizedStart || kWh <= 0) {
    return {
      totalCostPounds: 0,
      blendedUnitRatePence: 0,
      breakdown: [],
    }
  }

  const totalDays = Math.floor((normalizedEnd.getTime() - normalizedStart.getTime()) / DAY_MS) + 1
  const kWhPerDay = kWh / totalDays
  const breakdown = OVO_SVT_RATES.flatMap((period) => {
    const days = overlapDays(normalizedStart, normalizedEnd, period)
    if (days === 0) {
      return []
    }

    const periodStart = new Date(Math.max(parseDate(period.from).getTime(), normalizedStart.getTime()))
    const periodEnd = new Date(Math.min(parseDate(period.to).getTime(), normalizedEnd.getTime()))
    const periodKWh = kWhPerDay * days
    const costPounds = (periodKWh * period.unitRate) / 100

    return [
      {
        from: formatDate(periodStart),
        to: formatDate(periodEnd),
        days,
        kWh: Number(periodKWh.toFixed(2)),
        unitRate: period.unitRate,
        costPounds: Number(costPounds.toFixed(2)),
      },
    ]
  })

  const totalCostPounds = Number(
    breakdown.reduce((sum, item) => sum + item.costPounds, 0).toFixed(2)
  )
  const blendedUnitRatePence = kWh > 0 ? Number(((totalCostPounds * 100) / kWh).toFixed(2)) : 0

  return {
    totalCostPounds,
    blendedUnitRatePence,
    breakdown,
  }
}
