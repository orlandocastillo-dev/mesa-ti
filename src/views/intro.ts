import type { AppContext } from "../context.ts";
import { GUIDES } from "../domain/kb.ts";
import { html, render } from "../ui/html.ts";

const SEEN = "mesati:intro-visto";

export function introSeen(): boolean {
  try {
    return localStorage.getItem(SEEN) === "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN, "1");
  } catch {
    // Sin almacenamiento: la presentación vuelve a salir la próxima vez, no pasa nada.
  }
}

/** De dónde salen los tickets y qué hace cada quien: lo primero que ve alguien que abre la demo. */
export function renderIntro(root: HTMLElement, ctx: AppContext) {
  markSeen();
  const demo = ctx.repo.auth.kind === "demo" ? ctx.repo.auth : null;
  const client = demo?.users().find((u) => u.role === "cliente");
  const agent = demo?.users().find((u) => u.role === "agente");

  render(
    root,
    html`
      <section class="intro">
        <p class="intro__kicker">Mesa de ayuda para el área de TI de una empresa</p>
        <h1>Cuando a alguien se le daña algo en el trabajo, lo reporta aquí y soporte lo resuelve a tiempo.</h1>
        <p class="intro__lead">
          Los empleados reportan sus problemas (no imprime, no hay internet, la diadema no tiene micrófono). Los técnicos los atienden por
          urgencia, siguen las guías de la base de conocimiento y cada ticket tiene un plazo según su prioridad. Así nada se pierde en un
          chat o en un correo.
        </p>

        <ol class="flow">
          <li>
            <span class="flow__n">1</span>
            <h2>El empleado reporta</h2>
            <p>Escribe qué le pasa y qué tan urgente es. Mientras escribe, la app le sugiere una guía por si lo puede resolver solo.</p>
          </li>
          <li>
            <span class="flow__n">2</span>
            <h2>Soporte lo atiende</h2>
            <p>El técnico ve la bandeja ordenada por lo que vence antes, toma el ticket, sigue la guía sugerida y responde dentro del ticket.</p>
          </li>
          <li>
            <span class="flow__n">3</span>
            <h2>Se cierra y se mide</h2>
            <p>Al cerrarlo queda el historial y cuenta en las métricas: cumplimiento del plazo, tiempo de respuesta y carga por técnico.</p>
          </li>
        </ol>

        ${demo && client && agent
          ? html`
              <div class="roles">
                <button type="button" class="role" data-as="${client.id}" data-go="#/nuevo">
                  <span class="role__who">Ver como empleado</span>
                  <span class="role__name">${client.fullName}</span>
                  <span class="role__what">Reporta un problema y sigue su estado.</span>
                </button>
                <button type="button" class="role role--agent" data-as="${agent.id}" data-go="#/tickets">
                  <span class="role__who">Ver como técnico de soporte</span>
                  <span class="role__name">${agent.fullName}</span>
                  <span class="role__what">Atiende la bandeja, usa las guías y mira las métricas.</span>
                </button>
              </div>
              <p class="muted small">
                Es una demo: los tickets son de ejemplo y se guardan en tu navegador. Puedes crear, responder y cerrar los que quieras, y
                volver a los datos iniciales desde la barra lateral. La base de conocimiento tiene ${GUIDES.length} guías reales de soporte
                de primer nivel.
              </p>
            `
          : html`<a class="btn btn--primary" href="#/tickets">Ir a la bandeja</a>`}
      </section>
    `,
  );

  root.querySelectorAll<HTMLButtonElement>("[data-as]").forEach((b) =>
    b.addEventListener("click", () => {
      demo?.switchTo(b.dataset.as!);
      location.hash = b.dataset.go!;
      ctx.refresh();
    }),
  );
}
