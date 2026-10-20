import type { Category, Priority, Status, Ticket } from "../types.ts";
import { ticketCode } from "./labels.ts";
import { slaDeadline } from "./sla.ts";

export interface TicketFilters {
  status: Status | "todos";
  priority: Priority | "todas";
  category: Category | "todas";
  query: string;
  scope: "todos" | "mios" | "sin_asignar";
}

export const DEFAULT_FILTERS: TicketFilters = {
  status: "todos",
  priority: "todas",
  category: "todas",
  query: "",
  scope: "todos",
};

/** Quita tildes y pasa a minúsculas para que "contraseña" encuentre "Contrasena". */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function filterTickets(tickets: Ticket[], filters: TicketFilters, currentUserId: string): Ticket[] {
  const q = normalize(filters.query.trim());
  return tickets.filter((t) => {
    if (filters.status !== "todos" && t.status !== filters.status) return false;
    if (filters.priority !== "todas" && t.priority !== filters.priority) return false;
    if (filters.category !== "todas" && t.category !== filters.category) return false;
    if (filters.scope === "mios" && t.assigneeId !== currentUserId) return false;
    if (filters.scope === "sin_asignar" && (t.assigneeId || t.status === "cerrado")) return false;
    if (q) {
      const haystack = normalize(`${ticketCode(t.id)} ${t.title} ${t.description}`);
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Orden de atención: primero los tickets activos que vencen antes;
 * al final los cerrados, del más reciente al más antiguo.
 */
export function sortForTriage(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    const aClosed = a.status === "cerrado";
    const bClosed = b.status === "cerrado";
    if (aClosed !== bClosed) return aClosed ? 1 : -1;
    if (aClosed && bClosed) return (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? "");
    return slaDeadline(a).getTime() - slaDeadline(b).getTime();
  });
}

export function filtersFromQuery(query: URLSearchParams): TicketFilters {
  return {
    status: (query.get("estado") as TicketFilters["status"]) ?? DEFAULT_FILTERS.status,
    priority: (query.get("prioridad") as TicketFilters["priority"]) ?? DEFAULT_FILTERS.priority,
    category: (query.get("categoria") as TicketFilters["category"]) ?? DEFAULT_FILTERS.category,
    query: query.get("q") ?? "",
    scope: (query.get("vista") as TicketFilters["scope"]) ?? DEFAULT_FILTERS.scope,
  };
}

export function filtersToQuery(filters: TicketFilters): string {
  const params = new URLSearchParams();
  if (filters.status !== "todos") params.set("estado", filters.status);
  if (filters.priority !== "todas") params.set("prioridad", filters.priority);
  if (filters.category !== "todas") params.set("categoria", filters.category);
  if (filters.scope !== "todos") params.set("vista", filters.scope);
  if (filters.query.trim()) params.set("q", filters.query.trim());
  const s = params.toString();
  return s ? `?${s}` : "";
}
