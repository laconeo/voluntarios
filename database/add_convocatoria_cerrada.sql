-- Migración: Agrega soporte para cierre de convocatoria de voluntarios
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS convocatoria_cerrada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mensaje_convocatoria_cerrada text;

-- Comentarios para documentación
COMMENT ON COLUMN public.events.convocatoria_cerrada IS 'Si está en true, los voluntarios que accedan a la URL del evento solo verán el mensaje de convocatoria cerrada.';
COMMENT ON COLUMN public.events.mensaje_convocatoria_cerrada IS 'Mensaje personalizado que se muestra a los voluntarios cuando la convocatoria está cerrada.';
