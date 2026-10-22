# MesaTI

Mesa de ayuda para el área de sistemas de una empresa. El empleado reporta lo que le falla (no imprime, no hay internet, la diadema no tiene micrófono), un técnico lo toma, sigue la guía de solución, le responde dentro del ticket y lo cierra.

En vivo: https://mesa-ti-chi.vercel.app. La primera pantalla explica cómo funciona y deja entrar como empleado o como técnico.

![Bandeja del técnico](docs/captura-bandeja.png)

Si no hay credenciales de Supabase arranca en modo demo, con datos de ejemplo guardados en el navegador. Desde la barra lateral se cambia de usuario para verla como empleado o como técnico.

## Lo que hace

- El empleado reporta el problema y ve en qué va: recibido, en revisión, resuelto.
- Mientras escribe el asunto, la app le sugiere la guía que le puede servir antes de enviar el ticket.
- El técnico ve primero lo que vence antes, filtra por estado, prioridad o categoría, toma el ticket, cambia el estado y responde.
- Cada cambio queda en el historial del ticket (quién, qué y cuándo).
- Métricas: cumplimiento del plazo, tiempo de primera respuesta y de solución, tickets vencidos y carga por técnico.

| Detalle del ticket | Vista del empleado |
| --- | --- |
| ![Detalle](docs/captura-detalle.png) | ![Empleado](docs/captura-cliente.png) |

Los plazos según la prioridad: crítica 4 horas, alta 8, media 24 y baja 72. Cuando le queda menos de una cuarta parte del plazo, el ticket aparece como "por vencer".

## Guías de solución

Las guías están en `src/kb/` en Markdown, con sus diagramas en Mermaid y scripts de PowerShell para el diagnóstico. Son las mismas del repositorio [guias-soporte-it](https://github.com/orlandocastillo-dev/guias-soporte-it).

## Con qué está hecha

TypeScript con Vite, sin framework. Supabase para las cuentas, la base de datos y las actualizaciones en tiempo real. Los permisos están en la base (RLS) y el historial lo llena un trigger, así nadie se lo puede saltar desde el navegador. Todo el texto que escribe un usuario se escapa antes de mostrarse. Pruebas con Vitest.

## Correrla

```bash
npm install
npm run dev
npm test
npm run build
```

Para conectar Supabase:

1. Crea un proyecto y corre `supabase/schema.sql` en el SQL Editor.
2. Copia `.env.example` como `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Regístrate desde la app y, para volverte técnico, corre en el SQL Editor:

```sql
update public.profiles set role = 'agente' where id = '<uuid de tu usuario>';
```

Los nombres y tickets del modo demo son inventados.
