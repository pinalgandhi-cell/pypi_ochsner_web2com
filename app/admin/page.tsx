import { ConnectionForm } from '@/components/ConnectionForm'

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.2em] text-sky-300">Admin connection settings</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50">Connect to Web2Com</h1>
            <p className="mt-2 text-sm text-slate-400">
              Enter the externally reachable Web2Com endpoint, username, and password. The credentials are stored in an encrypted HttpOnly cookie and only used for read-only requests from the dashboard API routes.
            </p>
          </div>
          <ConnectionForm />
        </div>
      </div>
    </main>
  )
}
