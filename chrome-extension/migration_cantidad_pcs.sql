-- ============================================================
-- Migración: agregar cantidad_pcs a la tabla events
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- 1. Agregar columna cantidad_pcs a events (nullable, sin valor por defecto)
--    Los eventos ya existentes quedarán con NULL hasta que el admin configure la cantidad.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS cantidad_pcs integer CHECK (cantidad_pcs > 0);

-- 2. Comentario descriptivo
COMMENT ON COLUMN events.cantidad_pcs IS
  'Cantidad de computadoras del stand para este evento. Controla cuántas PCs muestra el monitor de stand.';

-- ============================================================
-- Verificación
-- ============================================================
SELECT id, nombre, cantidad_pcs FROM events ORDER BY nombre;
