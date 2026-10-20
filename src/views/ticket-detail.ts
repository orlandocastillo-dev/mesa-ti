import type { AppContext } from "../context.ts";
import { profileName } from "../context.ts";
import { CATEGORY_LABEL, PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, STATUSES, ticketCode } from "../domain/labels.ts";
import { formatDuration, SLA_HOURS, slaDeadline } from "../domain/sla.ts";
import type { Activity, Priority, Status, Ticket } from "../types.ts";
import { avatar, icon, priorityTag, slaText, statusPill } from "../ui/components.ts";
import { fullDate, relativeTime } from "../ui/format.ts";
import { html, render } from "../ui/html.ts";
import { toast } from "../ui/toast.ts";

export async function renderTicketDetail(root: HTMLElement, ctx: AppContext, id: number) {
  const ticket = await ctx.repo.getTicket(id);

  if (!ticket) {
    render(
      root,
      html`
        <div class="empty">
          <h1>No encontramos el ticket ${ticketCode(id)}</h1>
          <p>Puede que no exista o que no tengas acceso a él.</p>
          <a class="btn" href="#/tickets">Volver a la bandeja</a>
        </div>
      `,
    );
    return;
  }

  const activity = await ctx.repo.listActivity(id);
  const isAgent = ctx.user.role === "agente";
  const agents = [...ctx.profiles.values()].filter((p) => p.role === "agente");
  const closed = ticket.status === "cerrado";

  render(
    root,
    html`
      <a class="back" href="#/tickets">${icon("back")} Volver a la bandeja</a>

      <header class="detail-head">
        <span class="code">${ticketCode(ticket.id)}</span>
        <h1>${ticket.title}</h1>
        <div class="detail-head__tags">${statusPill(ticket.status)} ${priorityTag(ticket.priority)} ${slaText(ticket)}</div>
      </header>

      <div class="detail">
        <section class="timeline" aria-label="Conversación e historial">
          ${entry(ctx, {
            authorId: ticket.requesterId,
            createdAt: ticket.createdAt,
            body: ticket.description,
            first: true,
          })}
          ${activity.map((a) => activityItem(ctx, a))}

          ${closed
            ? html`
                <div class="closed-note">
                  <p><strong>Ticket cerrado.</strong> ${ticket.resolvedAt ? `Resuelto ${relativeTime(ticket.resolvedAt)}.` : ""}</p>
                  ${isAgent
                    ? html`<button class="btn" type="button" data-action="reopen">Reabrir ticket</button>`
                    : html`<p class="muted">Si el problema volvió, crea un ticket nuevo y menciona el código ${ticketCode(ticket.id)}.</p>`}
                </div>
              `
            : html`
                <form class="composer" data-composer>
                  <label for="comment" class="composer__label">${isAgent ? "Responder al usuario" : "Agregar información"}</label>
                  <textarea
                    id="comment"
                    name="body"
                    rows="4"
                    maxlength="4000"
                    required
                    placeholder="${isAgent ? "Explica qué hiciste o qué necesitas del usuario" : "Por ejemplo: el error volvió a aparecer a las 3:10 p. m."}"
                  ></textarea>
                  <div class="composer__actions">
                    ${isAgent
                      ? html`<button class="btn" type="submit" name="intent" value="close">Responder y cerrar</button>`
                      : null}
                    <button class="btn btn--primary" type="submit" name="intent" value="comment">Enviar respuesta</button>
                  </div>
                </form>
              `}
        </section>

        <aside class="panel" aria-label="Detalles del ticket">
          ${isAgent ? agentControls(ticket, agents, ctx) : clientSummary(ticket, ctx)}

          <dl class="facts">
            <div><dt>Categoría</dt><dd>${CATEGORY_LABEL[ticket.category]}</dd></div>
            <div><dt>Solicitante</dt><dd>${profileName(ctx, ticket.requesterId)}</dd></div>
            <div><dt>Creado</dt><dd>${fullDate(ticket.createdAt)}</dd></div>
            <div>
              <dt>Plazo de solución</dt>
              <dd>${fullDate(slaDeadline(ticket).toISOString())} <span class="muted">(${SLA_HOURS[ticket.priority]} h por prioridad ${PRIORITY_LABEL[ticket.priority].toLowerCase()})</span></dd>
            </div>
            <div>
              <dt>Primera respuesta</dt>
              <dd>
                ${ticket.firstResponseAt
                  ? `${formatDuration(new Date(ticket.firstResponseAt).getTime() - new Date(ticket.createdAt).getTime())} después de creado`
                  : "Pendiente"}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    `,
  );

  bind(root, ctx, ticket);
}

function entry(
  ctx: AppContext,
  e: { authorId: string; createdAt: string; body: string; first?: boolean },
) {
  const author = ctx.profiles.get(e.authorId);
  const fromAgent = author?.role === "agente";
  return html`
    <article class="entry ${fromAgent ? "entry--agent" : ""} ${e.first ? "entry--first" : ""}">
      ${avatar(author, "md")}
      <div class="entry__bubble">
        <header class="entry__head">
          <strong>${profileName(ctx, e.authorId)}</strong>
          ${fromAgent ? html`<span class="role-tag">Soporte</span>` : null}
          <time datetime="${e.createdAt}" title="${fullDate(e.createdAt)}">${relativeTime(e.createdAt)}</time>
        </header>
        <p class="entry__body">${e.body}</p>
      </div>
    </article>
  `;
}

