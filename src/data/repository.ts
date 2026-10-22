import type { Activity, NewTicket, Profile, Ticket, TicketPatch } from "../types.ts";

export type AuthAdapter =
  | {
      kind: "demo";
      users: () => Profile[];
      switchTo: (userId: string) => void;
      reset: () => void;
    }
  | {
      kind: "supabase";
      signIn: (email: string, password: string) => Promise<void>;
      signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
      signOut: () => Promise<void>;
    };

// Contrato que cumplen tanto el modo demo (localStorage) como Supabase
export interface TicketRepository {
  readonly auth: AuthAdapter;
  currentUser(): Promise<Profile | null>;
  listProfiles(): Promise<Profile[]>;
  listTickets(): Promise<Ticket[]>;
  getTicket(id: number): Promise<Ticket | null>;
  listActivity(ticketId: number): Promise<Activity[]>;
  createTicket(input: NewTicket): Promise<Ticket>;
  updateTicket(id: number, patch: TicketPatch): Promise<Ticket>;
  addComment(ticketId: number, body: string): Promise<Activity>;
  // Avisa cuando los datos cambian desde otra pestaña u otro usuario
  subscribe(onChange: () => void): () => void;
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}
