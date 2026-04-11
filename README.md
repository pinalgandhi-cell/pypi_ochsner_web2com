# Ochsner heat pump monitoring dashboard

This repository now includes a read-only monitoring dashboard for an Ochsner heat pump system, built with Next.js 14 App Router for deployment on Vercel.

The existing Python package under `ochsner_web2com/` is still present in the repository. The dashboard is a separate web application added at the repository root.

## Stack

- Next.js 14 App Router
- Tailwind CSS v3
- Recharts for client-side charts
- SWR for 30-second polling
- Next.js Route Handlers under `app/api/...`
- `modbus-serial` for server-side Modbus/TCP access

## Features

- Full-width status bar with online/offline state, operating mode, last refresh, and active faults
- Key metric cards for flow, return, ambient temperature, and COP
- Temperature overview for source, DHW, and buffer/storage values
- Recharts trend view with `1h`, `6h`, `24h`, and `7d` ranges
- Energy and efficiency panel for daily/monthly thermal and electrical figures
- Compressor, pump, and fan status panel
- Fault and event log for the most recent 20 entries
- Cost calculator using OVO Simpler Energy SVT quarterly tariffs
- Mock development mode with realistic Ochsner-style simulated data

## Project structure

```text
/
├── app/
│   ├── api/
│   │   ├── heatpump/
│   │   │   ├── history/
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   └── tariff/
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ComponentStatus.tsx
│   ├── CostCalculator.tsx
│   ├── EnergyPanel.tsx
│   ├── FaultLog.tsx
│   ├── MetricCards.tsx
│   ├── StatusBar.tsx
│   └── TrendChart.tsx
├── lib/
│   ├── heatpumpData.ts
│   ├── mockData.ts
│   ├── modbusClient.ts
│   ├── ovoTariff.ts
│   └── types.ts
├── .env.local
├── next.config.js
├── postcss.config.js
├── tailwind.config.js
└── vercel.json
```

## Local development

### Prerequisites

- Node.js 18.17+ or 20+
- npm

### Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

By default, `.env.local` is configured for mock mode:

```env
HEATPUMP_DATA_SOURCE=mock
MODBUS_HOST=192.168.1.100
MODBUS_PORT=502
MODBUS_UNIT_ID=1
HEATPUMP_REST_URL=http://192.168.1.100/api/data
HEATPUMP_REST_API_KEY=
```

### Data source modes

`HEATPUMP_DATA_SOURCE` supports:

- `mock` — generated data for development
- `rest` — read-only fetch from `HEATPUMP_REST_URL`
- `modbus` — read-only Modbus/TCP polling from `MODBUS_HOST`

## API routes

### `GET /api/heatpump`

Returns the current snapshot:

```json
{
  "flowTemp": 35.1,
  "returnTemp": 30.8,
  "outdoorTemp": 7.2,
  "dhwTemp": 48.5,
  "dhwSetpoint": 50,
  "sourceInletTemp": 3.5,
  "sourceOutletTemp": 1.1,
  "bufferTemp": 33.2,
  "cop": 3.74,
  "compressorFreq": 42,
  "primaryPumpSpeed": 66,
  "secondaryPumpSpeed": 54,
  "fanSpeed": null,
  "operatingMode": "heating",
  "faultCodes": [],
  "energyOutputToday": 48.2,
  "energyOutputMonth": 712.4,
  "energyConsumedToday": 13.1,
  "energyConsumedMonth": 198.6,
  "runHoursToday": 9.6,
  "online": true,
  "lastUpdated": "2026-04-10T23:00:00.000Z"
}
```

### `GET /api/heatpump/history`

Supports either:

- `?range=1h|6h|24h|7d`
- `?from=YYYY-MM-DD&to=YYYY-MM-DD`

Returns chart points, daily energy, summary values, and recent events.

### `GET /api/tariff`

Returns the OVO SVT tariff table. If `from` and `to` are provided, it also returns the overlapping periods and a one-kWh preview breakdown.

## Vercel deployment

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Log in and link the project

```bash
vercel
```

Follow the prompts and link the repository.

### 3. Configure environment variables

In the Vercel dashboard, add the same variables used in `.env.local`:

- `HEATPUMP_DATA_SOURCE`
- `MODBUS_HOST`
- `MODBUS_PORT`
- `MODBUS_UNIT_ID`
- `HEATPUMP_REST_URL`
- `HEATPUMP_REST_API_KEY`