function activityItem(ctx: AppContext, a: Activity) {
  if (a.kind === "comentario") return entry(ctx, { authorId: a.authorId, createdAt: a.createdAt, body: a.body ?? "" });

  const who = profileName(ctx, a.authorId);
  let text: string;
  switch (a.kind) {
    case "estado":
      text = `${who} cambió el estado de ${STATUS_LABEL[a.fromValue as Status]} a ${STATUS_LABEL[a.toValue as Status]}`;
      break;
    case "prioridad":
      text = `${who} cambió la prioridad de ${PRIORITY_LABEL[a.fromValue as Priority]} a ${PRIORITY_LABEL[a.toValue as Priority]}`;
      break;
    case "asignacion":
      text =
        a.toValue === a.authorId
          ? `${who} tomó el ticket`
          : a.toValue
            ? `${who} asignó el ticket a ${profileName(ctx, a.toValue)}`
            : `${who} quitó la asignación`;
      break;
  }
  return html`
    <p class="event">
      <span class="event__dot event__dot--${a.kind}" aria-hidden="true"></span>
      <span>${text}</span>
      <time datetime="${a.createdAt}" title="${fullDate(a.createdAt)}">${relativeTime(a.createdAt)}</time>
    </p>
  `;
}

function agentControls(ticket: Ticket, agents: AppContext["user"][], ctx: AppContext) {
  return html`
    <form class="controls" data-controls>
      <label>
        <span>Estado</span>
        <select name="status">
          ${STATUSES.map((s) => html`<option value="${s}" ${ticket.status === s ? "selected" : ""}>${STATUS_LABEL[s]}</option>`)}
        </select>
      </label>
      <label>
        <span>Prioridad</span>
        <select name="priority">
          ${PRIORITIES.map((p) => html`<option value="${p}" ${ticket.priority === p ? "selected" : ""}>${PRIORITY_LABEL[p]}</option>`)}
        </select>
      </label>
      <label>
        <span>Asignado a</span>
        <select name="assigneeId">
          <option value="">Sin asignar</option>
          ${agents.map(
            (a) => html`<option value="${a.id}" ${ticket.assigneeId === a.id ? "selected" : ""}>${a.id === ctx.user.id ? `${a.fullName} (tú)` : a.fullName}</option>`,
          )}
        </select>
      </label>
      ${ticket.assigneeId !== ctx.user.id && ticket.status !== "cerrado"
        ? html`<button class="btn btn--primary btn--block" type="button" data-action="take">Tomar ticket</button>`
        : null}
    </form>
  `;
}

function clientSummary(ticket: Ticket, ctx: AppContext) {
  const steps: { status: Status; text: string }[] = [
    { status: "abierto", text: "Recibido" },
    { status: "en_proceso", text: "En revisión por soporte" },
    { status: "cerrado", text: "Resuelto" },
  ];
  const current = STATUSES.indexOf(ticket.status);
  return html`
    <div class="progress">
      <h2 class="panel__title">Estado de tu solicitud</h2>
      <ol class="steps">
        ${steps.map(
          (s, i) => html`<li class="${i < current ? "is-done" : i === current ? "is-current" : ""}">${s.text}</li>`,
        )}
      </ol>
      <p class="muted">Atiende: <strong>${profileName(ctx, ticket.assigneeId)}</strong></p>
    </div>
  `;
}

function bind(root: HTMLElement, ctx: AppContext, ticket: Ticket) {
  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast(success);
      ctx.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar el cambio.", "error");
    }
  };

  root.querySelector<HTMLFormElement>("[data-controls]")?.addEventListener("change", (e) => {
    const field = e.target as HTMLSelectElement;
    const value = field.value;
    if (field.name === "status") {
      void run(() => ctx.repo.updateTicket(ticket.id, { status: value as Status }), `Estado: ${STATUS_LABEL[value as Status]}`);
    } else if (field.name === "priority") {
      void run(() => ctx.repo.updateTicket(ticket.id, { priority: value as Priority }), `Prioridad: ${PRIORITY_LABEL[value as Priority]}`);
    } else if (field.name === "assigneeId") {
      void run(() => ctx.repo.updateTicket(ticket.id, { assigneeId: value || null }), value ? "Ticket asignado" : "Asignación eliminada");
    }
  });

  root.querySelector('[data-action="take"]')?.addEventListener("click", () => {
    const patch = ticket.status === "abierto"
      ? { assigneeId: ctx.user.id, status: "en_proceso" as const }
      : { assigneeId: ctx.user.id };
    void run(() => ctx.repo.updateTicket(ticket.id, patch), "Tomaste el ticket");
  });

  root.querySelector('[data-action="reopen"]')?.addEventListener("click", () => {
    void run(() => ctx.repo.updateTicket(ticket.id, { status: "en_proceso" }), "Ticket reabierto");
  });

  const composer = root.querySelector<HTMLFormElement>("[data-composer]");
  composer?.addEventListener("submit", (e) => {
    e.preventDefault();
    const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
    const body = String(new FormData(composer).get("body") ?? "");
    const closeAfter = submitter?.value === "close";

    composer.querySelectorAll("button").forEach((b) => (b.disabled = true));
    void run(async () => {
      await ctx.repo.addComment(ticket.id, body);
      if (closeAfter) await ctx.repo.updateTicket(ticket.id, { status: "cerrado" });
    }, closeAfter ? "Respuesta enviada y ticket cerrado" : "Respuesta enviada").finally(() => {
      composer.querySelectorAll("button").forEach((b) => (b.disabled = false));
    });
  });

  // Ctrl/Cmd + Enter envía el comentario.
  composer?.querySelector("textarea")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) composer.requestSubmit();
  });
}
