import type { AppContext } from "../context.ts";
import { profileName } from "../context.ts";
import { CATEGORIES, CATEGORY_LABEL, PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, ticketCode } from "../domain/labels.ts";
import {
  DEFAULT_FILTERS,
  filterTickets,
  filtersFromQuery,
  filtersToQuery,
  sortForTriage,
  type TicketFilters,
} from "../domain/sort.ts";
import type { Ticket } from "../types.ts";
import { avatar, icon, priorityTag, slaText, statusPill } from "../ui/components.ts";
import { relativeTime } from "../ui/format.ts";
import { html, render } from "../ui/html.ts";

let keepSearchFocus = false;

export async function renderTicketList(root: HTMLElement, ctx: AppContext, query: URLSearchParams) {
  const tickets = await ctx.repo.listTickets();
  const filters = filtersFromQuery(query);
  const isAgent = ctx.user.role === "agente";

  // Los conteos de las pestañas respetan los demás filtros, como en cualquier bandeja de correo.
  const countFor = (status: TicketFilters["status"]) =>
    filterTickets(tickets, { ...filters, status }, ctx.user.id).length;

  const visible = sortForTriage(filterTickets(tickets, filters, ctx.user.id));
  const hasFilters = filtersToQuery({ ...filters, status: "todos" }) !== "";

  render(
    root,
    html`
      <header class="page-head">
        <div>
          <h1>${isAgent ? "Bandeja de tickets" : "Mis tickets"}</h1>
          <p class="muted">
            ${isAgent
              ? "Ordenados por urgencia: primero lo que vence antes."
              : "Aquí ves el estado de cada solicitud y las respuestas del equipo de soporte."}
          </p>
        </div>
        <a class="btn btn--primary" href="#/nuevo">${icon("plus")} Nuevo ticket</a>
      </header>

      <nav class="tabs" aria-label="Filtrar por estado">
        ${(["todos", ...STATUSES] as const).map(
          (s) => html`
            <a
              class="tab"
              href="#/tickets${filtersToQuery({ ...filters, status: s })}"
              aria-current="${filters.status === s ? "page" : "false"}"
            >
              ${s === "todos" ? "Todos" : STATUS_LABEL[s]}
              <span class="tab__count">${countFor(s)}</span>
            </a>
          `,
        )}
      </nav>

      <form class="toolbar" data-filters role="search">
        <label class="search">
          ${icon("search")}
          <span class="sr-only">Buscar</span>
          <input type="search" name="q" value="${filters.query}" placeholder="Buscar por asunto, código o descripción" />
        </label>
        <label>
          <span class="sr-only">Prioridad</span>
          <select name="prioridad">
            <option value="todas">Todas las prioridades</option>
            ${PRIORITIES.map(
              (p) => html`<option value="${p}" ${filters.priority === p ? "selected" : ""}>${PRIORITY_LABEL[p]}</option>`,
            )}
          </select>
        </label>
        <label>
          <span class="sr-only">Categoría</span>
          <select name="categoria">
            <option value="todas">Todas las categorías</option>
            ${CATEGORIES.map(
              (c) => html`<option value="${c}" ${filters.category === c ? "selected" : ""}>${CATEGORY_LABEL[c]}</option>`,
            )}
          </select>
        </label>
        ${isAgent
          ? html`
              <label>
                <span class="sr-only">Vista</span>
                <select name="vista">
                  <option value="todos" ${filters.scope === "todos" ? "selected" : ""}>Todos los agentes</option>
                  <option value="mios" ${filters.scope === "mios" ? "selected" : ""}>Asignados a mí</option>
                  <option value="sin_asignar" ${filters.scope === "sin_asignar" ? "selected" : ""}>Sin asignar</option>
                </select>
              </label>
            `
          : null}
        ${hasFilters ? html`<a class="link" href="#/tickets${filtersToQuery({ ...DEFAULT_FILTERS, status: filters.status })}">Limpiar filtros</a>` : null}
      </form>

      ${visible.length
        ? html`
            <div class="table-wrap">
              <table class="tickets">
                <thead>
                  <tr>
                    <th scope="col">Ticket</th>
                    <th scope="col">Prioridad</th>
                    <th scope="col">Estado</th>
                    <th scope="col">SLA</th>
                    <th scope="col">Asignado</th>
                    <th scope="col">Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  ${visible.map((t) => row(t, ctx))}
                </tbody>
              </table>
            </div>
          `
        : emptyState(tickets.length === 0, isAgent)}
    `,
  );

  bindFilters(root, filters);
}

function row(t: Ticket, ctx: AppContext) {
  const assignee = t.assigneeId ? ctx.profiles.get(t.assigneeId) : undefined;
  return html`
    <tr class="${t.status === "cerrado" ? "is-closed" : ""}">
      <td data-label="Ticket" class="tickets__main">
        <div class="tickets__cell">
        <span class="code">${ticketCode(t.id)}</span>
        <a class="tickets__link" href="#/tickets/${t.id}">${t.title}</a>
        <span class="tickets__meta">${CATEGORY_LABEL[t.category]}, de ${profileName(ctx, t.requesterId)}</span>
        </div>
      </td>
      <td data-label="Prioridad">${priorityTag(t.priority)}</td>
      <td data-label="Estado">${statusPill(t.status)}</td>
      <td data-label="SLA">${slaText(t)}</td>
      <td data-label="Asignado">
        <span class="person">${avatar(assignee)} ${assignee ? assignee.fullName.split(" ")[0] : "Sin asignar"}</span>
      </td>
      <td data-label="Actualizado" class="muted nowrap">${relativeTime(t.updatedAt)}</td>
    </tr>
  `;
}

function emptyState(noTicketsAtAll: boolean, isAgent: boolean) {
  if (noTicketsAtAll) {
    return html`
      <div class="empty">
        <h2>${isAgent ? "La bandeja está vacía" : "Aún no has reportado nada"}</h2>
        <p>${isAgent ? "Cuando un usuario reporte un problema aparecerá aquí." : "Si algo no funciona en tu equipo, crea un ticket y te respondemos."}</p>
        <a class="btn btn--primary" href="#/nuevo">Crear ticket</a>
      </div>
    `;
  }
  return html`
    <div class="empty">
      <h2>Ningún ticket coincide con estos filtros</h2>
      <p>Prueba con otra palabra o quita alguno de los filtros.</p>
      <a class="btn" href="#/tickets">Ver todos</a>
    </div>
  `;
}

function bindFilters(root: HTMLElement, current: TicketFilters) {
  const form = root.querySelector<HTMLFormElement>("[data-filters]");
  if (!form) return;

  const search = form.querySelector<HTMLInputElement>('input[name="q"]');

  const apply = () => {
    keepSearchFocus = document.activeElement === search;
    const data = new FormData(form);
    const next: TicketFilters = {
      status: current.status,
      query: String(data.get("q") ?? ""),
      priority: (data.get("prioridad") as TicketFilters["priority"]) ?? "todas",
      category: (data.get("categoria") as TicketFilters["category"]) ?? "todas",
      scope: (data.get("vista") as TicketFilters["scope"]) ?? "todos",
    };
    // replaceState evita llenar el historial con cada tecla de la búsqueda.
    history.replaceState(null, "", `#/tickets${filtersToQuery(next)}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  form.addEventListener("change", (e) => {
    if ((e.target as HTMLElement).matches("select")) apply();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    apply();
  });

  let timer: number | undefined;
  search?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = window.setTimeout(apply, 250);
  });

  // Mantiene el foco y el cursor en el buscador después de volver a dibujar.
  if (keepSearchFocus && search) {
    keepSearchFocus = false;
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);
  }
}
