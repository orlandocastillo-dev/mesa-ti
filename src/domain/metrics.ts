import type { Category, Status, Ticket } from "../types.ts";
import { CATEGORIES, STATUSES } from "./labels.ts";
import { slaState } from "./sla.ts";

export interface Metrics {
  total: number;
  byStatus: Record<Status, number>;
  byCategory: { category: Category; count: number }[];
  /** Promedio en ms desde la creación hasta el cierre. null si no hay cerrados. */
  avgResolutionMs: number | null;
  /** Promedio en ms hasta la primera respuesta de un agente. */
  avgFirstResponseMs: number | null;
  /** Porcentaje de tickets cerrados dentro del SLA. */
  slaCompliance: number | null;
  overdueOpen: number;
  unassigned: number;
}

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export function computeMetrics(tickets: Ticket[], now: Date = new Date()): Metrics {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  const categoryCount = new Map<Category, number>(CATEGORIES.map((c) => [c, 0]));
  const resolution: number[] = [];
  const firstResponse: number[] = [];
  let closedOnTime = 0;
  let closed = 0;
  let overdueOpen = 0;
  let unassigned = 0;

  for (const t of tickets) {
    byStatus[t.status]++;
    categoryCount.set(t.category, (categoryCount.get(t.category) ?? 0) + 1);
    const created = new Date(t.createdAt).getTime();

    if (t.firstResponseAt) firstResponse.push(new Date(t.firstResponseAt).getTime() - created);

    if (t.status === "cerrado" && t.resolvedAt) {
      closed++;
      resolution.push(new Date(t.resolvedAt).getTime() - created);
      if (slaState(t, now).kind === "cumplido") closedOnTime++;
    } else {
      if (slaState(t, now).kind === "vencido") overdueOpen++;
      if (!t.assigneeId) unassigned++;
    }
  }

  return {
    total: tickets.length,
    byStatus,
    byCategory: [...categoryCount.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    avgResolutionMs: average(resolution),
    avgFirstResponseMs: average(firstResponse),
    slaCompliance: closed ? Math.round((closedOnTime / closed) * 100) : null,
    overdueOpen,
    unassigned,
  };
}
