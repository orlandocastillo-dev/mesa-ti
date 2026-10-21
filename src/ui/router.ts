export type Route =
  | { name: "list"; query: URLSearchParams }
  | { name: "detail"; id: number }
  | { name: "new" }
  | { name: "metrics" }
  | { name: "kb" }
  | { name: "guide"; slug: string }
  | { name: "intro" }
  | { name: "not-found" };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#/, "") || "/tickets";
  const [path, search = ""] = clean.split("?");

  if (path === "/" || path === "/tickets") return { name: "list", query: new URLSearchParams(search) };
  if (path === "/nuevo") return { name: "new" };
  if (path === "/metricas") return { name: "metrics" };
  if (path === "/guias") return { name: "kb" };
  if (path === "/como-funciona") return { name: "intro" };
  const guide = path.match(/^\/guias\/([a-z0-9-]+)$/);
  if (guide) return { name: "guide", slug: guide[1] };

  const match = path.match(/^\/tickets\/(\d+)$/);
  if (match) return { name: "detail", id: Number(match[1]) };

  return { name: "not-found" };
}

export function navigate(path: string) {
  if (location.hash === `#${path}`) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    location.hash = path;
  }
}
