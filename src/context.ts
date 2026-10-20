import type { TicketRepository } from "./data/repository.ts";
import type { Profile } from "./types.ts";

export interface AppContext {
  repo: TicketRepository;
  user: Profile;
  profiles: Map<string, Profile>;
  /** Vuelve a dibujar la vista actual con datos frescos. */
  refresh: () => void;
}

export function profileName(ctx: AppContext, id: string | null | undefined): string {
  if (!id) return "Sin asignar";
  if (id === ctx.user.id) return `${ctx.user.fullName} (tú)`;
  return ctx.profiles.get(id)?.fullName ?? "Usuario";
}
