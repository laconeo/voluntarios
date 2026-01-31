-- =====================================================
-- Tabla: stakes
-- Descripción: Almacena las estacas asociadas a eventos
-- =====================================================

-- Crear la tabla stakes
CREATE TABLE IF NOT EXISTS public.stakes (
    id TEXT PRIMARY KEY DEFAULT ('stake_' || extract(epoch from now())::bigint || '_' || floor(random() * 1000)::int),
    event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índice para mejorar las consultas por evento
CREATE INDEX IF NOT EXISTS idx_stakes_event_id ON public.stakes(event_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.stakes ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios autenticados pueden ver todas las estacas
CREATE POLICY "Anyone can view stakes"
    ON public.stakes
    FOR SELECT
    USING (true);

-- Política: Solo admins y superadmins pueden insertar estacas
CREATE POLICY "Admins can insert stakes"
    ON public.stakes
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()::text
            AND users.role IN ('admin', 'superadmin')
        )
    );

-- Política: Solo admins y superadmins pueden actualizar estacas
CREATE POLICY "Admins can update stakes"
    ON public.stakes
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()::text
            AND users.role IN ('admin', 'superadmin')
        )
    );

-- Política: Solo admins y superadmins pueden eliminar estacas
CREATE POLICY "Admins can delete stakes"
    ON public.stakes
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()::text
            AND users.role IN ('admin', 'superadmin')
        )
    );

-- Comentarios para documentación
COMMENT ON TABLE public.stakes IS 'Estacas asociadas a eventos de voluntariado';
COMMENT ON COLUMN public.stakes.id IS 'Identificador único de la estaca';
COMMENT ON COLUMN public.stakes.event_id IS 'ID del evento al que pertenece la estaca';
COMMENT ON COLUMN public.stakes.name IS 'Nombre de la estaca';
COMMENT ON COLUMN public.stakes.created_at IS 'Fecha y hora de creación del registro';
