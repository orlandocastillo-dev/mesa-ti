import type { Category } from "../types.ts";

/**
 * Base de conocimiento: las guías que sigue el agente para resolver los problemas más comunes.
 * Aquí solo vive lo que la app necesita para sugerirlas; el texto de cada guía está en src/kb/*.md.
 */
export interface Guide {
  slug: string;
  title: string;
  /** Una línea para la lista y las sugerencias. */
  summary: string;
  category: Category;
  minutes: string;
  /** Palabras que suele usar la gente al reportar ese problema, sin tildes y en minúscula. */
  keywords: string[];
}

export const GUIDES: Guide[] = [
  {
    slug: "conectado-sin-internet",
    title: 'Wi-Fi o cable "Conectado, sin internet"',
    summary: "El equipo está en la red pero no abre páginas, Teams ni el correo.",
    category: "red",
    minutes: "10 a 20 min",
    keywords: ["internet", "wifi", "wi-fi", "red", "conectado", "sin acceso", "cable", "navegar", "paginas", "dns", "ip"],
  },
  {
    slug: "equipo-lento-disco-al-100",
    title: "Equipo lento al iniciar y disco al 100 %",
    summary: "Tarda varios minutos en arrancar y el Administrador de tareas muestra el disco al tope.",
    category: "hardware",
    minutes: "30 a 60 min",
    keywords: ["lento", "lenta", "demora", "tarda", "disco", "100", "arranque", "iniciar", "inicio", "congela", "pegado"],
  },
  {
    slug: "impresora-cola-atascada",
    title: "La impresora no imprime: cola atascada",
    summary: "Los documentos se quedan en la cola o la impresora aparece sin conexión.",
    category: "hardware",
    minutes: "5 a 15 min",
    keywords: ["impresora", "imprime", "imprimir", "impresion", "cola", "atascado", "atascada", "toner", "papel"],
  },
  {
    slug: "diadema-sin-microfono-softphone",
    title: "Diadema sin micrófono o sin audio en el softphone",
    summary: "En las llamadas no te escuchan o no escuchas al cliente.",
    category: "hardware",
    minutes: "5 a 15 min",
    keywords: ["diadema", "audifonos", "auriculares", "microfono", "audio", "sonido", "escucha", "escuchan", "softphone", "llamada", "llamadas"],
  },
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/**
 * Guías que pueden resolver lo que alguien describe, de la más a la menos parecida.
 * Cuenta las palabras clave que aparecen como palabra entera (o en plural) y suma un punto si coincide
 * la categoría. Hace falta al menos una palabra clave: la categoría sola no basta.
 */
export function suggestGuides(text: string, category?: Category, limit = 2): Guide[] {
  const t = ` ${norm(text).replace(/[^a-z0-9-]+/g, " ")} `;
  return GUIDES.map((g) => {
    const hits = g.keywords.filter((k) => [` ${k} `, ` ${k}s `, ` ${k}es `].some((w) => t.includes(w))).length;
    return { g, score: hits ? hits + (category === g.category ? 1 : 0) : 0 };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.g);
}
