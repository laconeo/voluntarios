import type { User, Role, Shift, Booking, Event, EventAdmin, WaitlistEntry } from '../types';

export const EVENTS: Event[] = [
  {
    id: 'event_1',
    slug: 'feriadellibrobuenosaires',
    nombre: 'Feria del Libro Buenos Aires 2026',
    ubicacion: 'Buenos Aires, Argentina',
    pais: 'Argentina',
    fechaInicio: '2026-04-23',
    fechaFin: '2026-05-11',
    descripcion: 'Feria anual del libro en la ciudad de Buenos Aires',
    estado: 'Activo',
    voluntarios: 400,
    turnos: 2,
    ocupacion: 0,
    createdAt: new Date('2025-01-15').toISOString(),
  },
  {
    id: 'event_2',
    slug: 'feriadellibrocorrientes',
    nombre: 'Feria del Libro Corrientes 2025',
    ubicacion: 'Corrientes, Argentina',
    pais: 'Argentina',
    fechaInicio: '2025-08-15',
    fechaFin: '2025-08-30',
    descripcion: 'Evento cultural provincial',
    estado: 'Archivado',
    voluntarios: 142,
    turnos: 32,
    ocupacion: 92,
    createdAt: new Date('2024-06-01').toISOString(),
  },
  {
    id: 'event_3',
    slug: 'feriadellibrochile',
    nombre: 'Feria del Libro Santiago 2026',
    ubicacion: 'Santiago, Chile',
    pais: 'Chile',
    fechaInicio: '2026-10-15',
    fechaFin: '2026-11-01',
    descripcion: 'Primera edición internacional',
    estado: 'Inactivo',
    voluntarios: 0,
    turnos: 0,
    ocupacion: 0,
    createdAt: new Date('2025-02-01').toISOString(),
  }
];

export const USERS: User[] = [
  {
    id: 'user_superadmin',
    dni: '99999999',
    fullName: 'Super Admin',
    email: 'superadmin@familysearch.org',
    phone: '1199999999',
    tshirtSize: 'M',
    isMember: true,
    attendedPrevious: true,
    isOver18: true,
    howTheyHeard: 'Internal',
    role: 'superadmin',
    password: 'admin123',
    createdAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'user_1',
    dni: '11111111',
    fullName: 'Admin User',
    email: 'admin@feria.com',
    phone: '1122334455',
    tshirtSize: 'M',
    isMember: true,
    attendedPrevious: true,
    isOver18: true,
    howTheyHeard: 'Internal',
    role: 'admin',
    password: 'admin123',
    createdAt: new Date('2024-03-01').toISOString(),
  },
  {
    id: 'user_2',
    dni: '22222222',
    fullName: 'Carla Gomez',
    email: 'carla@example.com',
    phone: '1133445566',
    tshirtSize: 'S',
    isMember: false,
    attendedPrevious: true,
    isOver18: true,
    howTheyHeard: 'Redes Sociales',
    role: 'volunteer',
    createdAt: new Date('2025-02-10').toISOString(),
  },
  {
    id: 'user_3',
    dni: '33333333',
    fullName: 'Roberto Sanchez',
    email: 'roberto@example.com',
    phone: '1144556677',
    tshirtSize: 'L',
    isMember: true,
    attendedPrevious: false,
    isOver18: true,
    howTheyHeard: 'Amigos',
    role: 'volunteer',
    createdAt: new Date('2025-03-05').toISOString(),
  },
  {
    id: 'user_4',
    dni: '44444444',
    fullName: 'Maria Rodriguez',
    email: 'maria@example.com',
    phone: '1155667788',
    tshirtSize: 'M',
    isMember: true,
    attendedPrevious: true,
    isOver18: true,
    howTheyHeard: 'Iglesia',
    role: 'coordinator',
    createdAt: new Date('2025-02-20').toISOString(),
  },
];

export const EVENT_ADMINS: EventAdmin[] = [
  {
    id: 'ea_1',
    userId: 'user_1',
    eventId: 'event_1',
    assignedAt: new Date('2025-03-01').toISOString(),
    assignedBy: 'user_superadmin',
  }
];

