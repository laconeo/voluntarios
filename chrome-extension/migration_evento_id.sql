-- ============================================================
-- Migración: agregar evento_id a pcs_status y bitacora_uso
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- 1. Agregar columna evento_id a pcs_status (nullable para no romper registros existentes)
ALTER TABLE pcs_status
  ADD COLUMN IF NOT EXISTS evento_id text REFERENCES events(id) ON DELETE SET NULL;

-- 2. Agregar columna evento_id a bitacora_uso para filtrar métricas por evento
ALTER TABLE bitacora_uso
  ADD COLUMN IF NOT EXISTS evento_id text REFERENCES events(id) ON DELETE SET NULL;

-- 3. Índice para queries frecuentes de "todas las PCs de un evento"
CREATE INDEX IF NOT EXISTS idx_pcs_status_evento ON pcs_status(evento_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_evento ON bitacora_uso(evento_id);

-- 4. Vista útil: PCs por evento con voluntario join
CREATE OR REPLACE VIEW pcs_por_evento AS
  SELECT
    ps.*,
    e.nombre AS evento_nombre,
    u.full_name AS voluntario_nombre
  FROM pcs_status ps
  LEFT JOIN events e ON e.id = ps.evento_id
  LEFT JOIN users u ON u.id = ps.voluntario_id;
