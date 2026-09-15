import { formatDateTime } from "@/lib/format";
import type { AuditEvent } from "@/types";

export function AuditTrail({ events }: { events: AuditEvent[] }) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <ol className="space-y-4">
      {sorted.map((event, idx) => (
        <li key={event.id} className="relative flex gap-3 pl-1">
          <div className="flex flex-col items-center">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            {idx !== sorted.length - 1 && <span className="w-px flex-1 bg-border" aria-hidden="true" />}
          </div>
          <div className="pb-4">
            <p className="text-sm font-medium text-foreground">{event.action}</p>
            {event.detail && <p className="text-xs text-muted-foreground">{event.detail}</p>}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDateTime(event.timestamp)} · {event.actor}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
