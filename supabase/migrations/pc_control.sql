-- 1. PC Status Table
create table if not exists public.pcs_status (
  id int primary key, -- 1 to 20
  estado text default 'disponible', -- disponible, ocupada, bloqueada, mantenimiento
  voluntario_id text references public.users(id),
  inicio_sesion timestamp with time zone,
  tiempo_limite timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Enable Realtime for pcs_status (MUST be done after table creation)
alter publication supabase_realtime add table public.pcs_status;

-- Seed PCs
insert into public.pcs_status (id) values 
(1), (2), (3), (4), (5), (6), (7), (8), (9), (10),
(11), (12), (13), (14), (15), (16), (17), (18), (19), (20)
on conflict (id) do nothing;

-- 3. Bitacora Uso Table
create table if not exists public.bitacora_uso (
  id uuid default uuid_generate_v4() primary key,
  pc_id int references public.pcs_status(id),
  voluntario_id text references public.users(id),
  acciones_reportadas jsonb,
  duracion_total int, -- in minutes
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS Policies
alter table public.pcs_status enable row level security;
alter table public.bitacora_uso enable row level security;

-- Allow read access to everyone (for the dashboard and client scripts)
create policy "Allow read access to everyone" on public.pcs_status for select using (true);

-- Allow update access to everyone (for now, to simplify the python client without auth if needed, but ideally should be authenticated)
-- Given the requirement "Infraestructura: Reutilizas la conexión a Supabase", we assume the python script has the key.
create policy "Allow update access to everyone" on public.pcs_status for update using (true);

-- Allow insert access to bitacora_uso
create policy "Allow insert access to bitacora_uso" on public.bitacora_uso for insert with check (true);
create policy "Allow read access to bitacora_uso" on public.bitacora_uso for select using (true);
