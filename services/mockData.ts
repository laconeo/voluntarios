
import type { User, Role, Shift, Booking } from '../types';

export const USERS: User[] = [
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
  },
];

export const ROLES: Role[] = [
  {
    id: 'role_1',
    name: 'Recepcionista',
    description: 'Dar la bienvenida a los visitantes y orientarlos.',
    detailedTasks: 'Estar en la entrada, escanear tickets, entregar folletos y resolver dudas generales.',
    youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    experienceLevel: 'nueva',
  },
  {
    id: 'role_2',
    name: 'Soporte Informático',
    description: 'Asistir con problemas técnicos en las terminales de consulta.',
    detailedTasks: 'Reiniciar equipos, ayudar a los visitantes a usar el software de consulta, contactar al soporte técnico avanzado si es necesario.',
    experienceLevel: 'intermedia',
  },
  {
    id: 'role_3',
    name: 'Logística de Paneles',
    description: 'Asegurar que las salas de conferencias estén listas para los ponentes.',
    detailedTasks: 'Verificar micrófonos, proyectores, botellas de agua para los panelistas, y controlar el acceso a la sala.',
    youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    experienceLevel: 'intermedia',
  },
  {
    id: 'role_4',
    name: 'El Rincón de tus Abuelos',
    description: 'Asistir a personas mayores, leerles o simplemente acompañarlos.',
    detailedTasks: 'Crear un ambiente amigable y tranquilo, ofrecer ayuda para moverse, leer fragmentos de libros en voz alta.',
    experienceLevel: 'nueva',
  },
];

const createShiftsForDate = (date: string, roles: Role[]): Shift[] => {
    const shifts: Shift[] = [];
    roles.forEach(role => {
        shifts.push({
            id: `shift_${date}_13-16_${role.id}`,
            date,
            timeSlot: '13:00-16:00',
            roleId: role.id,
            totalVacancies: role.name === 'Soporte Informático' ? 5 : 10,
            availableVacancies: role.name === 'Soporte Informático' ? 5 : 10,
        });
        shifts.push({
            id: `shift_${date}_16-22_${role.id}`,
            date,
            timeSlot: '16:00-22:00',
            roleId: role.id,
            totalVacancies: role.name === 'Recepcionista' ? 20 : 15,
            availableVacancies: role.name === 'Recepcionista' ? 20 : 15,
        });
    });
    return shifts;
};

// Generate shifts for a few days in the event period
export const SHIFTS: Shift[] = [
    ...createShiftsForDate('2026-04-23', ROLES),
    ...createShiftsForDate('2026-04-24', ROLES),
    ...createShiftsForDate('2026-04-25', ROLES),
    ...createShiftsForDate('2026-04-26', ROLES),
];

export const BOOKINGS: Booking[] = [
    { id: 'booking_1', userId: 'user_2', shiftId: SHIFTS[0].id, status: 'confirmed' },
    { id: 'booking_2', userId: 'user_3', shiftId: SHIFTS[1].id, status: 'confirmed' },
    { id: 'booking_3', userId: 'user_2', shiftId: SHIFTS[5].id, status: 'cancellation_requested' },
];
