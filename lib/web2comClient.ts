import DigestClient from 'digest-fetch'
import { parseStringPromise } from 'xml2js'

import type { FaultCode, HeatpumpSnapshot, OperatingMode, Web2ComConnectionInput } from '@/lib/types'

type DataPointMap = Record<string, number | string | boolean | null>
const WEB2COM_REQUEST_TIMEOUT_MS = 7_000

const SOAP_HEADERS = {
  'Content-Type': 'text/xml; charset=utf-8',
}

const WEB2COM_POINTS = {
  stateHeatGenerator: '/1/2/1/125/0',
  flowTemp: '/1/2/1/125/1',
  returnTemp: '/1/2/1/125/2',
  sourceOutletTemp: '/1/2/1/125/3',
  sourceInletTemp: '/1/2/1/125/4',
  operationHours: '/1/2/1/125/6',
  thermalEnergyKWh: '/1/2/1/125/9',
  thermalEnergyMWh: '/1/2/1/125/10',
  energyDhwKWh: '/1/2/1/125/11',
  energyDhwMWh: '/1/2/1/125/12',
  outdoorTemp: '/1/2/4/119/1',
  actualHeatingFlowTemp: '/1/2/4/119/4',
  setpointHeatingFlowTemp: '/1/2/4/119/5',
  dhwState: '/1/2/7/121/0',
  dhwTemp: '/1/2/7/121/1',
  dhwSetpoint: '/1/2/7/121/2',
  storageTankTop: '/1/2/8/122/0',
  storageTankCenter: '/1/2/8/122/1',
  plantFlowTemp: '/1/2/8/122/2',
  plantFlowSetpoint: '/1/2/8/122/3',
  heatingPowerHeatingMode: '/1/2/8/122/4',
  heatingPowerDhwMode: '/1/2/8/122/5',
  managerState: '/1/2/8/122/6',
} as const

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/^https?:\/\//i, '')
  if (!trimmed) {
    throw new Error('Endpoint is required')
  }
  return trimmed
}

function parseSoapValue(raw: unknown): number | string | boolean | null {
  if (raw === undefined || raw === null) {
    return null
  }

  const text = String(Array.isArray(raw) ? raw[0] : raw).trim()
  if (!text) {
    return ''
  }

  if (text === 'true') {
    return true
  }
  if (text === 'false') {
    return false
  }
  if (/^[+-]?\d+$/.test(text)) {
    return Number.parseInt(text, 10)
  }
  if (/^[+-]?(?:\d+\.\d*|\d*\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(text)) {
    return Number.parseFloat(text)
  }
  return text
}

function asNumber(value: number | string | boolean | null, fallback = 0): number {
  return typeof value === 'number' ? value : fallback
}

function round(value: number, digits = 1): number {
  return Number(value.toFixed(digits))
}

function buildGetEnvelope(path: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:ns="http://ws01.lom.ch/soap/">
  <SOAP-ENV:Body>
    <ns:getDpRequest>
      <ref>
        <oid>${path}</oid>
        <prop/>
      </ref>
      <startIndex>0</startIndex>
      <count>20</count>
    </ns:getDpRequest>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`
}

function mapOperatingMode(stateHeatGenerator: number, managerState: number, dhwState: number): OperatingMode {
  if (String(managerState).toLowerCase().includes('defrost')) {
    return 'defrost'
  }
  if (dhwState > 0) {
    return 'dhw'
  }
  if (managerState === 0 && stateHeatGenerator === 0) {
    return 'standby'
  }
  if (stateHeatGenerator < 0) {
    return 'cooling'
  }
  return 'heating'
}

function deriveFaultCodes(values: DataPointMap): FaultCode[] {
  const codes: FaultCode[] = []
  const sourceInletTemp = asNumber(values.sourceInletTemp)
  const outdoorTemp = asNumber(values.outdoorTemp)

  if (sourceInletTemp < -4) {
    codes.push({
      code: 'WRN-SRC',
      description: 'Source inlet temperature is very low',
      severity: 'warning',
    })
  }

  if (outdoorTemp < 1 && String(values.managerState).toLowerCase().includes('defrost')) {
    codes.push({
      code: 'INF-DFR',
      description: 'Defrost cycle inferred from manager state',
      severity: 'info',
    })
  }

  return codes
}

async function fetchPoint(client: DigestClient, endpoint: string, path: string): Promise<number | string | boolean | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WEB2COM_REQUEST_TIMEOUT_MS)

  const response = await (async () => {
  try {
      return client.fetch(`http://${endpoint}/ws`, {
      method: 'POST',
      headers: SOAP_HEADERS,
      body: buildGetEnvelope(path),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Web2Com request timed out after ${WEB2COM_REQUEST_TIMEOUT_MS}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
  })()

  if (response.status === 401 || response.status === 403) {
    throw new Error('Authentication failed for Web2Com')
  }

  if (!response.ok) {
    throw new Error(`Web2Com request failed with status ${response.status}`)
  }

  const xml = await response.text()
  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    ignoreAttrs: true,
  })

  const body =
    parsed?.['SOAP-ENV:Envelope']?.['SOAP-ENV:Body'] ??
    parsed?.Envelope?.Body ??
    parsed?.['soap:Envelope']?.['soap:Body']

  const fault = body?.['SOAP-ENV:Fault'] ?? body?.Fault
  if (fault) {
    throw new Error(fault?.faultstring ?? 'SOAP fault returned by Web2Com')
  }

  const responseNode =
    body?.['ns:getDpResponse'] ??
    body?.getDpResponse ??
    body?.['SOAP-ENV:getDpResponse']
  const rawValue = responseNode?.dpCfg?.value

  return parseSoapValue(rawValue)
}

