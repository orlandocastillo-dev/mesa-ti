import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filterTickets, filtersFromQuery, filtersToQuery, sortForTriage } from "../src/domain/sort.ts";
import type { Ticket } from "../src/types.ts";

const t = (id: number, over: Partial<Ticket> = {}): Ticket => ({
  id,
  title: `Ticket ${id}`,
  description: "",
  category: "otro",
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

describe("sortForTriage", () => {
  it("pone primero lo que vence antes y al final los cerrados", () => {
    const list = [
      t(1, { status: "cerrado", resolvedAt: "2026-10-19T05:00:00Z" }),
      t(2, { priority: "baja" }),
      t(3, { priority: "critica" }),
      t(4, { status: "cerrado", resolvedAt: "2026-10-19T09:00:00Z" }),
      t(5, { priority: "alta" }),
    ];
    expect(sortForTriage(list).map((x) => x.id)).toEqual([3, 5, 2, 4, 1]);
  });
});

describe("filterTickets", () => {
  const list = [
    t(1, { title: "Contraseña bloqueada", assigneeId: "yo" }),
    t(2, { title: "Impresora", status: "cerrado" }),
    t(3, { title: "VPN", priority: "alta" }),
  ];

  it("busca sin importar tildes ni mayúsculas", () => {
    expect(filterTickets(list, { ...DEFAULT_FILTERS, query: "CONTRASENA" }, "yo").map((x) => x.id)).toEqual([1]);
  });

  it("busca por código del ticket", () => {
    expect(filterTickets(list, { ...DEFAULT_FILTERS, query: "mt-0003" }, "yo").map((x) => x.id)).toEqual([3]);
  });

  it("filtra asignados a mí y sin asignar (activos)", () => {
    expect(filterTickets(list, { ...DEFAULT_FILTERS, scope: "mios" }, "yo").map((x) => x.id)).toEqual([1]);
    expect(filterTickets(list, { ...DEFAULT_FILTERS, scope: "sin_asignar" }, "yo").map((x) => x.id)).toEqual([3]);
  });
});

describe("filtros en la URL", () => {
  it("ida y vuelta sin perder información", () => {
    const f = { ...DEFAULT_FILTERS, status: "en_proceso" as const, priority: "alta" as const, query: "red" };
    const qs = filtersToQuery(f);
    expect(qs).toBe("?estado=en_proceso&prioridad=alta&q=red");
    expect(filtersFromQuery(new URLSearchParams(qs.slice(1)))).toEqual(f);
  });

  it("sin filtros no genera query string", () => {
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe("");
  });
});
