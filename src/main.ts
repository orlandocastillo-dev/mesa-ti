import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles/main.css";

import type { AppContext } from "./context.ts";
import { LocalRepository } from "./data/local.ts";
import type { TicketRepository } from "./data/repository.ts";
import { SupabaseRepository } from "./data/supabase.ts";
import { parseHash } from "./ui/router.ts";
import { html, render } from "./ui/html.ts";
import { renderShell } from "./views/layout.ts";
import { renderLogin } from "./views/login.ts";
import { renderMetrics } from "./views/metrics.ts";
import { renderNewTicket } from "./views/new-ticket.ts";
import { renderTicketDetail } from "./views/ticket-detail.ts";
import { renderTicketList } from "./views/ticket-list.ts";

function createRepository(): TicketRepository {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) return new SupabaseRepository(url, key);

  let storage: Storage | Map<string, string>;
  try {
    storage = window.localStorage;
  } catch {
    storage = new Map();
  }
  const adapter =
    storage instanceof Map
      ? {
          getItem: (k: string) => storage.get(k) ?? null,
          setItem: (k: string, v: string) => void storage.set(k, v),
          removeItem: (k: string) => void storage.delete(k),
        }
      : storage;
  return new LocalRepository(adapter);
}

const app = document.querySelector<HTMLElement>("#app")!;
const repo = createRepository();

let renderId = 0;
let lastRouteKey = "";

async function draw() {
  // Si llega otro render mientras este espera datos, el anterior se descarta.
  const id = ++renderId;

  try {
    const user = await repo.currentUser();
    if (id !== renderId) return;

    if (!user) {
      renderLogin(app, repo, draw);
      return;
    }

    const profiles = new Map((await repo.listProfiles()).map((p) => [p.id, p]));
    if (id !== renderId) return;

    const ctx: AppContext = { repo, user, profiles, refresh: draw };
    const route = parseHash(location.hash);
    const view = renderShell(app, ctx, route);

    switch (route.name) {
      case "list":
        await renderTicketList(view, ctx, route.query);
        document.title = "Tickets | MesaTI";
        break;
      case "detail":
        await renderTicketDetail(view, ctx, route.id);
        document.title = `Ticket ${route.id} | MesaTI`;
        break;
      case "new":
        renderNewTicket(view, ctx);
        document.title = "Nuevo ticket | MesaTI";
        break;
      case "metrics":
        await renderMetrics(view, ctx);
        document.title = "Métricas | MesaTI";
        break;
      default:
        render(view, html`<div class="empty"><h1>Esta página no existe</h1><a class="btn" href="#/tickets">Ir a la bandeja</a></div>`);
    }

    // Al cambiar de página se mueve el foco al contenido, como haría una navegación normal.
    const routeKey = route.name === "detail" ? `detail-${route.id}` : route.name;
    if (routeKey !== lastRouteKey) {
      lastRouteKey = routeKey;
      if (!view.querySelector(":focus")) view.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  } catch (err) {
    console.error(err);
    render(
      app,
      html`<div class="empty empty--page"><h1>No pudimos cargar la mesa de ayuda</h1><p>${err instanceof Error ? err.message : ""}</p><button class="btn" onclick="location.reload()">Reintentar</button></div>`,
    );
  }
}

window.addEventListener("hashchange", draw);
repo.subscribe(draw);
void draw();
