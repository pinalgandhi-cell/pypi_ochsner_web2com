import ModbusRTU from 'modbus-serial'

import type { FaultCode, HeatpumpSnapshot, OperatingMode } from '@/lib/types'

interface RegisterDefinition {
  address: number
  scale?: number
}

const REGISTER_MAP = {
  flowTemp: { address: 1000, scale: 10 }, // TODO: confirm register address for flow temperature
  returnTemp: { address: 1001, scale: 10 }, // TODO: confirm register address for return temperature
  outdoorTemp: { address: 1002, scale: 10 }, // TODO: confirm register address for outdoor ambient temperature
  dhwTemp: { address: 1003, scale: 10 }, // TODO: confirm register address for DHW temperature
  dhwSetpoint: { address: 1004, scale: 10 }, // TODO: confirm register address for DHW setpoint temperature
  sourceInletTemp: { address: 1005, scale: 10 }, // TODO: confirm register address for source inlet temperature
  sourceOutletTemp: { address: 1006, scale: 10 }, // TODO: confirm register address for source outlet temperature
  bufferTemp: { address: 1007, scale: 10 }, // TODO: confirm register address for buffer/storage tank temperature
  cop: { address: 1008, scale: 100 }, // TODO: confirm register address for current COP
  compressorFreq: { address: 1009, scale: 10 }, // TODO: confirm register address for compressor frequency
  primaryPumpSpeed: { address: 1010, scale: 10 }, // TODO: confirm register address for primary pump speed
  secondaryPumpSpeed: { address: 1011, scale: 10 }, // TODO: confirm register address for secondary pump speed
  fanSpeed: { address: 1012, scale: 10 }, // TODO: confirm register address for fan speed
  operatingMode: { address: 1013 }, // TODO: confirm register address for operating mode
  activeFaultCode: { address: 1014 }, // TODO: confirm register address for active fault code
  energyOutputToday: { address: 1015, scale: 10 }, // TODO: confirm register address for thermal output today
  energyOutputMonth: { address: 1016, scale: 10 }, // TODO: confirm register address for thermal output month
  energyConsumedToday: { address: 1017, scale: 10 }, // TODO: confirm register address for electrical consumption today
  energyConsumedMonth: { address: 1018, scale: 10 }, // TODO: confirm register address for electrical consumption month
  runHoursToday: { address: 1019, scale: 10 }, // TODO: confirm register address for run hours today
} as const satisfies Record<string, RegisterDefinition>

const MODE_MAP: Record<number, OperatingMode> = {
  0: 'standby',
  1: 'heating',
  2: 'cooling',
  3: 'dhw',
  4: 'defrost',
}

const FAULT_MAP: Record<number, FaultCode> = {
  0: { code: 'OK', description: 'No active fault', severity: 'info' },
  17: { code: 'WRN-SRC', description: 'Source temperature low', severity: 'warning' },
  42: { code: 'ERR-COM', description: 'Communications timeout', severity: 'error' },
  83: { code: 'INF-DFR', description: 'Defrost cycle active', severity: 'info' },
}

async function closeClient(client: ModbusRTU): Promise<void> {
  await new Promise<void>((resolve) => {
    client.close(() => resolve())
  })
}

async function readRegister(client: ModbusRTU, definition: RegisterDefinition): Promise<number> {
  const response = await client.readHoldingRegisters(definition.address, 1)
  const value = response.data[0]
  return definition.scale ? value / definition.scale : value
}

export async function readHeatpumpFromModbus(): Promise<HeatpumpSnapshot> {
  const host = process.env.MODBUS_HOST
  const port = Number(process.env.MODBUS_PORT ?? 502)
  const unitId = Number(process.env.MODBUS_UNIT_ID ?? 1)

  if (!host) {
    throw new Error('MODBUS_HOST is not configured')
  }

  const client = new ModbusRTU()

  try {
    await client.connectTCP(host, { port })
    client.setID(unitId)
    client.setTimeout(4000)

    const [
      flowTemp,
      returnTemp,
      outdoorTemp,
      dhwTemp,
      dhwSetpoint,
      sourceInletTemp,
      sourceOutletTemp,
      bufferTemp,
      cop,
      compressorFreq,
      primaryPumpSpeed,
      secondaryPumpSpeed,
      fanSpeed,
      operatingModeRaw,
      activeFaultCodeRaw,
      energyOutputToday,
      energyOutputMonth,
      energyConsumedToday,
      energyConsumedMonth,
      runHoursToday,
    ] = await Promise.all([
      readRegister(client, REGISTER_MAP.flowTemp),
      readRegister(client, REGISTER_MAP.returnTemp),
      readRegister(client, REGISTER_MAP.outdoorTemp),
      readRegister(client, REGISTER_MAP.dhwTemp),
      readRegister(client, REGISTER_MAP.dhwSetpoint),
      readRegister(client, REGISTER_MAP.sourceInletTemp),
      readRegister(client, REGISTER_MAP.sourceOutletTemp),
      readRegister(client, REGISTER_MAP.bufferTemp),
      readRegister(client, REGISTER_MAP.cop),
      readRegister(client, REGISTER_MAP.compressorFreq),
      readRegister(client, REGISTER_MAP.primaryPumpSpeed),
      readRegister(client, REGISTER_MAP.secondaryPumpSpeed),
      readRegister(client, REGISTER_MAP.fanSpeed),
      readRegister(client, REGISTER_MAP.operatingMode),
      readRegister(client, REGISTER_MAP.activeFaultCode),
      readRegister(client, REGISTER_MAP.energyOutputToday),
      readRegister(client, REGISTER_MAP.energyOutputMonth),
      readRegister(client, REGISTER_MAP.energyConsumedToday),
      readRegister(client, REGISTER_MAP.energyConsumedMonth),
      readRegister(client, REGISTER_MAP.runHoursToday),
    ])

    const resolvedFault = FAULT_MAP[Math.trunc(activeFaultCodeRaw)]

    return {
      flowTemp,
      returnTemp,
      outdoorTemp,
      dhwTemp,
      dhwSetpoint,
      sourceInletTemp,
      sourceOutletTemp,
      bufferTemp: bufferTemp <= -999 ? null : bufferTemp,
      cop,
      compressorFreq,
      primaryPumpSpeed,
      secondaryPumpSpeed: secondaryPumpSpeed <= 0 ? null : secondaryPumpSpeed,
      fanSpeed: fanSpeed <= 0 ? null : fanSpeed,
      operatingMode: MODE_MAP[Math.trunc(operatingModeRaw)] ?? 'standby',
      faultCodes: resolvedFault && resolvedFault.code !== 'OK' ? [resolvedFault] : [],
      energyOutputToday,
      energyOutputMonth,
      energyConsumedToday,
      energyConsumedMonth,
      runHoursToday,
      online: true,
      lastUpdated: new Date().toISOString(),
    }
  } finally {
    await closeClient(client)
  }
}
