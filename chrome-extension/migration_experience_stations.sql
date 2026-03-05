-- ============================================================
-- Migración: Puestos de Experiencia (Apellidos, Rincón de Abuelos, etc.)
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- 1. Tabla de puestos de experiencia por evento
CREATE TABLE IF NOT EXISTS experience_stations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    nombre      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla de registros de experiencias completadas
CREATE TABLE IF NOT EXISTS experience_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id          UUID NOT NULL REFERENCES experience_stations(id) ON DELETE CASCADE,
    evento_id           TEXT NOT NULL,
    cantidad_personas   INTEGER NOT NULL CHECK (cantidad_personas BETWEEN 1 AND 10),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_stations_evento ON experience_stations(evento_id);
CREATE INDEX IF NOT EXISTS idx_logs_station ON experience_logs(station_id);
CREATE INDEX IF NOT EXISTS idx_logs_evento ON experience_logs(evento_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON experience_logs(created_at);

-- 4. RLS — acceso público (los voluntarios acceden sin auth desde el celular)
ALTER TABLE experience_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_logs     ENABLE ROW LEVEL SECURITY;

-- Lectura pública (voluntarios ven el nombre del puesto)
CREATE POLICY "stations_public_read"  ON experience_stations FOR SELECT USING (true);
-- Solo admins pueden crear/borrar puestos (anon key no puede insertar)
CREATE POLICY "stations_public_write" ON experience_stations FOR ALL USING (true) WITH CHECK (true);

-- Escritura pública en logs (voluntarios registran desde celular sin auth)
CREATE POLICY "logs_public_all"       ON experience_logs     FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Verificación
-- ============================================================
SELECT 'experience_stations' as tabla, count(*) FROM experience_stations
UNION ALL
SELECT 'experience_logs',              count(*) FROM experience_logs;
