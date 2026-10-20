export type Role = "cliente" | "agente";
export type Status = "abierto" | "en_proceso" | "cerrado";
export type Priority = "baja" | "media" | "alta" | "critica";
export type Category = "hardware" | "software" | "red" | "accesos" | "correo" | "otro";
export type ActivityKind = "comentario" | "estado" | "prioridad" | "asignacion";

export interface Profile {
  id: string;
  fullName: string;
  role: Role;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: Status;
  requesterId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
}

export interface Activity {
  id: number;
  ticketId: number;
  authorId: string;
  kind: ActivityKind;
  body: string | null;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
}

export interface NewTicket {
  title: string;
  description: string;
  category: Category;
  priority: Priority;
}

export type TicketPatch = Partial<Pick<Ticket, "status" | "priority" | "assigneeId">>;
