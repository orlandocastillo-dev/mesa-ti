let region: HTMLElement | null = null;

function ensureRegion(): HTMLElement {
  if (region) return region;
  region = document.createElement("div");
  region.className = "toasts";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  document.body.append(region);
  return region;
}

export function toast(message: string, tone: "ok" | "error" = "ok") {
  const el = document.createElement("div");
  el.className = `toast toast--${tone}`;
  el.textContent = message;
  ensureRegion().append(el);
  setTimeout(() => {
    el.classList.add("toast--leaving");
    el.addEventListener("animationend", () => el.remove(), { once: true });
    // Respaldo si las animaciones están desactivadas.
    setTimeout(() => el.remove(), 400);
  }, 3600);
}
