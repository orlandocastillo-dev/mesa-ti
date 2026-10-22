-- MesaTI: esquema de base de datos para Supabase (PostgreSQL 15+) Ejecutar completo en el SQL Editor del proyecto

-- Tipos
do $$ begin
  create type public.user_role as enum ('cliente', 'agente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_status as enum ('abierto', 'en_proceso', 'cerrado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_priority as enum ('baja', 'media', 'alta', 'critica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_category as enum ('hardware', 'software', 'red', 'accesos', 'correo', 'otro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.activity_kind as enum ('comentario', 'estado', 'prioridad', 'asignacion');
exception when duplicate_object then null; end $$;

-- Tablas
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  role        public.user_role not null default 'cliente',
  created_at  timestamptz not null default now()
);

create table if not exists public.tickets (
  id                 bigint generated always as identity primary key,
  title              text not null check (char_length(title) between 5 and 120),
  description        text not null check (char_length(description) between 10 and 4000),
  category           public.ticket_category not null default 'otro',
  priority           public.ticket_priority not null default 'media',
  status             public.ticket_status not null default 'abierto',
  requester_id       uuid not null references public.profiles (id),
  assignee_id        uuid references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  first_response_at  timestamptz,
  resolved_at        timestamptz
);

create index if not exists tickets_requester_idx on public.tickets (requester_id);
create index if not exists tickets_assignee_idx on public.tickets (assignee_id);
create index if not exists tickets_status_idx on public.tickets (status);

create table if not exists public.ticket_activity (
  id          bigint generated always as identity primary key,
  ticket_id   bigint not null references public.tickets (id) on delete cascade,
  author_id   uuid not null references public.profiles (id),
  kind        public.activity_kind not null,
  body        text,
  from_value  text,
  to_value    text,
  created_at  timestamptz not null default now()
);

create index if not exists activity_ticket_idx on public.ticket_activity (ticket_id, created_at);

-- Funciones auxiliares
create or replace function public.is_agent()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'agente');
$$;

-- Crea el perfil automáticamente cuando alguien se registra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Registra cambios de estado, prioridad y asignación en el historial, y mantiene updated_at / resolved_at
create or replace function public.log_ticket_changes()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := coalesce(auth.uid(), new.requester_id);
begin
  new.updated_at := now();

  if new.assignee_id is distinct from old.assignee_id then
    insert into ticket_activity (ticket_id, author_id, kind, from_value, to_value)
    values (new.id, actor, 'asignacion', old.assignee_id::text, new.assignee_id::text);
  end if;

  if new.status is distinct from old.status then
    insert into ticket_activity (ticket_id, author_id, kind, from_value, to_value)
    values (new.id, actor, 'estado', old.status::text, new.status::text);
    new.resolved_at := case when new.status = 'cerrado' then now() else null end;
  end if;

  if new.priority is distinct from old.priority then
    insert into ticket_activity (ticket_id, author_id, kind, from_value, to_value)
    values (new.id, actor, 'prioridad', old.priority::text, new.priority::text);
  end if;

  return new;
end;
$$;

drop trigger if exists tickets_log_changes on public.tickets;
create trigger tickets_log_changes
  before update on public.tickets
  for each row execute function public.log_ticket_changes();

-- La primera respuesta de un agente marca first_response_at (métrica de SLA).
create or replace function public.mark_first_response()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.kind = 'comentario' and exists (select 1 from profiles where id = new.author_id and role = 'agente') then
    update tickets set first_response_at = now()
    where id = new.ticket_id and first_response_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists activity_first_response on public.ticket_activity;
create trigger activity_first_response
  after insert on public.ticket_activity
  for each row execute function public.mark_first_response();

-- Seguridad a nivel de fila (RLS)
alter table public.profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_activity enable row level security;

-- Perfiles: cada quien ve el suyo; los agentes ven todos (para asignar y mostrar nombres).
drop policy if exists "perfil propio o agente" on public.profiles;
create policy "perfil propio o agente" on public.profiles
  for select using (id = auth.uid() or public.is_agent());

-- Los clientes necesitan ver el nombre del agente asignado a sus tickets.
drop policy if exists "ver agentes" on public.profiles;
create policy "ver agentes" on public.profiles
  for select using (role = 'agente');

-- Tickets
drop policy if exists "ver tickets" on public.tickets;
create policy "ver tickets" on public.tickets
  for select using (requester_id = auth.uid() or public.is_agent());

drop policy if exists "crear tickets propios" on public.tickets;
create policy "crear tickets propios" on public.tickets
  for insert with check (requester_id = auth.uid() and status = 'abierto' and assignee_id is null);

drop policy if exists "agentes actualizan" on public.tickets;
create policy "agentes actualizan" on public.tickets
  for update using (public.is_agent()) with check (public.is_agent());

-- Historial
drop policy if exists "ver actividad" on public.ticket_activity;
create policy "ver actividad" on public.ticket_activity
  for select using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_id and (t.requester_id = auth.uid() or public.is_agent())
    )
  );

drop policy if exists "comentar" on public.ticket_activity;
create policy "comentar" on public.ticket_activity
  for insert with check (
    kind = 'comentario'
    and author_id = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.status <> 'cerrado' and (t.requester_id = auth.uid() or public.is_agent())
    )
  );

-- Tiempo real: la bandeja se actualiza sola cuando cambia un ticket
do $$ begin
  alter publication supabase_realtime add table public.tickets;
exception when duplicate_object then null; end $$;

-- Para convertir un usuario en agente (ejecutar manualmente)
