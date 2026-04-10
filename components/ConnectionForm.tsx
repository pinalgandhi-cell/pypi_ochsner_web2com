'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { SavedConnectionSummary, Web2ComAuthMode } from '@/lib/types'

export function ConnectionForm() {
  const router = useRouter()
  const [endpoint, setEndpoint] = useState('185.190.94.159:50000')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<Web2ComAuthMode>('digest')
  const [savedConnection, setSavedConnection] = useState<SavedConnectionSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingSaved, setIsLoadingSaved] = useState(true)

  useEffect(() => {
    async function loadSavedConnection() {
      try {
        const response = await fetch('/api/connection', { cache: 'no-store' })
        const data = await response.json()
        if (data.connected) {
          setSavedConnection(data.connection)
          setEndpoint(data.connection.endpoint)
          setUsername(data.connection.username)
          setAuthMode(data.connection.authMode)
        }
      } finally {
        setIsLoadingSaved(false)
      }
    }

    void loadSavedConnection()
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint,
          username,
          password,
          authMode,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message ?? 'Failed to save connection')
      }

      router.push('/')
      router.refresh()
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Failed to save connection')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDisconnect() {
    setError(null)
    await fetch('/api/connection', { method: 'DELETE' })
    setSavedConnection(null)
    setPassword('')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {isLoadingSaved ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
          Loading current connection...
        </div>
      ) : savedConnection ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          Connected configuration saved for {savedConnection.endpoint} as {savedConnection.username} using {savedConnection.authMode} authentication.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
          No saved Web2Com connection yet.
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm text-slate-300">External IP / hostname and port</span>
          <input
            aria-label="External IP or hostname and port"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            placeholder="185.190.94.159:50000"
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Username</span>
            <input
              aria-label="Web2Com username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Password</span>
            <input
              aria-label="Web2Com password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm text-slate-300">Authentication mode</span>
          <select
            aria-label="Authentication mode"
            value={authMode}
            onChange={(event) => setAuthMode(event.target.value as Web2ComAuthMode)}
          >
            <option value="digest">Digest</option>
            <option value="basic">Basic</option>
          </select>
        </label>

        {error ? (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Testing connection...' : 'Save and open dashboard'}
          </button>
          <button
            type="button"
            onClick={() => void handleDisconnect()}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500"
          >
            Clear saved connection
          </button>
          <Link href="/" className="text-sm text-sky-300">
            Back to dashboard
          </Link>
        </div>
      </form>
    </div>
  )
}
