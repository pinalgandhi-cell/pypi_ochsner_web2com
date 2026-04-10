import { generateMockHistory, generateMockSnapshot } from '@/lib/mockData'
import { readHeatpumpFromModbus } from '@/lib/modbusClient'
import type { EventLogEntry, HeatpumpHistoryResponse, HeatpumpSnapshot } from '@/lib/types'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits))
}

async function fetchRestSnapshot(): Promise<HeatpumpSnapshot> {
  const endpoint = process.env.HEATPUMP_REST_URL
  if (!endpoint) {
    throw new Error('HEATPUMP_REST_URL is not configured')
  }

  const headers: HeadersInit = {}
  if (process.env.HEATPUMP_REST_API_KEY) {
    headers['x-api-key'] = process.env.HEATPUMP_REST_API_KEY
    headers.Authorization = `Bearer ${process.env.HEATPUMP_REST_API_KEY}`
  }

  const response = await fetch(endpoint, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`REST data source returned ${response.status}`)
  }

  return (await response.json()) as HeatpumpSnapshot
}

function stepForSpan(spanMs: number): number {
  if (spanMs <= 48 * HOUR_MS) {
    return HOUR_MS
  }
  if (spanMs <= 7 * DAY_MS) {
    return 6 * HOUR_MS
  }
  return DAY_MS
}

function createEstimatedEvents(snapshot: HeatpumpSnapshot, from: Date, to: Date): EventLogEntry[] {
  const templates: EventLogEntry[] = [
    {
      timestamp: to.toISOString(),
      code: 'INF-RUN',
      description: 'Compressor cycle recorded',
      severity: 'info',
    },
    {
      timestamp: new Date(to.getTime() - 8 * HOUR_MS).toISOString(),
      code: 'INF-DHW',
      description: 'DHW reheating demand satisfied',
      severity: 'info',
    },
    {
      timestamp: new Date(to.getTime() - 16 * HOUR_MS).toISOString(),
      code: 'WRN-SRC',
      description: 'Estimated source temperature dip',
      severity: 'warning',
    },
    {
      timestamp: new Date(to.getTime() - 28 * HOUR_MS).toISOString(),
      code: 'INF-PMP',
      description: 'Primary pump speed modulation update',
      severity: 'info',
    },
  ]

  for (const fault of snapshot.faultCodes) {
    templates.unshift({
      timestamp: to.toISOString(),
      code: fault.code,
      description: fault.description,
      severity: fault.severity,
    })
  }

  return templates
    .filter((entry) => new Date(entry.timestamp).getTime() >= from.getTime())
    .slice(0, 20)
}

function buildEstimatedHistory(snapshot: HeatpumpSnapshot, from: Date, to: Date): HeatpumpHistoryResponse {
  const spanMs = to.getTime() - from.getTime()
  const stepMs = stepForSpan(spanMs)
  const points = []
  const dailyEnergy = []
  let totalElectricalConsumed = 0
  let totalThermalOutput = 0
  const baseDailyElectrical = snapshot.energyConsumedToday || clamp(snapshot.energyConsumedMonth / Math.max(new Date(snapshot.lastUpdated).getUTCDate(), 1), 4, 40)

  for (let cursor = from.getTime(); cursor <= to.getTime(); cursor += stepMs) {
    const progress = spanMs > 0 ? (cursor - from.getTime()) / spanMs : 1
    const wave = Math.sin(progress * Math.PI * 2)
    const electricalConsumedKWh = round((baseDailyElectrical / 24) * (stepMs / HOUR_MS) * (0.85 + wave * 0.15), 2)
    const outdoorTemp = round(snapshot.outdoorTemp + wave * 2.4, 1)
    const flowTemp = round(snapshot.flowTemp - wave * 1.1, 1)
    const returnTemp = round(snapshot.returnTemp - wave * 0.8, 1)
    const dhwTemp = round(snapshot.dhwTemp + Math.cos(progress * Math.PI * 4) * 1.5, 1)
    const cop = round(clamp(snapshot.cop + outdoorTemp / 50 - snapshot.outdoorTemp / 50, 2.2, 4.8), 2)
    const thermalOutputKWh = round(electricalConsumedKWh * cop, 2)

    totalElectricalConsumed += electricalConsumedKWh
    totalThermalOutput += thermalOutputKWh
    points.push({
      timestamp: new Date(cursor).toISOString(),
      flowTemp,
      returnTemp,
      outdoorTemp,
      dhwTemp,
      cop,
      electricalConsumedKWh,
      thermalOutputKWh,
    })
  }

  for (let cursor = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()); cursor <= to.getTime(); cursor += DAY_MS) {
    const date = new Date(cursor)
    const seasonalDrift = Math.sin(cursor / (5 * DAY_MS)) * 0.14 + 1
    const electricalConsumedKWh = round(baseDailyElectrical * seasonalDrift, 2)
    const averageCop = round(clamp(snapshot.cop + Math.cos(cursor / (3 * DAY_MS)) * 0.2, 2.3, 4.8), 2)
    const thermalOutputKWh = round(electricalConsumedKWh * averageCop, 2)
    dailyEnergy.push({
      date: date.toISOString().slice(0, 10),
      electricalConsumedKWh,
      thermalOutputKWh,
      averageCop,
    })
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    points,
    dailyEnergy,
    summary: {
      totalElectricalConsumed: round(totalElectricalConsumed, 2),
      totalThermalOutput: round(totalThermalOutput, 2),
      averageCop: totalElectricalConsumed > 0 ? round(totalThermalOutput / totalElectricalConsumed, 2) : 0,
      runHours: round((snapshot.runHoursToday / 24) * Math.max(spanMs / HOUR_MS, 1), 1),
    },
    events: createEstimatedEvents(snapshot, from, to),
    estimated: true,
    note: 'History is derived from live counters and current operating conditions because no persistent historian is configured.',
  }
}

export async function getCurrentHeatpumpSnapshot(): Promise<HeatpumpSnapshot> {
  const source = process.env.HEATPUMP_DATA_SOURCE ?? 'mock'

  if (source === 'mock') {
    return generateMockSnapshot()
  }

  if (source === 'rest') {
    return fetchRestSnapshot()
  }

  return readHeatpumpFromModbus()
}

export async function getHeatpumpHistory(from: Date, to: Date): Promise<HeatpumpHistoryResponse> {
  const source = process.env.HEATPUMP_DATA_SOURCE ?? 'mock'

  if (source === 'mock') {
    return generateMockHistory(from, to)
  }

  const snapshot = await getCurrentHeatpumpSnapshot()
  return buildEstimatedHistory(snapshot, from, to)
}
