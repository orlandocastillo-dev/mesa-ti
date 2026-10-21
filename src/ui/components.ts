import type { Priority, Profile, Status, Ticket } from "../types.ts";
import { PRIORITY_LABEL, STATUS_LABEL } from "../domain/labels.ts";
import { slaState } from "../domain/sla.ts";
import { initials } from "./format.ts";
import { html } from "./html.ts";

export function statusPill(status: Status) {
  return html`<span class="pill pill--${status}">${STATUS_LABEL[status]}</span>`;
}

export function priorityTag(priority: Priority) {
  return html`<span class="priority priority--${priority}"><span class="priority__bars" aria-hidden="true"></span>${PRIORITY_LABEL[priority]}</span>`;
}

export function slaText(ticket: Ticket, now = new Date()) {
  const s = slaState(ticket, now);
  return html`<span class="sla sla--${s.kind}">${s.label}</span>`;
}

export function avatar(profile: Profile | undefined, size: "sm" | "md" = "sm") {
  if (!profile) return html`<span class="avatar avatar--${size} avatar--empty" aria-hidden="true">?</span>`;
  return html`<span class="avatar avatar--${size} avatar--${profile.role}" aria-hidden="true">${initials(profile.fullName)}</span>`;
}

export function icon(name: "inbox" | "plus" | "chart" | "search" | "logout" | "back" | "reset" | "book" | "info" | "bulb") {
  const paths: Record<typeof name, string> = {
    inbox: "M4 13h4l2 3h4l2-3h4M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z",
    plus: "M12 5v14M5 12h14",
    chart: "M5 19V10M12 19V5M19 19v-7",
    search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
    logout: "M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l-4-4 4-4M6 12h10",
    back: "M15 18l-6-6 6-6",
    reset: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
    book: "M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9M9 8h5",
    info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
    bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  };
  return html`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
}
