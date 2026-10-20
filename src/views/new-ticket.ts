import type { AppContext } from "../context.ts";
import { CATEGORIES, CATEGORY_LABEL, ticketCode } from "../domain/labels.ts";
import { SLA_HOURS } from "../domain/sla.ts";
import { validateNewTicket, type TicketErrors } from "../domain/validation.ts";
import type { Category, NewTicket, Priority } from "../types.ts";
import { icon } from "../ui/components.ts";
import { html, render } from "../ui/html.ts";
import { navigate } from "../ui/router.ts";
import { toast } from "../ui/toast.ts";

const PRIORITY_HELP: { value: Priority; title: string; text: string }[] = [
  { value: "critica", title: "Crítica", text: "No puedo trabajar y afecta a varias personas o a clientes." },
  { value: "alta", title: "Alta", text: "No puedo trabajar, pero solo me afecta a mí." },
  { value: "media", title: "Media", text: "Puedo trabajar con dificultad o hay una alternativa temporal." },
  { value: "baja", title: "Baja", text: "Una solicitud o mejora que puede esperar." },
];

export function renderNewTicket(root: HTMLElement, ctx: AppContext) {
  draw(root, ctx, { title: "", description: "", category: "hardware", priority: "media" }, {});
}

function draw(root: HTMLElement, ctx: AppContext, values: NewTicket, errors: TicketErrors) {
  const err = (field: keyof NewTicket) =>
    errors[field] ? html`<p class="field-error" id="${field}-error">${errors[field]}</p>` : null;

  render(
    root,
    html`
      <a class="back" href="#/tickets">${icon("back")} Volver a la bandeja</a>
      <header class="page-head">
        <div>
          <h1>Reportar un problema</h1>
          <p class="muted">Mientras más detalle nos des, más rápido lo resolvemos.</p>
        </div>
      </header>

      <form class="form-card" novalidate data-new-ticket>
        <div class="field">
          <label for="title">Asunto</label>
          <input
            id="title"
            name="title"
            maxlength="120"
            value="${values.title}"
            placeholder="Ej.: Outlook no envía correos con archivos adjuntos"
            aria-invalid="${errors.title ? "true" : "false"}"
            ${errors.title ? "aria-describedby=title-error" : ""}
          />
          ${err("title")}
        </div>

        <div class="field">
          <label for="category">Categoría</label>
          <select id="category" name="category">
            ${CATEGORIES.map(
              (c) => html`<option value="${c}" ${values.category === c ? "selected" : ""}>${CATEGORY_LABEL[c]}</option>`,
            )}
          </select>
        </div>

        <fieldset class="field">
          <legend>¿Qué tan urgente es?</legend>
          <div class="choice-grid">
            ${PRIORITY_HELP.map(
              (p) => html`
                <label class="choice choice--${p.value}">
                  <input type="radio" name="priority" value="${p.value}" ${values.priority === p.value ? "checked" : ""} />
                  <span class="choice__title">${p.title} <span class="muted">(solución en ${SLA_HOURS[p.value]} h)</span></span>
                  <span class="choice__text">${p.text}</span>
                </label>
              `,
            )}
          </div>
        </fieldset>

        <div class="field">
          <label for="description">Descripción</label>
          <textarea
            id="description"
            name="description"
            rows="7"
            maxlength="4000"
            aria-invalid="${errors.description ? "true" : "false"}"
            aria-describedby="description-help${errors.description ? " description-error" : ""}"
          >${values.description}</textarea>
          <p class="help" id="description-help">
            Incluye qué pasa, desde cuándo, qué intentaste y el mensaje de error exacto si aparece alguno.
          </p>
          ${err("description")}
        </div>

        <div class="form-actions">
          <a class="btn" href="#/tickets">Cancelar</a>
          <button class="btn btn--primary" type="submit">Crear ticket</button>
        </div>
      </form>
    `,
  );

  const form = root.querySelector<HTMLFormElement>("[data-new-ticket]")!;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const input: NewTicket = {
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? ""),
      category: data.get("category") as Category,
      priority: data.get("priority") as Priority,
    };

    const found = validateNewTicket(input);
    if (Object.keys(found).length) {
      draw(root, ctx, input, found);
      root.querySelector<HTMLElement>(`#${Object.keys(found)[0]}`)?.focus();
      return;
    }

    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true;
    button.textContent = "Creando…";
    try {
      const ticket = await ctx.repo.createTicket(input);
      toast(`Ticket ${ticketCode(ticket.id)} creado`);
      navigate(`/tickets/${ticket.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo crear el ticket.", "error");
      button.disabled = false;
      button.textContent = "Crear ticket";
    }
  });
}
