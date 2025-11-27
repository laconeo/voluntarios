
import type { User, Role, Shift, Booking } from '../types';
import { ROLES, USERS, SHIFTS, BOOKINGS } from './mockData';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

let users: User[] = [...USERS];
let shifts: Shift[] = [...SHIFTS];
let bookings: Booking[] = [...BOOKINGS];

export const mockApi = {
  login: async (identifier: string): Promise<User | null> => {
    await delay(500);
    const user = users.find(u => u.dni === identifier || u.email === identifier);
    if (user) {
      console.log(`Logged in as: ${user.fullName}`);
      return { ...user };
    }
    console.log(`User not found for identifier: ${identifier}`);
    return null;
  },

  register: async (newUser: User): Promise<User> => {
    await delay(800);
    const registeredUser = { ...newUser, id: `user_${Date.now()}` };
    users.push(registeredUser);
    console.log(`Registered new user:`, registeredUser);
    return registeredUser;
  },

  updateUser: async (updatedUser: User): Promise<User> => {
    await delay(600);
    const index = users.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = updatedUser;
      return users[index];
    }
    throw new Error("Usuario no encontrado");
  },

  getShiftsForDate: async (date: string): Promise<Shift[]> => {
    await delay(300);
    const dateShifts = shifts.filter(s => s.date === date);
    // Recalculate available vacancies based on current bookings
    return dateShifts.map(shift => {
      const bookedCount = bookings.filter(b => b.shiftId === shift.id && b.status === 'confirmed').length;
      return { ...shift, availableVacancies: shift.totalVacancies - bookedCount };
    });
  },

  getRoleById: async (roleId: string): Promise<Role | null> => {
    await delay(100);
    return ROLES.find(r => r.id === roleId) || null;
  },

  getAllRoles: async (): Promise<Role[]> => {
    await delay(100);
    return [...ROLES];
  },

  createShift: async (newShift: Omit<Shift, 'id' | 'availableVacancies'>): Promise<Shift> => {
    await delay(500);
    const createdShift: Shift = {
      ...newShift,
      id: `shift_${Date.now()}`,
      availableVacancies: newShift.totalVacancies
    };
    shifts.push(createdShift);
    return createdShift;
  },

  createBooking: async (userId: string, shiftId: string): Promise<Booking> => {
    await delay(1000);
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) throw new Error("Turno no encontrado.");

    const existingBooking = bookings.find(b => b.userId === userId && b.shiftId === shiftId && b.status !== 'cancelled');
    if (existingBooking) throw new Error("Ya estás inscripto en este turno.");

    const confirmedBookings = bookings.filter(b => b.shiftId === shiftId && b.status === 'confirmed').length;
    if (confirmedBookings >= shift.totalVacancies) {
      throw new Error("No hay vacantes disponibles para este rol y turno.");
    }

    const newBooking: Booking = {
      id: `booking_${Date.now()}`,
      userId,
      shiftId,
      status: 'confirmed',
    };
    bookings.push(newBooking);
    console.log('New booking created:', newBooking);
    return newBooking;
  },

  getUserBookings: async (userId: string): Promise<Booking[]> => {
    await delay(400);
    return bookings
      .filter(b => b.userId === userId && b.status !== 'cancelled')
      .map(b => {
        const shift = shifts.find(s => s.id === b.shiftId);
        const role = ROLES.find(r => r.id === shift?.roleId);
        return { ...b, shift: shift ? { ...shift, role: role! } : undefined };
      })
      .sort((a, b) => new Date(a.shift?.date!).getTime() - new Date(b.shift?.date!).getTime());
  },

  requestBookingCancellation: async (bookingId: string): Promise<Booking> => {
    await delay(600);
    const bookingIndex = bookings.findIndex(b => b.id === bookingId);
    if (bookingIndex === -1) throw new Error("Inscripción no encontrada.");

    bookings[bookingIndex].status = 'cancellation_requested';
    return { ...bookings[bookingIndex] };
  },

  // Admin functions
  getPendingCancellations: async (): Promise<Booking[]> => {
    await delay(500);
    return bookings
      .filter(b => b.status === 'cancellation_requested')
      .map(b => {
        const user = users.find(u => u.id === b.userId);
        const shift = shifts.find(s => s.id === b.shiftId);
        const role = ROLES.find(r => r.id === shift?.roleId);
        return { ...b, user, shift: shift ? { ...shift, role: role! } : undefined };
      });
  },

  approveCancellation: async (bookingId: string): Promise<Booking> => {
    await delay(700);
    const bookingIndex = bookings.findIndex(b => b.id === bookingId);
    if (bookingIndex === -1) throw new Error("Inscripción no encontrada.");

    bookings[bookingIndex].status = 'cancelled';
    console.log(`Booking ${bookingId} cancelled.`);
    return { ...bookings[bookingIndex] };
  },

  getPrintableRoster: async (date: string, timeSlot: '13:00-16:00' | '16:00-22:00'): Promise<any[]> => {
    await delay(800);
    const targetShifts = shifts.filter(s => s.date === date && s.timeSlot === timeSlot);
    const targetShiftIds = targetShifts.map(s => s.id);

    const rosterBookings = bookings.filter(b => targetShiftIds.includes(b.shiftId) && b.status === 'confirmed');

    return rosterBookings.map(b => {
      const user = users.find(u => u.id === b.userId);
      const shift = shifts.find(s => s.id === b.shiftId);
      const role = ROLES.find(r => r.id === shift?.roleId);
      return {
        fullName: user?.fullName || 'N/A',
        dni: user?.dni || 'N/A',
        role: role?.name || 'N/A',
      };
    }).sort((a, b) => a.role.localeCompare(b.role));
  }
};
