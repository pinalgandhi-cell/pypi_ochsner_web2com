import { NextRequest, NextResponse } from 'next/server'

import { OVO_SVT_RATES, calculateCost } from '@/lib/ovoTariff'

function parseDateParam(value: string | null): Date | null {
  if (!value) {
    return null
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET(request: NextRequest) {
  const from = parseDateParam(request.nextUrl.searchParams.get('from'))
  const to = parseDateParam(request.nextUrl.searchParams.get('to'))

  if (!from || !to) {
    return NextResponse.json({
      rates: OVO_SVT_RATES,
    })
  }

  const overlappingRates = OVO_SVT_RATES.filter((rate) => {
    const rateFrom = new Date(`${rate.from}T00:00:00.000Z`)
    const rateTo = new Date(`${rate.to}T00:00:00.000Z`)
    return rateFrom <= to && rateTo >= from
  })

  return NextResponse.json({
    rates: OVO_SVT_RATES,
    selectedRates: overlappingRates,
    preview: calculateCost(1, from, to),
  })
}
