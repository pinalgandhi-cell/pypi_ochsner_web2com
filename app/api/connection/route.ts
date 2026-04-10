import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import {
  deserializeConnection,
  getConnectionCookieName,
  serializeConnection,
  summarizeConnection,
} from '@/lib/connectionSession'
import type { Web2ComConnectionInput } from '@/lib/types'
import { testWeb2ComConnection } from '@/lib/web2comClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isValidInput(input: unknown): input is Web2ComConnectionInput {
  if (!input || typeof input !== 'object') {
    return false
  }

  const candidate = input as Record<string, unknown>
  return (
    typeof candidate.endpoint === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.password === 'string' &&
    (candidate.authMode === 'digest' || candidate.authMode === 'basic')
  )
}

export async function GET() {
  const raw = cookies().get(getConnectionCookieName())?.value
  if (!raw) {
    return NextResponse.json({ connected: false })
  }

  const connection = deserializeConnection(raw)
  if (!connection) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    connection: summarizeConnection(connection),
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!isValidInput(body)) {
    return NextResponse.json({ message: 'Invalid connection payload' }, { status: 400 })
  }

  const connection: Web2ComConnectionInput = {
    endpoint: body.endpoint.trim(),
    username: body.username.trim(),
    password: body.password,
    authMode: body.authMode,
  }

  if (!connection.endpoint || !connection.username || !connection.password) {
    return NextResponse.json({ message: 'Endpoint, username, and password are required' }, { status: 400 })
  }

  try {
    await testWeb2ComConnection(connection)
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Unable to connect to Web2Com',
      },
      { status: 502 }
    )
  }

  const response = NextResponse.json({
    connected: true,
    connection: summarizeConnection(connection),
  })

  response.cookies.set({
    name: getConnectionCookieName(),
    value: serializeConnection(connection),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  return response
}

export async function DELETE() {
  const response = NextResponse.json({ connected: false })
  response.cookies.set({
    name: getConnectionCookieName(),
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}
