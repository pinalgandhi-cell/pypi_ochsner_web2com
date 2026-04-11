import type {
  EventLogEntry,
  HeatpumpHistoryResponse,
  HeatpumpSnapshot,
  OperatingMode,
} from '@/lib/types'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, digits = 1): number {
  return Number(value.toFixed(digits))
}

function seasonalComponent(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1)
  const dayOfYear = Math.floor((date.getTime() - start) / DAY_MS)
  return Math.cos((2 * Math.PI * (dayOfYear - 15)) / 365)
}

function dailyComponent(date: Date): number {
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60
  return Math.sin((2 * Math.PI * (hours - 5)) / 24)
}

function hashNoise(date: Date, scale: number): number {
  const bucket = Math.floor(date.getTime() / HOUR_MS)
  const x = Math.sin(bucket * 12.9898) * 43758.5453
  return (x - Math.floor(x) - 0.5) * scale
}

function inferMode(date: Date, outdoorTemp: number): OperatingMode {
  const seasonal = seasonalComponent(date)
  const hour = date.getUTCHours()
  const defrostWindow = outdoorTemp >= -3 && outdoorTemp <= 4 && Math.floor(date.getTime() / HOUR_MS) % 9 === 0

  if (defrostWindow) {
    return 'defrost'
  }

  if ((hour === 5 || hour === 13 || hour === 20) && seasonal > -0.6) {
    return 'dhw'
  }

  if (seasonal < -0.25 && outdoorTemp > 18) {
    return 'cooling'
  }

  if (outdoorTemp > 16 && hour >= 1 && hour <= 4) {
    return 'standby'
  }

  return 'heating'
}

function activeFaults(date: Date, mode: OperatingMode): HeatpumpSnapshot['faultCodes'] {
  const bucket = Math.floor(date.getTime() / (6 * HOUR_MS))
  const selector = bucket % 24

  if (mode === 'defrost') {
    return [
      {
        code: 'INF-DFR',
        description: 'Automatic defrost cycle active',
        severity: 'info',
      },
    ]
  }

  if (selector === 7) {
    return [
      {
        code: 'WRN-SRC',
        description: 'Source temperature approaching lower threshold',
        severity: 'warning',
      },
    ]
  }

  if (selector === 15) {
    return [
      {
        code: 'INF-DHW',
        description: 'Domestic hot water anti-legionella cycle scheduled',
        severity: 'info',
      },
    ]
  }

  return []
}

export function generateMockSnapshot(date = new Date()): HeatpumpSnapshot {
  const outdoorTemp = clamp(8 + seasonalComponent(date) * 11 + dailyComponent(date) * 4 + hashNoise(date, 1.2), -10, 28)
  const operatingMode = inferMode(date, outdoorTemp)
  const loadFactor = clamp((16 - outdoorTemp) / 22, 0.15, 1.1)
  const dhwSetpoint = 50
  const dhwDemandBoost = operatingMode === 'dhw' ? 8 : 0
  const flowTemp = operatingMode === 'cooling' ? 18 + loadFactor * 2 : 31 + loadFactor * 15 + dhwDemandBoost
  const returnTemp = flowTemp - (operatingMode === 'dhw' ? 5.5 : 4.2 + loadFactor * 1.4)
  const dhwTemp = clamp(45 + Math.sin(date.getTime() / (8 * HOUR_MS)) * 3 + (operatingMode === 'dhw' ? 6 : 0), 42, 57)
  const sourceInletTemp = clamp(outdoorTemp - 2.6 + seasonalComponent(date) * 1.6, -7, 16)
  const sourceOutletTemp = sourceInletTemp - 2.2
  const bufferTemp = operatingMode === 'standby' ? null : clamp(returnTemp + 1.5, 24, 48)
  const cop = clamp(4.55 - (flowTemp - outdoorTemp) / 23 + hashNoise(date, 0.2), 2.5, 4.5)
  const compressorFreq = operatingMode === 'standby' ? 0 : clamp(18 + loadFactor * 48 + (operatingMode === 'dhw' ? 8 : 0), 0, 78)
  const primaryPumpSpeed = operatingMode === 'standby' ? 0 : clamp(36 + loadFactor * 46, 0, 100)
  const secondaryPumpSpeed = operatingMode === 'standby' ? 0 : clamp(30 + loadFactor * 34, 0, 95)
  const fanSpeed = seasonalComponent(date) > 0.2 ? clamp(28 + loadFactor * 41, 0, 100) : null
  const dailyElectricalBase = clamp(9 + loadFactor * 22 + (operatingMode === 'dhw' ? 1.3 : 0), 6, 28)
  const monthDay = date.getUTCDate()
  const energyConsumedToday = round(dailyElectricalBase, 1)
  const energyOutputToday = round(energyConsumedToday * cop, 1)
  const energyConsumedMonth = round(
    monthDay * (8.7 + clamp(0.65 + seasonalComponent(date) * 0.55, 0.25, 1.35) * 10.8),
    1
  )
  const energyOutputMonth = round(energyConsumedMonth * clamp(cop - 0.2, 2.4, 4.3), 1)
  const runHoursToday = round(clamp(4.5 + loadFactor * 11 + hashNoise(date, 0.4), 0.5, 22), 1)

  return {
    flowTemp: round(flowTemp, 1),
    returnTemp: round(returnTemp, 1),
    outdoorTemp: round(outdoorTemp, 1),
    dhwTemp: round(dhwTemp, 1),
    dhwSetpoint,
    sourceInletTemp: round(sourceInletTemp, 1),
    sourceOutletTemp: round(sourceOutletTemp, 1),
    bufferTemp: bufferTemp === null ? null : round(bufferTemp, 1),
    cop: round(cop, 2),
    compressorFreq: round(compressorFreq, 0),
    primaryPumpSpeed: round(primaryPumpSpeed, 0),
    secondaryPumpSpeed: secondaryPumpSpeed === null ? null : round(secondaryPumpSpeed, 0),
    fanSpeed: fanSpeed === null ? null : round(fanSpeed, 0),
    operatingMode,
    faultCodes: activeFaults(date, operatingMode),
    energyOutputToday,
    energyOutputMonth,
    energyConsumedToday,
    energyConsumedMonth,
    runHoursToday,
    online: true,
    lastUpdated: date.toISOString(),
  }
}

