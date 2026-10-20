import type { Activity, ActivityKind, NewTicket, Profile, Ticket, TicketPatch } from "../types.ts";
import { sanitizeComment, validateNewTicket } from "../domain/validation.ts";
import { PermissionError, type AuthAdapter, type TicketRepository } from "./repository.ts";
import { createSeed, DEMO_VERSION, type DemoState } from "./seed.ts";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = "mesati:demo";

/**
 * Implementación en el navegador. Reproduce las mismas reglas que las políticas RLS
 * y los triggers de Supabase para que el modo demo se comporte igual que producción.
 */
export class LocalRepository implements TicketRepository {
  readonly auth: AuthAdapter;
  private state: DemoState;
  private listeners = new Set<() => void>();
  private storage: KeyValueStorage;
  private clock: () => Date;

  constructor(storage: KeyValueStorage, clock: () => Date = () => new Date()) {
    this.storage = storage;
    this.clock = clock;
    this.state = this.load();
    this.auth = {
      kind: "demo",
      users: () => this.state.profiles,
      switchTo: (userId) => {
        if (!this.state.profiles.some((p) => p.id === userId)) return;
        this.state.currentUserId = userId;
        this.save();
      },
      reset: () => {
        this.state = createSeed(this.clock().getTime());
        this.save();
      },
    };
  }

  // -- Persistencia ---------------------------------------------------------

  private load(): DemoState {
    try {
      const raw = this.storage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoState;
        if (parsed.version === DEMO_VERSION) return parsed;
      }
    } catch {
      // Datos corruptos o almacenamiento bloqueado: se empieza de cero.
    }
    const seed = createSeed(this.clock().getTime());
    this.write(seed);
    return seed;
  }

  private write(state: DemoState) {
    try {
      this.storage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Sin almacenamiento disponible (modo privado): los datos viven solo en memoria.
    }
  }

  private save() {
    this.write(this.state);
    this.listeners.forEach((fn) => fn());
  }

  /** Recarga desde el almacenamiento; útil cuando otra pestaña cambió los datos. */
  reload() {
    this.state = this.load();
    this.listeners.forEach((fn) => fn());
  }

  // -- Utilidades de permisos ----------------------------------------------

  private me(): Profile {
    const user = this.state.profiles.find((p) => p.id === this.state.currentUserId);
    if (!user) throw new PermissionError("No hay sesión activa.");
    return user;
  }

  private canSee(ticket: Ticket, user: Profile): boolean {
    return user.role === "agente" || ticket.requesterId === user.id;
  }

  private now(): string {
    return this.clock().toISOString();
  }

  private log(ticketId: number, kind: ActivityKind, fields: Partial<Activity>): Activity {
    const entry: Activity = {
      id: this.state.nextActivityId++,
      ticketId,
      authorId: this.me().id,
      kind,
      body: null,
      fromValue: null,
      toValue: null,
      createdAt: this.now(),
      ...fields,
    };
    this.state.activity.push(entry);
    return entry;
  }

  // -- API pública ----------------------------------------------------------

  async currentUser() {
    return this.me();
  }

  async listProfiles() {
    const user = this.me();
    return user.role === "agente"
      ? [...this.state.profiles]
      : this.state.profiles.filter((p) => p.id === user.id || p.role === "agente");
  }

  async listTickets() {
    const user = this.me();
    return this.state.tickets.filter((t) => this.canSee(t, user)).map((t) => ({ ...t }));
  }

  async getTicket(id: number) {
    const ticket = this.state.tickets.find((t) => t.id === id);
    return ticket && this.canSee(ticket, this.me()) ? { ...ticket } : null;
  }

  async listActivity(ticketId: number) {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) return [];
    return this.state.activity
      .filter((a) => a.ticketId === ticketId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
      .map((a) => ({ ...a }));
  }

  async createTicket(input: NewTicket) {
    const errors = validateNewTicket(input);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);

    const now = this.now();
    const ticket: Ticket = {
      id: this.state.nextTicketId++,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      priority: input.priority,
      status: "abierto",
      requesterId: this.me().id,
      assigneeId: null,
      createdAt: now,
      updatedAt: now,
      firstResponseAt: null,
      resolvedAt: null,
    };
    this.state.tickets.push(ticket);
    this.save();
    return { ...ticket };
  }

  async updateTicket(id: number, patch: TicketPatch) {
    if (this.me().role !== "agente") throw new PermissionError("Solo un agente puede cambiar el ticket.");
    const ticket = this.state.tickets.find((t) => t.id === id);
    if (!ticket) throw new Error(`El ticket ${id} no existe.`);

    // Equivalente al trigger log_ticket_changes de la base de datos.
    if (patch.assigneeId !== undefined && patch.assigneeId !== ticket.assigneeId) {
      this.log(id, "asignacion", { fromValue: ticket.assigneeId, toValue: patch.assigneeId });
      ticket.assigneeId = patch.assigneeId;
    }
    if (patch.status && patch.status !== ticket.status) {
      this.log(id, "estado", { fromValue: ticket.status, toValue: patch.status });
      ticket.status = patch.status;
      ticket.resolvedAt = patch.status === "cerrado" ? this.now() : null;
    }
    if (patch.priority && patch.priority !== ticket.priority) {
      this.log(id, "prioridad", { fromValue: ticket.priority, toValue: patch.priority });
      ticket.priority = patch.priority;
    }

    ticket.updatedAt = this.now();
    this.save();
    return { ...ticket };
  }

  async addComment(ticketId: number, body: string) {
    const user = this.me();
    const ticket = this.state.tickets.find((t) => t.id === ticketId);
    if (!ticket || !this.canSee(ticket, user)) throw new PermissionError("No tienes acceso a este ticket.");
    if (ticket.status === "cerrado") throw new PermissionError("El ticket está cerrado. Reábrelo para comentar.");

    const text = sanitizeComment(body);
    if (!text) throw new Error("Escribe un comentario antes de enviarlo.");

    const entry = this.log(ticketId, "comentario", { body: text });
    // Equivalente al trigger mark_first_response.
    if (user.role === "agente" && !ticket.firstResponseAt) ticket.firstResponseAt = entry.createdAt;
    ticket.updatedAt = entry.createdAt;
    this.save();
    return { ...entry };
  }

  subscribe(onChange: () => void) {
    this.listeners.add(onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        // Sincroniza con otras pestañas, pero conserva el usuario elegido en esta.
        const current = this.state.currentUserId;
        this.state = this.load();
        this.state.currentUserId = current;
        onChange();
      }
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
    return () => {
      this.listeners.delete(onChange);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  }
}
