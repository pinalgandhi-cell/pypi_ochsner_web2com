import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

import type { SavedConnectionSummary, Web2ComConnectionInput } from '@/lib/types'

const COOKIE_NAME = 'ochsner-web2com-session'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getSecretKey(): Buffer {
  const secret = process.env.DASHBOARD_SESSION_SECRET
  if (!secret) {
    throw new Error('DASHBOARD_SESSION_SECRET is not configured')
  }

  return createHash('sha256').update(secret).digest()
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(normalized + padding, 'base64')
}

export function getConnectionCookieName(): string {
  return COOKIE_NAME
}

export function serializeConnection(input: Web2ComConnectionInput): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', getSecretKey(), iv)
  const payload = Buffer.concat([
    cipher.update(JSON.stringify(input), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [iv, tag, payload].map(base64UrlEncode).join('.')
}

export function deserializeConnection(value: string): Web2ComConnectionInput | null {
  try {
    const [ivValue, tagValue, payloadValue] = value.split('.')
    if (!ivValue || !tagValue || !payloadValue) {
      return null
    }

    const iv = base64UrlDecode(ivValue)
    const tag = base64UrlDecode(tagValue)
    const payload = base64UrlDecode(payloadValue)
    const decipher = createDecipheriv('aes-256-gcm', getSecretKey(), iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8')
    const parsed = JSON.parse(plaintext) as Web2ComConnectionInput

    if (
      typeof parsed.endpoint !== 'string' ||
      typeof parsed.username !== 'string' ||
      typeof parsed.password !== 'string' ||
      (parsed.authMode !== 'digest' && parsed.authMode !== 'basic')
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function summarizeConnection(input: Web2ComConnectionInput): SavedConnectionSummary {
  return {
    endpoint: input.endpoint,
    username: input.username,
    authMode: input.authMode,
  }
}
