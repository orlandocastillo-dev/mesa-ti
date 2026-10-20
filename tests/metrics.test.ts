import { describe, expect, it } from "vitest";
import { computeMetrics } from "../src/domain/metrics.ts";
import type { Ticket } from "../src/types.ts";

const ticket = (over: Partial<Ticket>): Ticket => ({
  id: 1,
  title: "Prueba",
  description: "Descripción de prueba",
  category: "hardware",
  priority: "media",
  status: "abierto",
  requesterId: "u1",
  assigneeId: null,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
  firstResponseAt: null,
  resolvedAt: null,
  ...over,
});

describe("computeMetrics", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const tickets = [
    ticket({ id: 1, status: "cerrado", resolvedAt: "2026-10-19T10:00:00Z", firstResponseAt: "2026-10-19T01:00:00Z" }),
    ticket({ id: 2, status: "cerrado", resolvedAt: "2026-10-20T10:00:00Z", firstResponseAt: "2026-10-19T03:00:00Z", category: "red" }),
    ticket({ id: 3, status: "abierto" }), // media: vence a las 24 h, ya vencido
    ticket({ id: 4, status: "en_proceso", assigneeId: "a1", createdAt: "2026-10-20T11:00:00Z" }),
  ];
  const m = computeMetrics(tickets, now);

  it("cuenta por estado", () => {
    expect(m.byStatus).toEqual({ abierto: 1, en_proceso: 1, cerrado: 2 });
  });

  it("calcula el cumplimiento de SLA solo con cerrados", () => {
    expect(m.slaCompliance).toBe(50);
  });

  it("promedia primera respuesta y resolución", () => {
    expect(m.avgFirstResponseMs).toBe(2 * 3600_000);
    expect(m.avgResolutionMs).toBe(((10 + 34) / 2) * 3600_000);
  });

  it("detecta vencidos y sin asignar entre los activos", () => {
    expect(m.overdueOpen).toBe(1);
    expect(m.unassigned).toBe(1);
  });

  it("ordena categorías de mayor a menor", () => {
    expect(m.byCategory[0]).toEqual({ category: "hardware", count: 3 });
  });

  it("devuelve null cuando no hay datos para promediar", () => {
    const empty = computeMetrics([], now);
    expect(empty.slaCompliance).toBeNull();
    expect(empty.avgResolutionMs).toBeNull();
  });
});
