import type { AppContext } from "../context.ts";
import type { Route } from "../ui/router.ts";
import { avatar, icon } from "../ui/components.ts";
import { html, render } from "../ui/html.ts";

export function renderShell(app: HTMLElement, ctx: AppContext, route: Route): HTMLElement {
  const isAgent = ctx.user.role === "agente";
  const current = (name: Route["name"]) => (route.name === name ? "page" : "false");
  const demo = ctx.repo.auth.kind === "demo" ? ctx.repo.auth : null;

  render(
    app,
    html`
      <div class="shell">
        <aside class="sidebar">
          <a class="brand" href="#/tickets"><span class="brand__mark" aria-hidden="true"></span>MesaTI</a>
          <nav aria-label="Principal">
            <ul class="nav">
              <li><a href="#/tickets" aria-current="${current("list")}">${icon("inbox")} ${isAgent ? "Bandeja" : "Mis tickets"}</a></li>
              <li><a href="#/nuevo" aria-current="${current("new")}">${icon("plus")} Nuevo ticket</a></li>
              ${isAgent ? html`<li><a href="#/metricas" aria-current="${current("metrics")}">${icon("chart")} Métricas</a></li>` : null}
            </ul>
          </nav>

          <div class="me">
            <div class="me__who">
              ${avatar(ctx.user, "md")}
              <div>
                <p class="me__name">${ctx.user.fullName}</p>
                <p class="me__role">${isAgent ? "Agente de soporte" : "Usuario"}</p>
              </div>
            </div>
            ${demo
              ? html`
                  <label class="me__switch">
                    <span>Ver como</span>
                    <select data-switch-user>
                      ${demo.users().map(
                        (u) => html`<option value="${u.id}" ${u.id === ctx.user.id ? "selected" : ""}>${u.fullName} (${u.role})</option>`,
                      )}
                    </select>
                  </label>
                  <button class="sidebar__action" type="button" data-reset>${icon("reset")} Restablecer datos de ejemplo</button>
                `
              : html`<button class="sidebar__action" type="button" data-logout>${icon("logout")} Cerrar sesión</button>`}
          </div>
        </aside>
        <div class="main-col">
      ${demo
            ? html`
                <div class="demo-bar">
                  <p>
                    <strong>Modo demo.</strong> Los datos se guardan en este navegador.
                  </p>
                  <div class="demo-bar__views" role="group" aria-label="Ver la app como">
                    ${demo.users().filter((u, i, all) => all.findIndex((x) => x.role === u.role) === i).map(
                      (u) => html`<button type="button" class="demo-bar__view" data-view-as="${u.id}" aria-pressed="${u.role === ctx.user.role}">
                        Ver como ${u.role === "agente" ? "agente" : "cliente"}
                      </button>`,
                    )}
                  </div>
                </div>
              `
            : null}
          <main class="content" id="view" tabindex="-1"></main>
        </div>
      </div>
    `,
  );

  if (demo) {
    app.querySelector<HTMLSelectElement>("[data-switch-user]")?.addEventListener("change", (e) => {
      demo.switchTo((e.target as HTMLSelectElement).value);
      location.hash = "#/tickets";
      ctx.refresh();
    });
    app.querySelectorAll<HTMLButtonElement>("[data-view-as]").forEach((b) =>
      b.addEventListener("click", () => {
        demo.switchTo(b.dataset.viewAs!);
        location.hash = "#/tickets";
        ctx.refresh();
      }),
    );
    app.querySelector("[data-reset]")?.addEventListener("click", () => {
      demo.reset();
      location.hash = "#/tickets";
      ctx.refresh();
    });
  } else if (ctx.repo.auth.kind === "supabase") {
    const auth = ctx.repo.auth;
    app.querySelector("[data-logout]")?.addEventListener("click", async () => {
      await auth.signOut();
      ctx.refresh();
    });
  }

  return app.querySelector<HTMLElement>("#view")!;
}
