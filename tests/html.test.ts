import { describe, expect, it } from "vitest";
import { html, raw } from "../src/ui/html.ts";

describe("html", () => {
  it("escapa los valores interpolados", () => {
    const evil = `<img src=x onerror="alert(1)">`;
    expect(html`<p>${evil}</p>`.value).toBe("<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>");
  });

  it("no vuelve a escapar plantillas anidadas ni raw()", () => {
    const inner = html`<b>${"a & b"}</b>`;
    expect(html`<p>${inner}${raw("<i>ok</i>")}</p>`.value).toBe("<p><b>a &amp; b</b><i>ok</i></p>");
  });

  it("ignora null, undefined y false y une arreglos", () => {
    expect(html`${null}${undefined}${false}${[1, 2, 3]}`.value).toBe("123");
  });
});
