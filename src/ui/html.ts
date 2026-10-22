// Plantillas HTML seguras: todo valor interpolado se escapa salvo que venga envuelto en `raw()` o sea el resultado de otra plantilla `html`
const SAFE = Symbol("safe-html");

export interface SafeHtml {
  readonly [SAFE]: true;
  readonly value: string;
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escape(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export function raw(value: string): SafeHtml {
  return { [SAFE]: true, value };
}

function isSafe(value: unknown): value is SafeHtml {
  return typeof value === "object" && value !== null && SAFE in value;
}

function serialize(value: unknown): string {
  if (value === null || value === undefined || value === false) return "";
  if (Array.isArray(value)) return value.map(serialize).join("");
  if (isSafe(value)) return value.value;
  return escape(value);
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0];
  values.forEach((value, i) => {
    out += serialize(value) + strings[i + 1];
  });
  return raw(out);
}

export function render(target: Element, content: SafeHtml) {
  target.innerHTML = content.value;
}
