import type { AppContext } from "../context.ts";
import { CATEGORY_LABEL, STATUS_LABEL, STATUSES } from "../domain/labels.ts";
import { computeMetrics } from "../domain/metrics.ts";
import { formatDuration } from "../domain/sla.ts";
import { html, render } from "../ui/html.ts";

export async function renderMetrics(root: HTMLElement, ctx: AppContext) {
  if (ctx.user.role !== "agente") {
    render(root, html`<div class="empty"><h1>Solo para el equipo de soporte</h1><a class="btn" href="#/tickets">Ir a mis tickets</a></div>`);
    return;
  }

  const tickets = await ctx.repo.listTickets();
  const m = computeMetrics(tickets);
  const maxCategory = Math.max(1, ...m.byCategory.map((c) => c.count));

  const agents = [...ctx.profiles.values()].filter((p) => p.role === "agente");
  const load = agents
    .map((a) => ({
      agent: a,
      open: tickets.filter((t) => t.assigneeId === a.id && t.status !== "cerrado").length,
      closed: tickets.filter((t) => t.assigneeId === a.id && t.status === "cerrado").length,
    }))
    .sort((a, b) => b.open - a.open);
  const maxLoad = Math.max(1, ...load.map((l) => l.open + l.closed));

  const kpi = (label: string, value: string, note: string, tone = "") => html`
    <div class="kpi ${tone}">
      <p class="kpi__label">${label}</p>
      <p class="kpi__value">${value}</p>
      <p class="kpi__note">${note}</p>
    </div>
  `;

  render(
    root,
    html`
      <header class="page-head">
        <div>
          <h1>Métricas del servicio</h1>
          <p class="muted">Calculadas sobre los ${m.total} tickets registrados.</p>
        </div>
      </header>

      <section class="kpis" aria-label="Indicadores principales">
        ${kpi(
          "Cumplimiento de SLA",
          m.slaCompliance === null ? "Sin datos" : `${m.slaCompliance} %`,
          "de los tickets cerrados se resolvieron a tiempo",
          m.slaCompliance !== null && m.slaCompliance < 80 ? "kpi--warn" : "",
        )}
        ${kpi(
          "Primera respuesta",
          m.avgFirstResponseMs === null ? "Sin datos" : formatDuration(m.avgFirstResponseMs),
          "tiempo promedio hasta que soporte contesta",
        )}
        ${kpi(
          "Tiempo de resolución",
          m.avgResolutionMs === null ? "Sin datos" : formatDuration(m.avgResolutionMs),
          "promedio desde que se crea hasta que se cierra",
        )}
        ${kpi(
          "Vencidos",
          String(m.overdueOpen),
          m.overdueOpen === 1 ? "ticket activo fuera de plazo" : "tickets activos fuera de plazo",
          m.overdueOpen > 0 ? "kpi--alert" : "",
        )}
        ${kpi("Sin asignar", String(m.unassigned), "tickets activos esperando a un agente", m.unassigned > 0 ? "kpi--warn" : "")}
      </section>

      <div class="charts">
        <section class="chart-card">
          <h2>Tickets por estado</h2>
          <div class="stack" role="img" aria-label="${STATUSES.map((s) => `${STATUS_LABEL[s]}: ${m.byStatus[s]}`).join(", ")}">
            ${STATUSES.filter((s) => m.byStatus[s] > 0).map(
              (s) => html`<span class="stack__seg stack__seg--${s}" style="flex-grow:${m.byStatus[s]}" title="${STATUS_LABEL[s]}: ${m.byStatus[s]}"></span>`,
            )}
          </div>
          <ul class="legend">
            ${STATUSES.map(
              (s) => html`<li><span class="legend__swatch stack__seg--${s}" aria-hidden="true"></span>${STATUS_LABEL[s]} <strong>${m.byStatus[s]}</strong></li>`,
            )}
          </ul>
        </section>

        <section class="chart-card">
          <h2>Tickets por categoría</h2>
          <ul class="bars">
            ${m.byCategory.map(
              (c) => html`
                <li class="bars__row" title="${CATEGORY_LABEL[c.category]}: ${c.count}">
                  <span class="bars__label">${CATEGORY_LABEL[c.category]}</span>
                  <span class="bars__track"><span class="bars__fill" style="width:${(c.count / maxCategory) * 100}%"></span></span>
                  <span class="bars__value">${c.count}</span>
                </li>
              `,
            )}
          </ul>
        </section>

        <section class="chart-card">
          <h2>Carga por agente</h2>
          <ul class="bars">
            ${load.map(
              (l) => html`
                <li class="bars__row" title="${l.agent.fullName}: ${l.open} activos, ${l.closed} cerrados">
                  <span class="bars__label">${l.agent.fullName}</span>
                  <span class="bars__track bars__track--split">
                    <span class="bars__fill" style="width:${(l.open / maxLoad) * 100}%"></span>
                    <span class="bars__fill bars__fill--muted" style="width:${(l.closed / maxLoad) * 100}%"></span>
                  </span>
                  <span class="bars__value">${l.open} / ${l.closed}</span>
                </li>
              `,
            )}
          </ul>
          <ul class="legend">
            <li><span class="legend__swatch bars__fill" aria-hidden="true"></span>Activos</li>
            <li><span class="legend__swatch bars__fill--muted" aria-hidden="true"></span>Cerrados</li>
          </ul>
        </section>
      </div>
    `,
  );
}
