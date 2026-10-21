import { marked } from "marked";
import type { AppContext } from "../context.ts";
import { GUIDES, guideBySlug, type Guide } from "../domain/kb.ts";
import { CATEGORY_LABEL } from "../domain/labels.ts";
import { icon } from "../ui/components.ts";
import { html, raw, render } from "../ui/html.ts";

/** El texto de cada guía, empaquetado con la app: "01-conectado-sin-internet.md" → slug "conectado-sin-internet". */
const FILES = import.meta.glob("../kb/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const MARKDOWN = new Map(Object.entries(FILES).map(([path, text]) => [path.replace(/^.*\/\d+-|\.md$/g, ""), text]));

export function guideMarkdown(slug: string): string | undefined {
  return MARKDOWN.get(slug);
}

/** Tarjeta corta para sugerir una guía dentro de un ticket o del formulario. */
export function guideLink(g: Guide) {
  return html`<a class="guide-link" href="#/guias/${g.slug}">
    <span class="guide-link__title">${g.title}</span>
    <span class="guide-link__meta">${CATEGORY_LABEL[g.category]} · ${g.minutes}</span>
  </a>`;
}

export function renderKbList(root: HTMLElement, ctx: AppContext) {
  const isAgent = ctx.user.role === "agente";
  render(
    root,
    html`
      <header class="page-head">
        <div>
          <h1>Base de conocimiento</h1>
          <p class="muted">
            ${isAgent
              ? "Las guías que sigue soporte para resolver los problemas más comunes. Cuando llega un ticket parecido, la bandeja te sugiere la guía."
              : "Antes de reportar, revisa si tu problema tiene solución aquí. Muchos se arreglan en menos de 15 minutos."}
          </p>
        </div>
      </header>

      <ol class="kb">
        ${GUIDES.map(
          (g, i) => html`
            <li>
              <a class="kb__item" href="#/guias/${g.slug}">
                <span class="kb__num">${String(i + 1).padStart(2, "0")}</span>
                <span class="kb__body">
                  <span class="kb__title">${g.title}</span>
                  <span class="kb__summary">${g.summary}</span>
                </span>
                <span class="kb__meta">${CATEGORY_LABEL[g.category]}<br />${g.minutes}</span>
              </a>
            </li>
          `,
        )}
      </ol>

      <section class="kb-scripts" aria-labelledby="scripts-title">
        <h2 id="scripts-title">Scripts de apoyo (PowerShell)</h2>
        <p class="muted">Automatizan los pasos de diagnóstico de las guías y dejan un informe para adjuntar al ticket.</p>
        <ul>
          <li><a href="scripts/diagnostico-red.ps1" download>diagnostico-red.ps1</a> <span class="muted">Pruebas de red de la guía 01.</span></li>
          <li><a href="scripts/info-equipo.ps1" download>info-equipo.ps1</a> <span class="muted">Datos del equipo para el ticket.</span></li>
          <li><a href="scripts/limpiar-cola-impresion.ps1" download>limpiar-cola-impresion.ps1</a> <span class="muted">Pasos 2 a 4 de la guía 03.</span></li>
        </ul>
      </section>
    `,
  );
}

export async function renderGuide(root: HTMLElement, ctx: AppContext, slug: string) {
  const guide = guideBySlug(slug);
  const text = guideMarkdown(slug);
  if (!guide || !text) {
    render(root, html`<div class="empty"><h1>No encontramos esa guía</h1><a class="btn" href="#/guias">Ver todas las guías</a></div>`);
    return;
  }
  const isAgent = ctx.user.role === "agente";
  // El contenido sale de los .md del proyecto, no de lo que escribe un usuario: se puede insertar como HTML.
  const body = await marked.parse(text.replace(/```mermaid\n([\s\S]*?)```/g, (_, code: string) => `<pre class="mermaid">${code}</pre>`));

  render(
    root,
    html`
      <a class="back" href="#/guias">${icon("back")} Base de conocimiento</a>
      <article class="guide">${raw(body)}</article>
      <aside class="guide-end">
        ${isAgent
          ? html`<p>¿La guía resolvió el ticket? Ciérralo desde la bandeja y queda en las métricas.</p>
              <a class="btn" href="#/tickets">Ir a la bandeja</a>`
          : html`<p>¿Seguiste los pasos y sigue sin funcionar? Reporta el problema y soporte lo toma desde ahí.</p>
              <a class="btn btn--primary" href="#/nuevo?guia=${guide.slug}">Reportar el problema</a>`}
      </aside>
    `,
  );

  const diagrams = root.querySelectorAll<HTMLElement>(".mermaid");
  if (diagrams.length) {
    try {
      const { default: mermaid } = await import("mermaid");
      mermaid.initialize({ startOnLoad: false, theme: "neutral", fontFamily: "IBM Plex Sans, sans-serif" });
      await mermaid.run({ nodes: diagrams });
    } catch (err) {
      console.warn("No se pudo dibujar el diagrama", err);
    }
  }
}
