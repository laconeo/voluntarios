-- Agrega la columna para controlar si se muestra la modal de últimos turnos disponibles
ALTER TABLE events
ADD COLUMN IF NOT EXISTS show_available_shifts_modal BOOLEAN NOT NULL DEFAULT FALSE;

-- Comentario descriptivo
COMMENT ON COLUMN events.show_available_shifts_modal IS
  'Si está activo, al ingresar al portal del voluntario aparece una ventana emergente mostrando los días con turnos disponibles.';
