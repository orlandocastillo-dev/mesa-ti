import type { Priority, Ticket } from "../types.ts";

/** Horas máximas para resolver según prioridad (acuerdo de nivel de servicio). */
export const SLA_HOURS: Record<Priority, number> = {
  critica: 4,
  alta: 8,
  media: 24,
  baja: 72,
};

const HOUR = 60 * 60 * 1000;

export type SlaState =
  | { kind: "cumplido"; label: string }
  | { kind: "incumplido"; label: string }
  | { kind: "en_tiempo"; label: string; remainingMs: number }
  | { kind: "por_vencer"; label: string; remainingMs: number }
  | { kind: "vencido"; label: string; overdueMs: number };

export function slaDeadline(ticket: Pick<Ticket, "createdAt" | "priority">): Date {
  return new Date(new Date(ticket.createdAt).getTime() + SLA_HOURS[ticket.priority] * HOUR);
}

export function slaState(
  ticket: Pick<Ticket, "createdAt" | "priority" | "status" | "resolvedAt">,
  now: Date = new Date(),
): SlaState {
  const deadline = slaDeadline(ticket).getTime();

  if (ticket.status === "cerrado" && ticket.resolvedAt) {
    return new Date(ticket.resolvedAt).getTime() <= deadline
      ? { kind: "cumplido", label: "Resuelto a tiempo" }
      : { kind: "incumplido", label: "Resuelto fuera de tiempo" };
  }

  const remainingMs = deadline - now.getTime();
  if (remainingMs < 0) {
    return { kind: "vencido", label: `Vencido hace ${formatDuration(-remainingMs)}`, overdueMs: -remainingMs };
  }

  const total = SLA_HOURS[ticket.priority] * HOUR;
  const kind = remainingMs <= total * 0.25 ? "por_vencer" : "en_tiempo";
  return { kind, label: `Vence en ${formatDuration(remainingMs)}`, remainingMs };
}

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rest = minutes % 60;
    return rest && hours < 10 ? `${hours} h ${rest} min` : `${hours} h`;
  }
  return `${Math.round(hours / 24)} días`;
}
