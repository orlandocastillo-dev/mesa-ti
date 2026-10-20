import { beforeEach, describe, expect, it } from "vitest";
import { LocalRepository, type KeyValueStorage } from "../src/data/local.ts";
import { PermissionError } from "../src/data/repository.ts";

class MemoryStorage implements KeyValueStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

let repo: LocalRepository;
const as = (userId: string) => {
  if (repo.auth.kind === "demo") repo.auth.switchTo(userId);
};

beforeEach(() => {
  repo = new LocalRepository(new MemoryStorage(), () => new Date("2026-10-19T15:00:00Z"));
});

describe("LocalRepository: permisos equivalentes a RLS", () => {
  it("un cliente solo ve sus propios tickets", async () => {
    as("u-camila");
    const tickets = await repo.listTickets();
    expect(tickets.length).toBeGreaterThan(0);
    expect(tickets.every((t) => t.requesterId === "u-camila")).toBe(true);
  });

  it("un cliente no puede abrir el ticket de otra persona", async () => {
    as("u-camila");
    expect(await repo.getTicket(2)).toBeNull(); // es de Andrés
  });

  it("un cliente no puede cambiar el estado", async () => {
    as("u-camila");
    await expect(repo.updateTicket(3, { status: "cerrado" })).rejects.toBeInstanceOf(PermissionError);
  });

  it("un agente ve todos los tickets", async () => {
    as("u-orlando");
    expect((await repo.listTickets()).length).toBe(9);
  });
});

describe("LocalRepository: flujo completo", () => {
  it("crear, responder y cerrar deja el historial y las métricas correctas", async () => {
    as("u-camila");
    const created = await repo.createTicket({
      title: "No funciona la cámara",
      description: "La cámara no aparece en Teams desde la actualización.",
      category: "hardware",
      priority: "alta",
    });
    expect(created).toMatchObject({ status: "abierto", requesterId: "u-camila", assigneeId: null });

    as("u-orlando");
    await repo.updateTicket(created.id, { assigneeId: "u-orlando", status: "en_proceso" });
    await repo.addComment(created.id, "Reinstalé el controlador de la cámara.");
    const closed = await repo.updateTicket(created.id, { status: "cerrado" });

    expect(closed.resolvedAt).not.toBeNull();
    expect(closed.firstResponseAt).not.toBeNull();

    const kinds = (await repo.listActivity(created.id)).map((a) => a.kind);
    expect(kinds).toEqual(["asignacion", "estado", "comentario", "estado"]);
  });

  it("no se puede comentar un ticket cerrado", async () => {
    as("u-orlando");
    await expect(repo.addComment(1, "hola")).rejects.toThrow(/cerrado/);
  });

  it("valida los datos antes de crear", async () => {
    await expect(
      repo.createTicket({ title: "x", description: "corta", category: "otro", priority: "media" }),
    ).rejects.toThrow();
  });

  it("restablecer vuelve a los datos de ejemplo", async () => {
    as("u-orlando");
    await repo.createTicket({ title: "Ticket temporal", description: "Se borra al restablecer.", category: "otro", priority: "baja" });
    if (repo.auth.kind === "demo") repo.auth.reset();
    expect((await repo.listTickets()).length).toBe(9);
  });
});
