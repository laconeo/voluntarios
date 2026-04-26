-- ============================================================
-- TABLA: user_materials
-- Registra qué materiales fueron entregados a cada voluntario
-- en cada evento.
-- Ejecutar en el SQL Editor del Dashboard de Supabase.
-- ============================================================

-- 1. Crear la tabla si no existe
CREATE TABLE IF NOT EXISTS public.user_materials (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     TEXT        NOT NULL,
    user_id      TEXT        NOT NULL,
    material_id  TEXT        NOT NULL,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Clave única: un registro por (evento, usuario, material)
    CONSTRAINT user_materials_unique UNIQUE (event_id, user_id, material_id)
);

-- 2. Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_user_materials_event   ON public.user_materials(event_id);
CREATE INDEX IF NOT EXISTS idx_user_materials_user    ON public.user_materials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_materials_material ON public.user_materials(material_id);

-- 3. Habilitar RLS
ALTER TABLE public.user_materials ENABLE ROW LEVEL SECURITY;

-- 4. Lectura: cualquiera puede leer
DROP POLICY IF EXISTS "Leer entregas de materiales" ON public.user_materials;
CREATE POLICY "Leer entregas de materiales"
    ON public.user_materials FOR SELECT
    USING (true);

-- 5. Insertar: cualquier usuario autenticado
DROP POLICY IF EXISTS "Insertar entrega de material" ON public.user_materials;
CREATE POLICY "Insertar entrega de material"
    ON public.user_materials FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Eliminar: cualquier usuario autenticado
DROP POLICY IF EXISTS "Eliminar entrega de material" ON public.user_materials;
CREATE POLICY "Eliminar entrega de material"
    ON public.user_materials FOR DELETE
    USING (auth.uid() IS NOT NULL);