function createEventLog(from: Date, to: Date): EventLogEntry[] {
  const templates: Omit<EventLogEntry, 'timestamp'>[] = [
    { code: 'INF-RUN', description: 'Compressor started', severity: 'info' },
    { code: 'INF-DHW', description: 'Domestic hot water cycle completed', severity: 'info' },
    { code: 'WRN-FLT', description: 'Filter differential pressure elevated', severity: 'warning' },
    { code: 'WRN-SRC', description: 'Source brine temperature low', severity: 'warning' },
    { code: 'ERR-COM', description: 'Transient Modbus communications timeout cleared', severity: 'error' },
  ]

  const events: EventLogEntry[] = []
  let cursor = to.getTime()
  let index = 0

  while (cursor >= from.getTime() && events.length < 20) {
    const template = templates[index % templates.length]
    events.push({
      ...template,
      timestamp: new Date(cursor).toISOString(),
    })
    cursor -= (6 + (index % 4) * 3) * HOUR_MS
    index += 1
  }

  return events
}

export function generateMockHistory(from: Date, to: Date): HeatpumpHistoryResponse {
  const spanMs = to.getTime() - from.getTime()
  const stepMs = spanMs <= 48 * HOUR_MS ? HOUR_MS : spanMs <= 7 * DAY_MS ? 6 * HOUR_MS : DAY_MS
  const points = []
  const dailyEnergy = []
  let totalElectricalConsumed = 0
  let totalThermalOutput = 0

  for (let cursor = from.getTime(); cursor <= to.getTime(); cursor += stepMs) {
    const snapshot = generateMockSnapshot(new Date(cursor))
    const stepHours = stepMs / HOUR_MS
    const electricalConsumedKWh = round((snapshot.energyConsumedToday / 24) * stepHours, 2)
    const thermalOutputKWh = round(electricalConsumedKWh * snapshot.cop, 2)

    totalElectricalConsumed += electricalConsumedKWh
    totalThermalOutput += thermalOutputKWh
    points.push({
      timestamp: new Date(cursor).toISOString(),
      flowTemp: snapshot.flowTemp,
      returnTemp: snapshot.returnTemp,
      outdoorTemp: snapshot.outdoorTemp,
      dhwTemp: snapshot.dhwTemp,
      cop: snapshot.cop,
      electricalConsumedKWh,
      thermalOutputKWh,
    })
  }

  for (let cursor = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()); cursor <= to.getTime(); cursor += DAY_MS) {
    const snapshot = generateMockSnapshot(new Date(cursor + 12 * HOUR_MS))
    dailyEnergy.push({
      date: new Date(cursor).toISOString().slice(0, 10),
      electricalConsumedKWh: snapshot.energyConsumedToday,
      thermalOutputKWh: snapshot.energyOutputToday,
      averageCop: snapshot.cop,
    })
  }

  const averageCop = totalElectricalConsumed > 0 ? totalThermalOutput / totalElectricalConsumed : 0

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    points,
    dailyEnergy,
    summary: {
      totalElectricalConsumed: round(totalElectricalConsumed, 2),
      totalThermalOutput: round(totalThermalOutput, 2),
      averageCop: round(averageCop, 2),
      runHours: round(dailyEnergy.reduce((sum, day) => sum + (day.averageCop > 0 ? day.electricalConsumedKWh / 2.2 : 0), 0), 1),
    },
    events: createEventLog(from, to),
    estimated: false,
  }
}
