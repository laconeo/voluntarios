-- Índices para mejorar el rendimiento de las consultas de coordinación y métricas
-- Estos índices aceleran los filtros por evento y usuario, así como las búsquedas en campos JSONB.

-- Índices en la tabla de Bookings (Inscripciones)
-- Mejora: getBookingsByEvent, getDashboardMetrics, getAllEvents (count)
CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON public.bookings USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_shift_id ON public.bookings USING btree (shift_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status);

-- Índices en la tabla de Shifts (Turnos)
-- Mejora: getShiftsByEvent, getShiftsWhereUserIsCoordinator
CREATE INDEX IF NOT EXISTS idx_shifts_event_id ON public.shifts USING btree (event_id);
-- Índice GIN para búsquedas eficientes dentro del array de coordinator_ids
CREATE INDEX IF NOT EXISTS idx_shifts_coordinator_ids ON public.shifts USING GIN (coordinator_ids);

-- Índices en la tabla de Users (Usuarios)
-- Mejora: Búsquedas por DNI/Email y filtrado por estaca
CREATE INDEX IF NOT EXISTS idx_users_stake_id ON public.users (stake_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users (status);

-- Índices en la tabla de Roles
CREATE INDEX IF NOT EXISTS idx_roles_event_id ON public.roles (event_id);

-- Índices para tablas de Métricas y Bitácora (Alta frecuencia)
-- Mejora: StandMetrics, MetricsDashboard y Bitácora en tiempo real
CREATE INDEX IF NOT EXISTS idx_bitacora_evento_id_created ON public.bitacora_uso (evento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_pc_id ON public.bitacora_uso (pc_id);

CREATE INDEX IF NOT EXISTS idx_exp_logs_evento_id_created ON public.experience_logs (evento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exp_logs_station_id ON public.experience_logs (station_id);
