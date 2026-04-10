export type OperatingMode = 'heating' | 'cooling' | 'dhw' | 'standby' | 'defrost'
export type FaultSeverity = 'info' | 'warning' | 'error'

export interface FaultCode {
  code: string
  description: string
  severity: FaultSeverity
}

export interface HeatpumpSnapshot {
  flowTemp: number
  returnTemp: number
  outdoorTemp: number
  dhwTemp: number
  dhwSetpoint: number
  sourceInletTemp: number
  sourceOutletTemp: number
  bufferTemp: number | null
  cop: number
  compressorFreq: number
  primaryPumpSpeed: number
  secondaryPumpSpeed: number | null
  fanSpeed: number | null
  operatingMode: OperatingMode
  faultCodes: FaultCode[]
  energyOutputToday: number
  energyOutputMonth: number
  energyConsumedToday: number
  energyConsumedMonth: number
  runHoursToday: number
  online: boolean
  lastUpdated: string
}

export interface HistoryPoint {
  timestamp: string
  flowTemp: number
  returnTemp: number
  outdoorTemp: number
  dhwTemp: number
  cop: number
  electricalConsumedKWh: number
  thermalOutputKWh: number
}

export interface EventLogEntry {
  timestamp: string
  code: string
  description: string
  severity: FaultSeverity
}

export interface DailyEnergyPoint {
  date: string
  electricalConsumedKWh: number
  thermalOutputKWh: number
  averageCop: number
}

export interface HistorySummary {
  totalElectricalConsumed: number
  totalThermalOutput: number
  averageCop: number
  runHours: number
}

export interface HeatpumpHistoryResponse {
  from: string
  to: string
  points: HistoryPoint[]
  dailyEnergy: DailyEnergyPoint[]
  summary: HistorySummary
  events: EventLogEntry[]
  estimated: boolean
  note?: string
}
