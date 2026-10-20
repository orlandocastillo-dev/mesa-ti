export type Route =
  | { name: "list"; query: URLSearchParams }
  | { name: "detail"; id: number }
  | { name: "new" }
  | { name: "metrics" }
  | { name: "not-found" };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#/, "") || "/tickets";
  const [path, search = ""] = clean.split("?");

  if (path === "/" || path === "/tickets") return { name: "list", query: new URLSearchParams(search) };
  if (path === "/nuevo") return { name: "new" };
  if (path === "/metricas") return { name: "metrics" };

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
