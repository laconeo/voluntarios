-- =====================================================
-- Actualizar campo ecclesiastical_permission a tipo TEXT
-- Descripción: Soporta estados 'pending', 'verified', 'rejected'
-- =====================================================

-- 1. Eliminar columna anterior si existía como boolean
ALTER TABLE public.users DROP COLUMN IF EXISTS ecclesiastical_permission;

-- 2. Agregar columna como TEXT con valor por defecto 'pending'
ALTER TABLE public.users 
ADD COLUMN ecclesiastical_permission TEXT DEFAULT 'pending' 
CHECK (ecclesiastical_permission IN ('pending', 'verified', 'rejected'));

-- Comentario para documentación
COMMENT ON COLUMN public.users.ecclesiastical_permission IS 'Estado del permiso eclesiástico: pending, verified, rejected';