For local development, store them in `.env.local`.

### 4. Deploy

```bash
vercel deploy
```

For a production deployment:

```bash
vercel deploy --prod
```

### Vercel-specific notes

- The Modbus route handlers export `runtime = 'nodejs'` so they run on the Node.js runtime, not the Edge runtime.
- The app uses polling with SWR every 30 seconds. There are no WebSockets or background workers.
- `vercel.json` sets a 10-second max duration for the heat pump API routes, matching Hobby plan constraints.
- Modbus access is server-side only. No Modbus library is ever loaded in the browser.

## Modbus register map TODOs

The Modbus register map in `lib/modbusClient.ts` is intentionally marked with explicit TODO comments because actual Ochsner register addresses vary by controller generation and site configuration.

Current placeholders:

- `flowTemp` — `// TODO: confirm register address for flow temperature`
- `returnTemp` — `// TODO: confirm register address for return temperature`
- `outdoorTemp` — `// TODO: confirm register address for outdoor ambient temperature`
- `dhwTemp` — `// TODO: confirm register address for DHW temperature`
- `dhwSetpoint` — `// TODO: confirm register address for DHW setpoint temperature`
- `sourceInletTemp` — `// TODO: confirm register address for source inlet temperature`
- `sourceOutletTemp` — `// TODO: confirm register address for source outlet temperature`
- `bufferTemp` — `// TODO: confirm register address for buffer/storage tank temperature`
- `cop` — `// TODO: confirm register address for current COP`
- `compressorFreq` — `// TODO: confirm register address for compressor frequency`
- `primaryPumpSpeed` — `// TODO: confirm register address for primary pump speed`
- `secondaryPumpSpeed` — `// TODO: confirm register address for secondary pump speed`
- `fanSpeed` — `// TODO: confirm register address for fan speed`
- `operatingMode` — `// TODO: confirm register address for operating mode`
- `activeFaultCode` — `// TODO: confirm register address for active fault code`
- `energyOutputToday` — `// TODO: confirm register address for thermal output today`
- `energyOutputMonth` — `// TODO: confirm register address for thermal output month`
- `energyConsumedToday` — `// TODO: confirm register address for electrical consumption today`
- `energyConsumedMonth` — `// TODO: confirm register address for electrical consumption month`
- `runHoursToday` — `// TODO: confirm register address for run hours today`

Once you have the actual register map:

1. Replace the placeholder addresses in `REGISTER_MAP`
2. Confirm scaling factors for each register
3. Confirm how nullable values are represented by the controller
4. Confirm fault code and mode enumerations
5. Rebuild and test with `HEATPUMP_DATA_SOURCE=modbus`

## OVO tariff updates

The tariff table is stored in `lib/ovoTariff.ts` as `OVO_SVT_RATES`.

Rates are quarterly and should be updated when Ofgem announces a new price cap period and OVO publishes its updated SVT guidance.

### Update process

1. Check the latest Ofgem price cap announcement
2. Check OVO’s published standard variable tariff / price cap page
3. Add a new `TariffPeriod` row to `OVO_SVT_RATES`
4. Keep `unitRate` in pence per kWh
5. Keep `standingCharge` in pence per day
6. Do not add standing charge to the heat pump running-cost calculation
7. Redeploy the app

Example shape:

```ts
{ from: '2026-07-01', to: '2026-09-30', unitRate: 25.10, standingCharge: 57.21 }
```

## Cost calculator behavior

The cost calculator:

- accepts `From` and `To` HTML date inputs
- loads energy history from `/api/heatpump/history`
- looks up overlapping tariff periods from `/api/tariff`
- splits date ranges across tariff quarters
- calculates total electrical running cost only
- does not attribute standing charge to heat pump cost

The note shown in the UI is:

> Rates shown are OVO Simpler Energy SVT. Prices vary by region. Always confirm your personal rate in your OVO account.

## Verification

The dashboard has been verified with:

```bash
npm run typecheck
npm run build
```

These checks confirm the app compiles and the route handlers/pages build successfully for Next.js 14.

## Known limitations

- Historical data is simulated in `mock` mode
- In `rest` and `modbus` modes, historical chart data is estimated from current counters unless you add a persistent historian
- The provided OVO SVT rates are UK-average reference values, not customer-specific prices
- The Modbus register map must be confirmed against the installed Ochsner controller
