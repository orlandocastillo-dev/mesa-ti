import { describe, expect, it } from "vitest";
import { formatDuration, slaDeadline, slaState } from "../src/domain/sla.ts";

const base = { createdAt: "2026-10-19T08:00:00.000Z", status: "abierto" as const, resolvedAt: null };

describe("slaDeadline", () => {
  it("suma las horas según la prioridad", () => {
    expect(slaDeadline({ ...base, priority: "critica" }).toISOString()).toBe("2026-10-19T12:00:00.000Z");
    expect(slaDeadline({ ...base, priority: "baja" }).toISOString()).toBe("2026-10-22T08:00:00.000Z");
  });
});

describe("slaState", () => {
  it("en tiempo cuando queda más del 25 % del plazo", () => {
    const s = slaState({ ...base, priority: "media" }, new Date("2026-10-19T10:00:00Z"));
    expect(s.kind).toBe("en_tiempo");
    expect(s.label).toBe("Vence en 22 h");
  });

  it("por vencer en el último cuarto del plazo", () => {
    expect(slaState({ ...base, priority: "critica" }, new Date("2026-10-19T11:30:00Z")).kind).toBe("por_vencer");
  });

  it("vencido cuando pasó el plazo", () => {
    const s = slaState({ ...base, priority: "alta" }, new Date("2026-10-19T17:00:00Z"));
    expect(s).toMatchObject({ kind: "vencido", label: "Vencido hace 1 h" });
  });

  it("evalúa los cerrados contra la fecha de cierre, no contra hoy", () => {
    const closed = { ...base, priority: "alta" as const, status: "cerrado" as const };
    expect(slaState({ ...closed, resolvedAt: "2026-10-19T15:00:00Z" }).kind).toBe("cumplido");
    expect(slaState({ ...closed, resolvedAt: "2026-10-19T17:00:00Z" }).kind).toBe("incumplido");
  });
});

describe("formatDuration", () => {
  it("usa la unidad más legible", () => {
    expect(formatDuration(20_000)).toBe("1 min");
    expect(formatDuration(45 * 60_000)).toBe("45 min");
    expect(formatDuration(90 * 60_000)).toBe("1 h 30 min");
    expect(formatDuration(30 * 3600_000)).toBe("30 h");
    expect(formatDuration(72 * 3600_000)).toBe("3 días");
  });
});
