import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Activity, NewTicket, Profile, Ticket, TicketPatch } from "../types.ts";
import { sanitizeComment, validateNewTicket } from "../domain/validation.ts";
import type { AuthAdapter, TicketRepository } from "./repository.ts";

interface TicketRow {
  id: number;
  title: string;
  description: string;
  category: Ticket["category"];
  priority: Ticket["priority"];
  status: Ticket["status"];
  requester_id: string;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
}

interface ActivityRow {
  id: number;
  ticket_id: number;
  author_id: string;
  kind: Activity["kind"];
  body: string | null;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  full_name: string;
  role: Profile["role"];
}

const toTicket = (r: TicketRow): Ticket => ({
  id: r.id,
  title: r.title,
  description: r.description,
  category: r.category,
  priority: r.priority,
  status: r.status,
  requesterId: r.requester_id,
  assigneeId: r.assignee_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  firstResponseAt: r.first_response_at,
  resolvedAt: r.resolved_at,
});

const toActivity = (r: ActivityRow): Activity => ({
  id: r.id,
  ticketId: r.ticket_id,
  authorId: r.author_id,
  kind: r.kind,
  body: r.body,
  fromValue: r.from_value,
  toValue: r.to_value,
  createdAt: r.created_at,
});

const toProfile = (r: ProfileRow): Profile => ({ id: r.id, fullName: r.full_name, role: r.role });

/** Traduce errores de Postgres/Supabase a mensajes que entiende un usuario final. */
function friendly(error: { message: string; code?: string }): Error {
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    return new Error("No tienes permiso para hacer este cambio.");
  }
  if (/Invalid login credentials/i.test(error.message)) return new Error("Correo o contraseña incorrectos.");
  if (/Email not confirmed/i.test(error.message)) return new Error("Confirma tu correo antes de iniciar sesión.");
  return new Error(error.message);
}

export class SupabaseRepository implements TicketRepository {
  readonly auth: AuthAdapter;
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey);
    this.auth = {
      kind: "supabase",
      signIn: async (email, password) => {
        const { error } = await this.client.auth.signInWithPassword({ email, password });
        if (error) throw friendly(error);
      },
      signUp: async (email, password, fullName) => {
        const { data, error } = await this.client.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw friendly(error);
        return { needsConfirmation: !data.session };
      },
      signOut: async () => {
        await this.client.auth.signOut();
      },
    };
  }

  async currentUser() {
    const { data } = await this.client.auth.getUser();
    if (!data.user) return null;
    const { data: row, error } = await this.client
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", data.user.id)
      .single<ProfileRow>();
    if (error) throw friendly(error);
    return toProfile(row);
  }

  async listProfiles() {
    const { data, error } = await this.client.from("profiles").select("id, full_name, role").returns<ProfileRow[]>();
    if (error) throw friendly(error);
    return data.map(toProfile);
  }

  async listTickets() {
    const { data, error } = await this.client
      .from("tickets")
      .select("*")
      .order("updated_at", { ascending: false })
      .returns<TicketRow[]>();
    if (error) throw friendly(error);
    return data.map(toTicket);
  }

  async getTicket(id: number) {
    const { data, error } = await this.client.from("tickets").select("*").eq("id", id).maybeSingle<TicketRow>();
    if (error) throw friendly(error);
    return data ? toTicket(data) : null;
  }

  async listActivity(ticketId: number) {
    const { data, error } = await this.client
      .from("ticket_activity")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at")
      .returns<ActivityRow[]>();
    if (error) throw friendly(error);
    return data.map(toActivity);
  }

  async createTicket(input: NewTicket) {
    const errors = validateNewTicket(input);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);

    const { data: auth } = await this.client.auth.getUser();
    if (!auth.user) throw new Error("Tu sesión expiró. Inicia sesión de nuevo.");

    const { data, error } = await this.client
      .from("tickets")
      .insert({
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        priority: input.priority,
        requester_id: auth.user.id,
      })
      .select()
      .single<TicketRow>();
    if (error) throw friendly(error);
    return toTicket(data);
  }

  async updateTicket(id: number, patch: TicketPatch) {
    const row: Partial<TicketRow> = {};
    if (patch.status) row.status = patch.status;
    if (patch.priority) row.priority = patch.priority;
    if (patch.assigneeId !== undefined) row.assignee_id = patch.assigneeId;

    const { data, error } = await this.client.from("tickets").update(row).eq("id", id).select().single<TicketRow>();
    if (error) throw friendly(error);
    return toTicket(data);
  }

  async addComment(ticketId: number, body: string) {
    const text = sanitizeComment(body);
    if (!text) throw new Error("Escribe un comentario antes de enviarlo.");
    const { data: auth } = await this.client.auth.getUser();
    if (!auth.user) throw new Error("Tu sesión expiró. Inicia sesión de nuevo.");

    const { data, error } = await this.client
      .from("ticket_activity")
      .insert({ ticket_id: ticketId, author_id: auth.user.id, kind: "comentario", body: text })
      .select()
      .single<ActivityRow>();
    if (error) throw friendly(error);
    return toActivity(data);
  }

  subscribe(onChange: () => void) {
    const channel = this.client
      .channel("tickets-cambios")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => onChange())
      .subscribe();
    const { data } = this.client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") onChange();
    });
    return () => {
      void this.client.removeChannel(channel);
      data.subscription.unsubscribe();
    };
  }
}
