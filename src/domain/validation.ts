import type { NewTicket } from "../types.ts";
import { CATEGORIES, PRIORITIES } from "./labels.ts";

export type TicketErrors = Partial<Record<keyof NewTicket, string>>;

/** Mismas reglas que los CHECK de la base de datos, para avisar antes de enviar. */
export function validateNewTicket(input: NewTicket): TicketErrors {
  const errors: TicketErrors = {};
  const title = input.title.trim();
  const description = input.description.trim();

  if (title.length < 5) errors.title = "Describe el problema en al menos 5 caracteres.";
  else if (title.length > 120) errors.title = "El asunto no puede pasar de 120 caracteres.";

  if (description.length < 10) errors.description = "Cuéntanos un poco más: qué pasa, desde cuándo y qué intentaste.";
  else if (description.length > 4000) errors.description = "La descripción no puede pasar de 4000 caracteres.";

  if (!CATEGORIES.includes(input.category)) errors.category = "Elige una categoría.";
  if (!PRIORITIES.includes(input.priority)) errors.priority = "Elige una prioridad.";

  return errors;
}

export function sanitizeComment(body: string): string | null {
  const text = body.trim();
  if (!text) return null;
  return text.slice(0, 4000);
}
