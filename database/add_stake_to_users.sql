-- =====================================================
-- Agregar columna stake_id a la tabla users
-- Descripción: Permite asociar usuarios a estacas
-- =====================================================

-- Agregar la columna stake_id a la tabla users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS stake_id TEXT REFERENCES public.stakes(id) ON DELETE SET NULL;

-- Crear índice para mejorar las consultas por estaca
CREATE INDEX IF NOT EXISTS idx_users_stake_id ON public.users(stake_id);

-- Comentario para documentación
COMMENT ON COLUMN public.users.stake_id IS 'ID de la estaca a la que pertenece el usuario (opcional)';
