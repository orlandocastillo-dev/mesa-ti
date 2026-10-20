import type { Category, Priority, Status } from "../types.ts";

export const STATUS_LABEL: Record<Status, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  cerrado: "Cerrado",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  hardware: "Hardware",
  software: "Software",
  red: "Red e internet",
  accesos: "Accesos y contraseñas",
  correo: "Correo",
  otro: "Otro",
};

export const STATUSES = Object.keys(STATUS_LABEL) as Status[];
export const PRIORITIES = Object.keys(PRIORITY_LABEL) as Priority[];
export const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

export function ticketCode(id: number): string {
  return `MT-${String(id).padStart(4, "0")}`;
}