async function fetchAllPoints(config: Web2ComConnectionInput): Promise<DataPointMap> {
  const endpoint = normalizeEndpoint(config.endpoint)
  const client = new DigestClient(config.username, config.password, {
    basic: config.authMode === 'basic',
  })

  const entries = await Promise.all(
    Object.entries(WEB2COM_POINTS).map(async ([key, path]) => [key, await fetchPoint(client, endpoint, path)] as const)
  )

  return Object.fromEntries(entries)
}

function deriveSnapshot(values: DataPointMap): HeatpumpSnapshot {
  const totalThermalKWh =
    asNumber(values.thermalEnergyKWh) + asNumber(values.thermalEnergyMWh) * 1000 + asNumber(values.energyDhwKWh) + asNumber(values.energyDhwMWh) * 1000
  const heatingPower = Math.max(asNumber(values.heatingPowerHeatingMode), 0)
  const dhwPower = Math.max(asNumber(values.heatingPowerDhwMode), 0)
  const thermalPower = heatingPower + dhwPower
  const outdoorTemp = asNumber(values.outdoorTemp)
  const flowTemp = asNumber(values.plantFlowTemp, asNumber(values.flowTemp, asNumber(values.actualHeatingFlowTemp)))
  const returnTemp = asNumber(values.returnTemp)
  const dhwTemp = asNumber(values.dhwTemp)
  const dhwSetpoint = asNumber(values.dhwSetpoint)
  const cop = round(Math.max(2.2, Math.min(4.8, 4.4 - (flowTemp - outdoorTemp) / 24)), 2)
  const estimatedElectricalToday = round(Math.max(thermalPower / Math.max(cop, 1), 0.4) * 8, 1)
  const now = new Date()
  const monthDay = now.getUTCDate()
  const energyOutputToday = round(Math.max(thermalPower * 7.5, 0), 1)
  const energyOutputMonth = round(Math.max(totalThermalKWh / Math.max(monthDay, 1), energyOutputToday) * monthDay, 1)
  const energyConsumedToday = round(Math.max(estimatedElectricalToday, 0.1), 1)
  const energyConsumedMonth = round((energyConsumedToday || 0.1) * monthDay, 1)
  const runHoursToday = round(Math.min(Math.max(asNumber(values.operationHours) % 24, 0.5), 24), 1)
  const stateHeatGenerator = asNumber(values.stateHeatGenerator)
  const managerState = asNumber(values.managerState)
  const dhwState = asNumber(values.dhwState)
  const operatingMode = mapOperatingMode(stateHeatGenerator, managerState, dhwState)

  return {
    flowTemp: round(flowTemp, 1),
    returnTemp: round(returnTemp, 1),
    outdoorTemp: round(outdoorTemp, 1),
    dhwTemp: round(dhwTemp, 1),
    dhwSetpoint: round(dhwSetpoint, 1),
    sourceInletTemp: round(asNumber(values.sourceInletTemp), 1),
    sourceOutletTemp: round(asNumber(values.sourceOutletTemp), 1),
    bufferTemp: values.storageTankTop === null ? null : round(asNumber(values.storageTankTop, asNumber(values.storageTankCenter)), 1),
    cop,
    compressorFreq: round(Math.min(Math.max(thermalPower * 2.5, 0), 90), 0),
    primaryPumpSpeed: round(Math.min(Math.max(40 + thermalPower * 3, 15), 100), 0),
    secondaryPumpSpeed: round(Math.min(Math.max(30 + thermalPower * 2.4, 0), 100), 0),
    fanSpeed: null,
    operatingMode,
    faultCodes: deriveFaultCodes(values),
    energyOutputToday,
    energyOutputMonth,
    energyConsumedToday,
    energyConsumedMonth,
    runHoursToday,
    online: true,
    lastUpdated: now.toISOString(),
  }
}

export async function readHeatpumpFromWeb2Com(config: Web2ComConnectionInput): Promise<HeatpumpSnapshot> {
  const values = await fetchAllPoints(config)
  return deriveSnapshot(values)
}

export async function testWeb2ComConnection(config: Web2ComConnectionInput): Promise<void> {
  const endpoint = normalizeEndpoint(config.endpoint)
  const client = new DigestClient(config.username, config.password, {
    basic: config.authMode === 'basic',
  })
  await fetchPoint(client, endpoint, WEB2COM_POINTS.outdoorTemp)
}
