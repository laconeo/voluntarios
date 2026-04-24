
-- SQL para corregir el error de ambigüedad en las funciones
-- Ejecuta este comando en el SQL Editor de tu Dashboard de Supabase

-- 1. Eliminamos TODAS las posibles versiones anteriores para limpiar la ambigüedad
DROP FUNCTION IF EXISTS get_stand_metrics_summary(UUID, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS get_stand_metrics_summary(UUID, TIMESTAMP WITHOUT TIME ZONE);
DROP FUNCTION IF EXISTS get_stand_metrics_summary(TEXT, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS get_stand_metrics_summary(TEXT, TIMESTAMP WITHOUT TIME ZONE);

-- 2. Recreamos la función única con parámetros claros (TEXT y TIMESTAMPTZ)
CREATE OR REPLACE FUNCTION get_stand_metrics_summary(
    p_event_id TEXT, 
    p_since TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
    day DATE,
    pc_sessions BIGINT,
    pc_personas BIGINT,
    pc_extensiones BIGINT,
    exp_sessions BIGINT,
    exp_personas BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH pc_stats AS (
        SELECT 
            (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date as d,
            COUNT(*) as sessions,
            SUM(COALESCE((acciones_reportadas->>'people_helped')::int, 1)) as personas,
            SUM(COALESCE((acciones_reportadas->>'extensions')::int, 0)) as extensions
        FROM bitacora_uso
        WHERE evento_id = p_event_id
        AND (p_since IS NULL OR created_at >= p_since)
        GROUP BY 1
    ),
    exp_stats AS (
        SELECT 
            (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date as d,
            COUNT(*) as sessions,
            SUM(cantidad_personas) as personas
        FROM experience_logs
        WHERE evento_id = p_event_id
        AND (p_since IS NULL OR created_at >= p_since)
        GROUP BY 1
    )
    SELECT 
        COALESCE(pc.d, exp.d) as day,
        COALESCE(pc.sessions, 0)::BIGINT,
        COALESCE(pc.personas, 0)::BIGINT,
        COALESCE(pc.extensions, 0)::BIGINT,
        COALESCE(exp.sessions, 0)::BIGINT,
        COALESCE(exp.personas, 0)::BIGINT
    FROM pc_stats pc
    FULL OUTER JOIN exp_stats exp ON pc.d = exp.d
    WHERE COALESCE(pc.d, exp.d) IS NOT NULL
    ORDER BY day;
END;
$$ LANGUAGE plpgsql;

-- 3. Asegurar permisos de lectura en experience_logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'experience_logs' AND policyname = 'Permitir lectura a todos'
    ) THEN
        ALTER TABLE public.experience_logs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Permitir lectura a todos" ON public.experience_logs FOR SELECT USING (true);
    END IF;
END $$;
