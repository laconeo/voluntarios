-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users
create table if not exists public.users (
  id text primary key,
  dni text unique not null,
  full_name text not null,
  email text unique not null,
  phone text,
  tshirt_size text,
  is_member boolean default false,
  attended_previous boolean default false,
  is_over_18 boolean default true,
  how_they_heard text,
  role text default 'volunteer',
  password text,
  status text default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Events
create table if not exists public.events (
  id text primary key,
  slug text unique not null,
  nombre text not null,
  ubicacion text,
  pais text,
  fecha_inicio date,
  fecha_fin date,
  descripcion text,
  estado text default 'Activo',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Roles
create table if not exists public.roles (
  id text primary key,
  event_id text references public.events(id) on delete cascade,
  name text not null,
  description text,
  detailed_tasks text,
  youtube_url text,
  experience_level text,
  requires_approval boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Shifts
create table if not exists public.shifts (
  id text primary key,
  event_id text references public.events(id) on delete cascade,
  date date not null,
  time_slot text not null,
  role_id text references public.roles(id) on delete cascade,
  total_vacancies int default 10,
  coordinator_ids text[] default '{}'::text[]
);

-- 5. Bookings
create table if not exists public.bookings (
  id text primary key,
  user_id text references public.users(id) on delete cascade,
  shift_id text references public.shifts(id) on delete cascade,
  event_id text references public.events(id) on delete cascade,
  status text default 'confirmed',
  attendance text default 'pending',
  requested_at timestamp with time zone default timezone('utc'::text, now()),
  cancelled_at timestamp with time zone
);

-- 6. Waitlist
create table if not exists public.waitlist (
  id text primary key,
  user_id text references public.users(id) on delete cascade,
  shift_id text references public.shifts(id) on delete cascade,
  event_id text references public.events(id) on delete cascade,
  position int,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 7. Event Admins
create table if not exists public.event_admins (
  id text primary key,
  user_id text references public.users(id) on delete cascade,
  event_id text references public.events(id) on delete cascade,
  assigned_at timestamp with time zone default timezone('utc'::text, now()),
  assigned_by text references public.users(id)
);

-- Migrations/Updates
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'roles' and column_name = 'requires_approval') then
    alter table public.roles add column requires_approval boolean default false;
  end if;
end $$;
