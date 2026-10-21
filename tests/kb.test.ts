import { describe, expect, it } from "vitest";
import { GUIDES, suggestGuides } from "../src/domain/kb.ts";
import { createSeed } from "../src/data/seed.ts";
import { parseHash } from "../src/ui/router.ts";

describe("sugerir guías", () => {
  it("encuentra la guía por lo que escribe la persona, sin importar tildes ni mayúsculas", () => {
    expect(suggestGuides("Wi-Fi conectado pero SIN INTERNET en la sala")[0].slug).toBe("conectado-sin-internet");
    expect(suggestGuides("la impresora del segundo piso no imprime")[0].slug).toBe("impresora-cola-atascada");
    expect(suggestGuides("En las llamadas no me escuchan, la diadema no tiene micrófono")[0].slug).toBe("diadema-sin-microfono-softphone");
    expect(suggestGuides("El equipo está muy lento al iniciar")[0].slug).toBe("equipo-lento-disco-al-100");
  });

  it("no sugiere nada si no hay palabras relacionadas, aunque coincida la categoría", () => {
    expect(suggestGuides("Solicitud de instalación de Power BI", "hardware")).toEqual([]);
    expect(suggestGuides("")).toEqual([]);
  });

  it("no confunde palabras que solo contienen una clave", () => {
    // "red" está dentro de "redactar", pero no es la misma palabra.
    expect(suggestGuides("no puedo redactar el informe").map((g) => g.slug)).not.toContain("conectado-sin-internet");
  });

  it("los tickets de ejemplo de esos problemas tienen su guía", () => {
    const seed = createSeed(Date.now());
    const withGuide = seed.tickets.filter((t) => suggestGuides(`${t.title} ${t.description}`, t.category, 1).length);
    expect(withGuide.length).toBeGreaterThanOrEqual(4);
  });

  it("cada guía tiene su archivo y su ruta", () => {
    for (const g of GUIDES) expect(parseHash(`#/guias/${g.slug}`)).toEqual({ name: "guide", slug: g.slug });
    expect(parseHash("#/guias")).toEqual({ name: "kb" });
    expect(parseHash("#/como-funciona")).toEqual({ name: "intro" });
  });
});