export const ROLES: Role[] = [
  // Event 1 - Feria BA 2026
  {
    id: 'role_e1_1',
    eventId: 'event_1',
    name: 'Recepcionista',
    description: 'Dar la bienvenida a los visitantes y orientarlos.',
    detailedTasks: 'Estar en la entrada, escanear tickets, entregar folletos y resolver dudas generales.',
    youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    experienceLevel: 'nueva',
    createdAt: new Date('2025-03-10').toISOString(),
  },
  {
    id: 'role_e1_2',
    eventId: 'event_1',
    name: 'Soporte Informático',
    description: 'Asistir con problemas técnicos en las terminales de consulta.',
    detailedTasks: 'Reiniciar equipos, ayudar a los visitantes a usar el software de consulta, contactar al soporte técnico avanzado si es necesario.',
    experienceLevel: 'intermedia',
    createdAt: new Date('2025-03-10').toISOString(),
  },
  {
    id: 'role_e1_3',
    eventId: 'event_1',
    name: 'Logística de Paneles',
    description: 'Asegurar que las salas de conferencias estén listas para los ponentes.',
    detailedTasks: 'Verificar micrófonos, proyectores, botellas de agua para los panelistas, y controlar el acceso a la sala.',
    youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    experienceLevel: 'intermedia',
    createdAt: new Date('2025-03-10').toISOString(),
  },
  {
    id: 'role_e1_4',
    eventId: 'event_1',
    name: 'El Rincón de tus Abuelos',
    description: 'Asistir a personas mayores, leerles o simplemente acompañarlos.',
    detailedTasks: 'Crear un ambiente amigable y tranquilo, ofrecer ayuda para moverse, leer fragmentos de libros en voz alta.',
    experienceLevel: 'nueva',
    createdAt: new Date('2025-03-10').toISOString(),
  },
  // Event 3 - Feria Santiago (ejemplo)
  {
    id: 'role_e3_1',
    eventId: 'event_3',
    name: 'Guía Turístico',
    description: 'Orientar visitantes internacionales.',
    detailedTasks: 'Proveer información en inglés y español sobre el evento.',
    experienceLevel: 'intermedia',
    createdAt: new Date('2025-02-15').toISOString(),
  },
];

const createShiftsForDate = (eventId: string, date: string, roles: Role[]): Shift[] => {
  const shifts: Shift[] = [];
  const eventRoles = roles.filter(r => r.eventId === eventId);

  eventRoles.forEach(role => {
    shifts.push({
      id: `shift_${eventId}_${date}_13-16_${role.id}`,
      eventId,
      date,
      timeSlot: '13:00-16:00',
      roleId: role.id,
      totalVacancies: role.name === 'Soporte Informático' ? 5 : 10,
      availableVacancies: role.name === 'Soporte Informático' ? 5 : 10,
      coordinatorIds: [],
    });
    shifts.push({
      id: `shift_${eventId}_${date}_16-22_${role.id}`,
      eventId,
      date,
      timeSlot: '16:00-22:00',
      roleId: role.id,
      totalVacancies: role.name === 'Recepcionista' ? 20 : 15,
      availableVacancies: role.name === 'Recepcionista' ? 20 : 15,
      coordinatorIds: [],
    });
  });
  return shifts;
};

// Generar shifts para event_1
export const SHIFTS: Shift[] = [
  ...createShiftsForDate('event_1', '2026-04-23', ROLES),
  ...createShiftsForDate('event_1', '2026-04-24', ROLES),
  ...createShiftsForDate('event_1', '2026-04-25', ROLES),
  ...createShiftsForDate('event_1', '2026-04-26', ROLES),
  ...createShiftsForDate('event_1', '2026-04-27', ROLES),
];

export const BOOKINGS: Booking[] = [
  {
    id: 'booking_1',
    userId: 'user_2',
    shiftId: SHIFTS[0]?.id || '',
    eventId: 'event_1',
    status: 'confirmed',
    requestedAt: new Date('2026-03-15T10:30:00').toISOString(),
  },
  {
    id: 'booking_2',
    userId: 'user_3',
    shiftId: SHIFTS[1]?.id || '',
    eventId: 'event_1',
    status: 'confirmed',
    requestedAt: new Date('2026-03-16T14:20:00').toISOString(),
  },
  {
    id: 'booking_3',
    userId: 'user_2',
    shiftId: SHIFTS[5]?.id || '',
    eventId: 'event_1',
    status: 'cancellation_requested',
    requestedAt: new Date('2026-03-17T09:15:00').toISOString(),
    cancelledAt: new Date('2026-04-20T16:45:00').toISOString(), // >24hs antes del turno
  },
];

export const WAITLIST: WaitlistEntry[] = [
  {
    id: 'wl_1',
    userId: 'user_3',
    shiftId: SHIFTS[2]?.id || '',
    eventId: 'event_1',
    position: 1,
    createdAt: new Date('2026-03-18T11:00:00').toISOString(),
  }
];