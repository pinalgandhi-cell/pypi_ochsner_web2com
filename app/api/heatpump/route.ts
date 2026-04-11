import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { deserializeConnection, getConnectionCookieName } from '@/lib/connectionSession'
import { getCurrentHeatpumpSnapshot } from '@/lib/heatpumpData'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const savedConnection = deserializeConnection(
      cookies().get(getConnectionCookieName())?.value ?? ''
    )
    const data = await getCurrentHeatpumpSnapshot(savedConnection)
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Failed to fetch heat pump data',
      },
      { status: 502 }
    )
  }
}
