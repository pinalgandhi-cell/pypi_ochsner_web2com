import { NextRequest, NextResponse } from 'next/server'

import { getHeatpumpHistory } from '@/lib/heatpumpData'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RANGE_MAP: Record<string, number> = {
  '1h': 1,
  '6h': 6,
  '24h': 24,
  '7d': 24 * 7,
}

function parseRequestWindow(request: NextRequest): { from: Date; to: Date } {
  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const range = searchParams.get('range') ?? '24h'

  if (from && to) {
    return {
      from: new Date(`${from}T00:00:00.000Z`),
      to: new Date(`${to}T23:59:59.999Z`),
    }
  }

  const hours = RANGE_MAP[range] ?? RANGE_MAP['24h']
  const end = new Date()
  return {
    from: new Date(end.getTime() - hours * 60 * 60 * 1000),
    to: end,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { from, to } = parseRequestWindow(request)
    const data = await getHeatpumpHistory(from, to)
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Failed to fetch heat pump history',
      },
      { status: 502 }
    )
  }
}
