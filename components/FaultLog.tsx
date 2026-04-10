import type { EventLogEntry } from '@/lib/types'

function severityClasses(severity: EventLogEntry['severity']): string {
  switch (severity) {
    case 'error':
      return 'bg-rose-500/10 text-rose-200'
    case 'warning':
      return 'bg-amber-500/10 text-amber-200'
    default:
      return 'bg-sky-500/10 text-sky-200'
  }
}

export function FaultLog({ events }: { events?: EventLogEntry[] }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-50">Fault &amp; event log</h2>
        <p className="text-sm text-slate-400">Most recent 20 read-only events from the controller feed.</p>
      </div>

      <div className="max-h-80 overflow-auto rounded-xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950/80 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Timestamp</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Severity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {events?.length ? (
              events.map((event) => (
                <tr key={`${event.timestamp}-${event.code}`} className="bg-slate-950/30">
                  <td className="px-4 py-3 text-slate-300">
                    {new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(event.timestamp))}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-100">{event.code}</td>
                  <td className="px-4 py-3 text-slate-300">{event.description}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs ${severityClasses(event.severity)}`}>
                      {event.severity}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No recent events available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
