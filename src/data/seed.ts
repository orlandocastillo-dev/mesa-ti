import type { Activity, Profile, Ticket } from "../types.ts";

export interface DemoState {
  version: number;
  currentUserId: string;
  profiles: Profile[];
  tickets: Ticket[];
  activity: Activity[];
  nextTicketId: number;
  nextActivityId: number;
}

export const DEMO_VERSION = 2;

const HOUR = 3600_000;

/** Datos de ejemplo con fechas relativas a "ahora" para que los SLA se vean variados. */
export function createSeed(now = Date.now()): DemoState {
  const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR).toISOString();

  const profiles: Profile[] = [
    { id: "u-camila", fullName: "Camila Rojas", role: "cliente" },
    { id: "u-andres", fullName: "Andrés Mejía", role: "cliente" },
    { id: "u-orlando", fullName: "Orlando Castillo", role: "agente" },
    { id: "u-valentina", fullName: "Valentina Ruiz", role: "agente" },
  ];

  const t = (
    id: number,
    data: Omit<Ticket, "id" | "updatedAt" | "firstResponseAt" | "resolvedAt"> &
      Partial<Pick<Ticket, "firstResponseAt" | "resolvedAt">>,
  ): Ticket => ({
    id,
    firstResponseAt: null,
    resolvedAt: null,
    updatedAt: data.resolvedAt ?? data.firstResponseAt ?? data.createdAt,
    ...data,
  });

  const tickets: Ticket[] = [
    t(1, {
      title: "No imprime la impresora del segundo piso",
      description:
        "Desde esta mañana los documentos quedan en cola y no salen. Ya apagué y prendí la impresora. Aparece como 'Sin conexión' en Windows.",
      category: "hardware", priority: "media", status: "cerrado",
      requesterId: "u-camila", assigneeId: "u-orlando",
      createdAt: at(70), firstResponseAt: at(69), resolvedAt: at(66),
    }),
    t(2, {
      title: "Outlook pide la contraseña cada cinco minutos",
      description:
        "Después de cambiar la contraseña del dominio, Outlook muestra la ventana de credenciales una y otra vez aunque la escribo bien.",
      category: "correo", priority: "alta", status: "cerrado",
      requesterId: "u-andres", assigneeId: "u-valentina",
      createdAt: at(52), firstResponseAt: at(51.5), resolvedAt: at(47),
    }),
    t(3, {
      title: "Sin acceso a la carpeta compartida de Contabilidad",
      description: "Al abrir \\\\srv-archivos\\contabilidad sale 'No tiene permiso para acceder'. La semana pasada sí podía entrar.",
      category: "accesos", priority: "alta", status: "en_proceso",
      requesterId: "u-camila", assigneeId: "u-orlando",
      createdAt: at(7), firstResponseAt: at(6.5),
    }),
    t(4, {
      title: "Wi-Fi conectado pero sin internet en la sala de reuniones",
      description:
        "El portátil dice 'Conectado, sin internet' solo en la sala B. En el puesto funciona bien. Pasa con dos equipos distintos.",
      category: "red", priority: "media", status: "abierto",
      requesterId: "u-andres", assigneeId: null,
      createdAt: at(3),
    }),
    t(5, {
      title: "El sistema de facturación no abre después de la actualización",
      description:
        "Al dar doble clic en el ícono aparece un error de .NET Framework y se cierra. Necesito facturar hoy antes de las 5 p. m.",
      category: "software", priority: "critica", status: "en_proceso",
      requesterId: "u-andres", assigneeId: "u-valentina",
      createdAt: at(3.4), firstResponseAt: at(3.2),
    }),
    t(6, {
      title: "Diadema sin micrófono en las llamadas",
      description: "Los clientes no me escuchan en el softphone. La diadema funciona en el celular. Ya la desconecté y conecté.",
      category: "hardware", priority: "alta", status: "abierto",
      requesterId: "u-camila", assigneeId: null,
      createdAt: at(9),
    }),
    t(7, {
      title: "Solicitud de instalación de Power BI Desktop",
      description: "Necesito Power BI Desktop para los informes mensuales. Mi usuario no tiene permisos de administrador.",
      category: "software", priority: "baja", status: "abierto",
      requesterId: "u-andres", assigneeId: "u-orlando",
      createdAt: at(20), firstResponseAt: at(18),
    }),
    t(8, {
      title: "Equipo muy lento al iniciar sesión",
      description: "El computador tarda casi diez minutos en mostrar el escritorio y el disco aparece al 100 % en el administrador de tareas.",
      category: "hardware", priority: "media", status: "cerrado",
      requesterId: "u-camila", assigneeId: "u-valentina",
      createdAt: at(120), firstResponseAt: at(118), resolvedAt: at(90),
    }),
    t(9, {
      title: "Usuario bloqueado tras varios intentos",
      description: "Escribí mal la contraseña y ahora dice que la cuenta está bloqueada. No puedo entrar al equipo.",
      category: "accesos", priority: "critica", status: "cerrado",
      requesterId: "u-andres", assigneeId: "u-orlando",
      createdAt: at(30), firstResponseAt: at(29.9), resolvedAt: at(29.6),
    }),
  ];

  let activityId = 1;
  const a = (ticketId: number, authorId: string, hoursAgo: number, rest: Partial<Activity>): Activity => ({
    id: activityId++,
    ticketId,
    authorId,
    kind: "comentario",
    body: null,
    fromValue: null,
    toValue: null,
    createdAt: at(hoursAgo),
    ...rest,
  });

  const activity: Activity[] = [
    a(1, "u-orlando", 69, { kind: "asignacion", toValue: "u-orlando" }),
    a(1, "u-orlando", 69, { body: "Hola Camila, ya reviso. ¿La impresora muestra alguna luz naranja en el panel?" }),
    a(1, "u-camila", 68, { body: "No, todas las luces están en verde." }),
    a(1, "u-orlando", 66.2, {
      body: "Reinicié el servicio de cola de impresión y limpié los trabajos atascados. Ya debería imprimir, ¿me confirmas?",
    }),
    a(1, "u-orlando", 66, { kind: "estado", fromValue: "abierto", toValue: "cerrado" }),

    a(2, "u-valentina", 51.5, { kind: "asignacion", toValue: "u-valentina" }),
    a(2, "u-valentina", 51.5, { body: "Voy a borrar las credenciales guardadas del Administrador de credenciales y recrear el perfil de Outlook." }),
    a(2, "u-valentina", 47, { kind: "estado", fromValue: "abierto", toValue: "cerrado" }),

    a(3, "u-orlando", 6.5, { kind: "estado", fromValue: "abierto", toValue: "en_proceso" }),
    a(3, "u-orlando", 6.5, {
      body: "Veo que tu usuario salió del grupo GG_Contabilidad en la última depuración del directorio. Ya pedí la aprobación a tu jefe para agregarte de nuevo.",
    }),

    a(5, "u-valentina", 3.2, { kind: "estado", fromValue: "abierto", toValue: "en_proceso" }),
    a(5, "u-valentina", 3.2, { body: "Estoy reparando .NET Framework 4.8 de forma remota. Te aviso en cuanto termine." }),

    a(7, "u-orlando", 18, { body: "Recibido. La instalación necesita aprobación de licencia; la programo para mañana a primera hora." }),

    a(8, "u-valentina", 118, { body: "Encontré 14 programas en el inicio y el disco con menos de 5 GB libres. Hago limpieza y desactivo los innecesarios." }),
    a(8, "u-valentina", 90, { kind: "estado", fromValue: "en_proceso", toValue: "cerrado" }),

    a(9, "u-orlando", 29.9, { body: "Cuenta desbloqueada en el directorio activo. Ya puedes iniciar sesión con tu contraseña actual." }),
    a(9, "u-orlando", 29.6, { kind: "estado", fromValue: "abierto", toValue: "cerrado" }),
  ];

  return {
    version: DEMO_VERSION,
    currentUserId: "u-orlando",
    profiles,
    tickets,
    activity,
    nextTicketId: tickets.length + 1,
    nextActivityId: activityId,
  };
}
