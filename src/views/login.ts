import type { TicketRepository } from "../data/repository.ts";
import { html, render } from "../ui/html.ts";

type Mode = "login" | "signup";

export function renderLogin(root: HTMLElement, repo: TicketRepository, onDone: () => void, mode: Mode = "login", message = "") {
  if (repo.auth.kind !== "supabase") return;
  const auth = repo.auth;

  render(
    root,
    html`
      <main class="login">
        <div class="login__card">
          <p class="brand brand--dark"><span class="brand__mark" aria-hidden="true"></span>MesaTI</p>
          <h1>${mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}</h1>
          <p class="muted">
            ${mode === "login"
              ? "Usa el correo con el que te registraste en la mesa de ayuda."
              : "Las cuentas nuevas entran como usuario. Un administrador puede darte rol de agente."}
          </p>

          <form class="login__form" data-auth novalidate>
            ${mode === "signup"
              ? html`<div class="field"><label for="name">Nombre completo</label><input id="name" name="name" autocomplete="name" required /></div>`
              : null}
            <div class="field">
              <label for="email">Correo</label>
              <input id="email" name="email" type="email" autocomplete="email" required />
            </div>
            <div class="field">
              <label for="password">Contraseña</label>
              <input id="password" name="password" type="password" minlength="8" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required />
            </div>
            <p class="field-error" role="alert" data-error>${message}</p>
            <button class="btn btn--primary btn--block" type="submit">${mode === "login" ? "Entrar" : "Crear cuenta"}</button>
          </form>

          <p class="login__switch">
            ${mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}
            <button type="button" class="link" data-switch>${mode === "login" ? "Regístrate" : "Inicia sesión"}</button>
          </p>
        </div>
      </main>
    `,
  );

  root.querySelector("[data-switch]")?.addEventListener("click", () =>
    renderLogin(root, repo, onDone, mode === "login" ? "signup" : "login"),
  );

  const form = root.querySelector<HTMLFormElement>("[data-auth]")!;
  const errorEl = root.querySelector<HTMLElement>("[data-error]")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim();

    if (!email || password.length < 8 || (mode === "signup" && name.length < 3)) {
      errorEl.textContent =
        password.length < 8 ? "La contraseña debe tener al menos 8 caracteres." : "Completa todos los campos.";
      return;
    }

    const button = form.querySelector("button")!;
    button.disabled = true;
    try {
      if (mode === "login") {
        await auth.signIn(email, password);
        onDone();
      } else {
        const { needsConfirmation } = await auth.signUp(email, password, name);
        if (needsConfirmation) {
          renderLogin(root, repo, onDone, "login", "Te enviamos un correo para confirmar la cuenta. Después inicia sesión.");
        } else {
          onDone();
        }
      }
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : "No se pudo completar la solicitud.";
      button.disabled = false;
    }
  });
}
