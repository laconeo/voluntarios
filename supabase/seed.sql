-- Semilla de datos (Seed Data) based on mockData.ts

-- 1. Events
INSERT INTO public.events (id, slug, nombre, ubicacion, pais, fecha_inicio, fecha_fin, descripcion, estado, created_at)
VALUES
('event_1', 'feriadellibrobuenosaires', 'Feria del Libro Buenos Aires 2026', 'Buenos Aires, Argentina', 'Argentina', '2026-04-23', '2026-05-11', 'Feria anual del libro en la ciudad de Buenos Aires', 'Activo', '2025-01-15T00:00:00Z'),
('event_2', 'feriadellibrocorrientes', 'Feria del Libro Corrientes 2025', 'Corrientes, Argentina', 'Argentina', '2025-08-15', '2025-08-30', 'Evento cultural provincial', 'Archivado', '2024-06-01T00:00:00Z'),
('event_3', 'feriadellibrochile', 'Feria del Libro Santiago 2026', 'Santiago, Chile', 'Chile', '2026-10-15', '2026-11-01', 'Primera edición internacional', 'Inactivo', '2025-02-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- 2. Users
INSERT INTO public.users (id, dni, full_name, email, phone, tshirt_size, is_member, attended_previous, is_over_18, how_they_heard, role, password, created_at)
VALUES
('user_superadmin', '99999999', 'Super Admin', 'superadmin@familysearch.org', '1199999999', 'M', true, true, true, 'Internal', 'superadmin', 'admin123', '2024-01-01T00:00:00Z'),
('user_1', '11111111', 'Admin User', 'admin@feria.com', '1122334455', 'M', true, true, true, 'Internal', 'admin', 'admin123', '2024-03-01T00:00:00Z'),
('user_2', '22222222', 'Carla Gomez', 'carla@example.com', '1133445566', 'S', false, true, true, 'Redes Sociales', 'volunteer', null, '2025-02-10T00:00:00Z'),
('user_3', '33333333', 'Roberto Sanchez', 'roberto@example.com', '1144556677', 'L', true, false, true, 'Amigos', 'volunteer', null, '2025-03-05T00:00:00Z'),
('user_4', '44444444', 'Maria Rodriguez', 'maria@example.com', '1155667788', 'M', true, true, true, 'Iglesia', 'coordinator', 'coord123', '2025-02-20T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- 3. Roles
INSERT INTO public.roles (id, event_id, name, description, detailed_tasks, youtube_url, experience_level, created_at)
VALUES
('role_e1_1', 'event_1', 'Recepcionista', 'Dar la bienvenida a los visitantes y orientarlos.', 'Estar en la entrada, escanear tickets, entregar folletos y resolver dudas generales.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'nueva', '2025-03-10T00:00:00Z'),
('role_e1_2', 'event_1', 'Soporte Informático', 'Asistir con problemas técnicos en las terminales de consulta.', 'Reiniciar equipos, ayudar a los visitantes a usar el software de consulta, contactar al soporte técnico avanzado si es necesario.', NULL, 'intermedia', '2025-03-10T00:00:00Z'),
('role_e1_3', 'event_1', 'Logística de Paneles', 'Asegurar que las salas de conferencias estén listas para los ponentes.', 'Verificar micrófonos, proyectores, botellas de agua para los panelistas, y controlar el acceso a la sala.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'intermedia', '2025-03-10T00:00:00Z'),
('role_e1_4', 'event_1', 'El Rincón de tus Abuelos', 'Asistir a personas mayores, leerles o simplemente acompañarlos.', 'Crear un ambiente amigable y tranquilo, ofrecer ayuda para moverse, leer fragmentos de libros en voz alta.', NULL, 'nueva', '2025-03-10T00:00:00Z'),
('role_e3_1', 'event_3', 'Guía Turístico', 'Orientar visitantes internacionales.', 'Proveer información en inglés y español sobre el evento.', NULL, 'intermedia', '2025-02-15T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- 4. Shifts (Muestra parcial)
INSERT INTO public.shifts (id, event_id, date, time_slot, role_id, total_vacancies, coordinator_ids)
VALUES
('shift_sample_1', 'event_1', '2026-04-23', '13:00-16:00', 'role_e1_1', 10, '{}'),
('shift_sample_2', 'event_1', '2026-04-23', '16:00-22:00', 'role_e1_1', 20, '{}'),
('shift_sample_3', 'event_1', '2026-04-23', '13:00-16:00', 'role_e1_2', 5, '{"user_4"}'),
('shift_sample_4', 'event_1', '2026-04-24', '13:00-16:00', 'role_e1_1', 10, '{}')
ON CONFLICT (id) DO NOTHING;

-- 5. Bookings
INSERT INTO public.bookings (id, user_id, shift_id, event_id, status, attendance, requested_at, cancelled_at)
VALUES
('booking_1', 'user_2', 'shift_sample_1', 'event_1', 'confirmed', 'pending', '2026-03-15T10:30:00Z', NULL),
('booking_2', 'user_3', 'shift_sample_2', 'event_1', 'confirmed', 'pending', '2026-03-16T14:20:00Z', NULL)
ON CONFLICT (id) DO NOTHING;

-- 6. Event Admins
INSERT INTO public.event_admins (id, user_id, event_id, assigned_at, assigned_by)
VALUES
('ea_1', 'user_1', 'event_1', '2025-03-01T00:00:00Z', 'user_superadmin')
ON CONFLICT (id) DO NOTHING;
