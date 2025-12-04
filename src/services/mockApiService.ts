import type { User, Role, Shift, Booking, Event, EventAdmin, DashboardMetrics, WaitlistEntry } from '../types';
import { ROLES, USERS, SHIFTS, BOOKINGS, EVENTS, EVENT_ADMINS, WAITLIST } from './mockData';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

let users: User[] = [...USERS];
let shifts: Shift[] = [...SHIFTS];
let bookings: Booking[] = [...BOOKINGS];
let events: Event[] = [...EVENTS];
let eventAdmins: EventAdmin[] = [...EVENT_ADMINS];
let roles: Role[] = [...ROLES];
let waitlist: WaitlistEntry[] = [...WAITLIST];

// Helper: calcular si baja es <24hs o >24hs
const isWithin24Hours = (shiftDate: string, shiftTime: string): boolean => {
  const [startTime] = shiftTime.split('-');
  const cleanStartTime = startTime ? startTime.trim() : '00:00';
  const shiftDateTime = new Date(`${shiftDate}T${cleanStartTime}:00`);
  const now = new Date();
  const diff = shiftDateTime.getTime() - now.getTime();
  const hoursUntilShift = diff / (1000 * 60 * 60);
  return hoursUntilShift <= 24 && hoursUntilShift > 0;
};

export const mockApi = {
  // ==================== AUTH ====================
  login: async (identifier: string, password?: string): Promise<User | null> => {
    await delay(500);
    const user = users.find(u => u.dni === identifier || u.email === identifier);
    if (user) {
      // Si el usuario es admin, superadmin o coordinator, requiere contraseña
      if (user.role === 'admin' || user.role === 'superadmin' || user.role === 'coordinator') {
        if (!password || user.password !== password) {
          console.log(`Invalid password for ${user.role}: ${user.fullName}`);
          throw new Error('Contraseña incorrecta');
        }
      }
      console.log(`Logged in as: ${user.fullName}`);
      // No devolver la contraseña al cliente
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    }
    console.log(`User not found for identifier: ${identifier}`);
    return null;
  },

  register: async (newUser: User): Promise<User> => {
    await delay(800);
    const registeredUser = {
      ...newUser,
      id: `user_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
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

  getAllUsers: async (): Promise<User[]> => {
    await delay(300);
    // No devolver contraseñas
    return users.map(({ password, ...user }) => user as User);
  },

  getUserById: async (userId: string): Promise<User | null> => {
    await delay(200);
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  },

  // ==================== EVENTS ====================
  getAllEvents: async (): Promise<Event[]> => {
    await delay(300);
    return events.map(e => {
      // Recalcular métricas
      const eventShifts = shifts.filter(s => s.eventId === e.id);
      const eventBookings = bookings.filter(b => b.eventId === e.id && b.status === 'confirmed');
      const totalVacancies = eventShifts.reduce((sum, s) => sum + s.totalVacancies, 0);
      const occupied = eventBookings.length;

      return {
        ...e,
        voluntarios: new Set(eventBookings.map(b => b.userId)).size,
        turnos: eventShifts.length,
        ocupacion: totalVacancies > 0 ? Math.round((occupied / totalVacancies) * 100) : 0,
      };
    });
  },

  getEventById: async (eventId: string): Promise<Event | null> => {
    await delay(200);
    return events.find(e => e.id === eventId) || null;
  },

  getEventBySlug: async (slug: string): Promise<Event | null> => {
    await delay(200);
    return events.find(e => e.slug === slug) || null;
  },

  createEvent: async (eventData: Omit<Event, 'id' | 'voluntarios' | 'turnos' | 'ocupacion' | 'createdAt'>): Promise<Event> => {
    await delay(600);
    const newEvent: Event = {
      ...eventData,
      id: `event_${Date.now()}`,
      voluntarios: 0,
      turnos: 0,
      ocupacion: 0,
      createdAt: new Date().toISOString(),
    };
    events.push(newEvent);
    return newEvent;
  },

  updateEvent: async (eventId: string, updates: Partial<Event>): Promise<Event> => {
    await delay(500);
    const index = events.findIndex(e => e.id === eventId);
    if (index === -1) throw new Error('Evento no encontrado');
    events[index] = { ...events[index], ...updates };
    return events[index];
  },

  archiveEvent: async (eventId: string): Promise<Event> => {
    return mockApi.updateEvent(eventId, { estado: 'Archivado' });
  },

  deleteEvent: async (eventId: string): Promise<void> => {
    await delay(400);
    const hasBookings = bookings.some(b => b.eventId === eventId);
    if (hasBookings) throw new Error('No se puede eliminar evento con voluntarios registrados');
    events = events.filter(e => e.id !== eventId);
  },

  // ==================== EVENT ADMINS ====================
  assignAdminToEvent: async (userId: string, eventId: string, assignedBy: string): Promise<EventAdmin> => {
    await delay(500);
    const newAssignment: EventAdmin = {
      id: `ea_${Date.now()}`,
      userId,
      eventId,
      assignedAt: new Date().toISOString(),
      assignedBy,
    };
    eventAdmins.push(newAssignment);

    // Actualizar rol del usuario
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      users[userIndex].role = 'admin';
    }

    return newAssignment;
  },

  getEventAdmins: async (eventId: string): Promise<User[]> => {
    await delay(300);
    const adminIds = eventAdmins.filter(ea => ea.eventId === eventId).map(ea => ea.userId);
    return users.filter(u => adminIds.includes(u.id));
  },

  revokeAdminFromEvent: async (userId: string, eventId: string): Promise<void> => {
    await delay(400);
    eventAdmins = eventAdmins.filter(ea => !(ea.userId === userId && ea.eventId === eventId));

    // Si no tiene más eventos asignados, cambiar rol a volunteer
    const hasOtherEvents = eventAdmins.some(ea => ea.userId === userId);
    if (!hasOtherEvents) {
      const userIndex = users.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        users[userIndex].role = 'volunteer';
      }
    }
  },

  // ==================== ROLES ====================
  getRolesByEvent: async (eventId: string): Promise<Role[]> => {
    await delay(200);
    return roles.filter(r => r.eventId === eventId);
  },

  getRoleById: async (roleId: string): Promise<Role | null> => {
    await delay(100);
    return roles.find(r => r.id === roleId) || null;
  },

  getAllRoles: async (): Promise<Role[]> => {
    await delay(100);
    return [...roles];
  },

  createRole: async (roleData: Omit<Role, 'id' | 'createdAt'>): Promise<Role> => {
    await delay(500);
    const newRole: Role = {
      ...roleData,
      id: `role_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    roles.push(newRole);
    return newRole;
  },

  updateRole: async (roleId: string, updates: Partial<Role>): Promise<Role> => {
    await delay(400);
    const index = roles.findIndex(r => r.id === roleId);
    if (index === -1) throw new Error('Rol no encontrado');
    roles[index] = { ...roles[index], ...updates };
    return roles[index];
  },

  deleteRole: async (roleId: string): Promise<void> => {
    await delay(400);
    const hasShifts = shifts.some(s => s.roleId === roleId);
    if (hasShifts) throw new Error('No se puede eliminar rol con turnos asignados');
    roles = roles.filter(r => r.id !== roleId);
  },

  // ==================== SHIFTS ====================
  getShiftsForDate: async (eventId: string, date: string): Promise<Shift[]> => {
    await delay(300);
    const dateShifts = shifts.filter(s => s.eventId === eventId && s.date === date);

    return dateShifts.map(shift => {
      const bookedCount = bookings.filter(b => b.shiftId === shift.id && b.status === 'confirmed').length;
      return { ...shift, availableVacancies: shift.totalVacancies - bookedCount };
    });
  },

  getShiftsByEvent: async (eventId: string): Promise<Shift[]> => {
    await delay(300);
    return shifts.filter(s => s.eventId === eventId);
  },

  getShiftById: async (shiftId: string): Promise<Shift | null> => {
    await delay(200);
    return shifts.find(s => s.id === shiftId) || null;
  },

  createShift: async (shiftData: Omit<Shift, 'id'>): Promise<Shift> => {
    await delay(500);
    const newShift: Shift = {
      ...shiftData,
      id: `shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    shifts.push(newShift);
    return newShift;
  },

  updateShift: async (shiftId: string, updates: Partial<Shift>): Promise<Shift> => {
    await delay(500);
    const index = shifts.findIndex(s => s.id === shiftId);
    if (index === -1) throw new Error('Turno no encontrado');

    // Si se reduce el cupo, verificar que no sea menor a los inscritos
    if (updates.totalVacancies !== undefined) {
      const bookedCount = bookings.filter(b => b.shiftId === shiftId && b.status === 'confirmed').length;
      if (updates.totalVacancies < bookedCount) {
        throw new Error(`No se puede reducir el cupo a ${updates.totalVacancies} porque ya hay ${bookedCount} voluntarios inscritos.`);
      }
    }

    shifts[index] = { ...shifts[index], ...updates };

    // Recalcular vacantes disponibles
    const bookedCount = bookings.filter(b => b.shiftId === shiftId && b.status === 'confirmed').length;
    shifts[index].availableVacancies = shifts[index].totalVacancies - bookedCount;

    return shifts[index];
  },

  deleteShift: async (shiftId: string): Promise<void> => {
    await delay(500);
    // Verificar si hay bookings asociados
    const hasBookings = bookings.some(b => b.shiftId === shiftId && b.status !== 'cancelled');
    if (hasBookings) {
      throw new Error('No se puede eliminar un turno con voluntarios inscritos');
    }
    shifts = shifts.filter(s => s.id !== shiftId);
  },

  assignCoordinatorToShift: async (shiftId: string, userId: string): Promise<Shift> => {
    await delay(500);
    const shiftIndex = shifts.findIndex(s => s.id === shiftId);
    if (shiftIndex === -1) throw new Error('Turno no encontrado');

    // Verificar que el usuario esté registrado en el turno
    const userBooking = bookings.find(b => b.userId === userId && b.shiftId === shiftId && b.status === 'confirmed');
    if (!userBooking) throw new Error('El voluntario debe estar registrado en el turno primero');

    // Agregar coordinador
    if (!shifts[shiftIndex].coordinatorIds.includes(userId)) {
      shifts[shiftIndex].coordinatorIds.push(userId);
    }

    // Actualizar rol del usuario
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      users[userIndex].role = 'coordinator';
    }

    // Liberar su vacante anterior si tenía otro rol
    // (En este caso no lo implementamos porque el coordinador mantiene su turno)

    return shifts[shiftIndex];
  },

  removeCoordinatorFromShift: async (shiftId: string, userId: string): Promise<Shift> => {
    await delay(400);
    const shiftIndex = shifts.findIndex(s => s.id === shiftId);
    if (shiftIndex === -1) throw new Error('Turno no encontrado');

    shifts[shiftIndex].coordinatorIds = shifts[shiftIndex].coordinatorIds.filter(id => id !== userId);

    // Si no es coordinador de ningún otro turno, cambiar rol a volunteer
    const isCoordinatorElsewhere = shifts.some(s => s.coordinatorIds.includes(userId));
    if (!isCoordinatorElsewhere) {
      const userIndex = users.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        users[userIndex].role = 'volunteer';
      }
    }

    return shifts[shiftIndex];
  },

  // ==================== BOOKINGS ====================
  createBooking: async (userId: string, shiftId: string): Promise<Booking> => {
    await delay(1000);
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) throw new Error("Turno no encontrado.");

    const existingBooking = bookings.find(b => b.userId === userId && b.shiftId === shiftId && b.status !== 'cancelled');
    if (existingBooking) throw new Error("Ya estás inscripto en este turno.");

    const confirmedBookings = bookings.filter(b => b.shiftId === shiftId && b.status === 'confirmed').length;

    // Si está lleno, agregar a lista de espera
    if (confirmedBookings >= shift.totalVacancies) {
      const waitlistEntry: WaitlistEntry = {
        id: `wl_${Date.now()}`,
        userId,
        shiftId,
        eventId: shift.eventId,
        position: waitlist.filter(w => w.shiftId === shiftId).length + 1,
        createdAt: new Date().toISOString(),
      };
      waitlist.push(waitlistEntry);

      // Crear booking en estado waitlist
      const newBooking: Booking = {
        id: `booking_${Date.now()}`,
        userId,
        shiftId,
        eventId: shift.eventId,
        status: 'waitlist',
        requestedAt: new Date().toISOString(),
      };
      bookings.push(newBooking);
      throw new Error("No hay vacantes disponibles. Te agregamos a la lista de espera.");
    }

    const newBooking: Booking = {
      id: `booking_${Date.now()}`,
      userId,
      shiftId,
      eventId: shift.eventId,
      status: 'confirmed',
      requestedAt: new Date().toISOString(),
    };
    bookings.push(newBooking);
    console.log('New booking created:', newBooking);
    return newBooking;
  },

  getBookingsByEvent: async (eventId: string): Promise<Booking[]> => {
    await delay(400);
    return bookings.filter(b => b.eventId === eventId && b.status !== 'cancelled');
  },

  getUserBookings: async (userId: string, eventId?: string): Promise<Booking[]> => {
    await delay(400);
    let userBookings = bookings.filter(b => b.userId === userId && b.status !== 'cancelled');

    if (eventId) {
      userBookings = userBookings.filter(b => b.eventId === eventId);
    }

    return userBookings
      .map(b => {
        const shift = shifts.find(s => s.id === b.shiftId);
        const role = roles.find(r => r.id === shift?.roleId);
        return { ...b, shift: shift ? { ...shift, role: role! } : undefined };
      })
      .sort((a, b) => new Date(a.shift?.date!).getTime() - new Date(b.shift?.date!).getTime());
  },

  requestBookingCancellation: async (bookingId: string): Promise<Booking> => {
    await delay(600);
    const bookingIndex = bookings.findIndex(b => b.id === bookingId);
    if (bookingIndex === -1) throw new Error("Inscripción no encontrada.");

    const booking = bookings[bookingIndex];
    const shift = shifts.find(s => s.id === booking.shiftId);
    if (!shift) throw new Error("Turno no encontrado.");

    const cancelledAt = new Date().toISOString();

    // Verificar si es <24hs o >24hs
    if (isWithin24Hours(shift.date, shift.timeSlot)) {
      // <24hs: cancelación automática
      bookings[bookingIndex].status = 'cancelled';
      bookings[bookingIndex].cancelledAt = cancelledAt;

      // Procesar lista de espera
      await mockApi.processWaitlist(shift.id);

      return { ...bookings[bookingIndex] };
    } else {
      // >24hs: requiere validación
      bookings[bookingIndex].status = 'cancellation_requested';
      bookings[bookingIndex].cancelledAt = cancelledAt;
      return { ...bookings[bookingIndex] };
    }
  },

  processWaitlist: async (shiftId: string): Promise<void> => {
    await delay(300);
    const waitlistEntries = waitlist.filter(w => w.shiftId === shiftId).sort((a, b) => a.position - b.position);

    if (waitlistEntries.length > 0) {
      const nextEntry = waitlistEntries[0];

      // Mover de waitlist a confirmed
      const bookingIndex = bookings.findIndex(b => b.userId === nextEntry.userId && b.shiftId === shiftId);
      if (bookingIndex !== -1) {
        bookings[bookingIndex].status = 'confirmed';
      }

      // Eliminar de waitlist
      waitlist = waitlist.filter(w => w.id !== nextEntry.id);

      console.log(`Processed waitlist: User ${nextEntry.userId} moved to confirmed for shift ${shiftId}`);
    }
  },

  updateBookingAttendance: async (bookingId: string, attendance: 'pending' | 'attended' | 'absent'): Promise<void> => {
    await delay(300);
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) throw new Error('Inscripción no encontrada');
    booking.attendance = attendance;
  },

  // ==================== ADMIN FUNCTIONS ====================
  getPendingCancellations: async (eventId?: string): Promise<Booking[]> => {
    await delay(500);
    let pendingCancellations = bookings.filter(b => b.status === 'cancellation_requested');

    if (eventId) {
      pendingCancellations = pendingCancellations.filter(b => b.eventId === eventId);
    }

    return pendingCancellations.map(b => {
      const user = users.find(u => u.id === b.userId);
      const shift = shifts.find(s => s.id === b.shiftId);
      const role = roles.find(r => r.id === shift?.roleId);
      return { ...b, user, shift: shift ? { ...shift, role: role! } : undefined };
    });
  },

  approveCancellation: async (bookingId: string): Promise<Booking> => {
    await delay(700);
    const bookingIndex = bookings.findIndex(b => b.id === bookingId);
    if (bookingIndex === -1) throw new Error("Inscripción no encontrada.");

    bookings[bookingIndex].status = 'cancelled';
    console.log(`Booking ${bookingId} cancelled.`);

    // Procesar lista de espera
    const shiftId = bookings[bookingIndex].shiftId;
    await mockApi.processWaitlist(shiftId);

    return { ...bookings[bookingIndex] };
  },

  getPrintableRoster: async (eventId: string, date: string, timeSlot: string): Promise<any[]> => {
    await delay(800);
    const targetShifts = shifts.filter(s => s.eventId === eventId && s.date === date && s.timeSlot === timeSlot);
    const targetShiftIds = targetShifts.map(s => s.id);

    const rosterBookings = bookings.filter(b => targetShiftIds.includes(b.shiftId) && b.status === 'confirmed');

    return rosterBookings.map(b => {
      const user = users.find(u => u.id === b.userId);
      const shift = shifts.find(s => s.id === b.shiftId);
      const role = roles.find(r => r.id === shift?.roleId);
      return {
        fullName: user?.fullName || 'N/A',
        dni: user?.dni || 'N/A',
        role: role?.name || 'N/A',
      };
    }).sort((a, b) => a.role.localeCompare(b.role));
  },

  // ==================== DASHBOARD METRICS ====================
  getDashboardMetrics: async (eventId: string): Promise<DashboardMetrics> => {
    await delay(600);

    const eventShifts = shifts.filter(s => s.eventId === eventId);
    const eventBookings = bookings.filter(b => b.eventId === eventId && b.status === 'confirmed');

    const totalVacancies = eventShifts.reduce((sum, s) => sum + s.totalVacancies, 0);
    const occupiedVacancies = eventBookings.length;
    const availableVacancies = totalVacancies - occupiedVacancies;
    const occupationPercentage = totalVacancies > 0 ? Math.round((occupiedVacancies / totalVacancies) * 100) : 0;

    const uniqueVolunteers = new Set(eventBookings.map(b => b.userId)).size;
    const avgShiftsPerVolunteer = uniqueVolunteers > 0 ? (occupiedVacancies / uniqueVolunteers).toFixed(1) : 0;

    const pendingCancellations = bookings.filter(b => b.eventId === eventId && b.status === 'cancellation_requested').length;
    const waitlistCount = waitlist.filter(w => w.eventId === eventId).length;

    // Role distribution
    const roleDistribution = eventBookings.reduce((acc, b) => {
      const shift = eventShifts.find(s => s.id === b.shiftId);
      const role = roles.find(r => r.id === shift?.roleId);
      if (role) {
        const existing = acc.find(r => r.roleName === role.name);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ roleName: role.name, count: 1 });
        }
      }
      return acc;
    }, [] as { roleName: string; count: number }[]);

    // Daily occupation
    const uniqueDates = [...new Set(eventShifts.map(s => s.date))].sort();
    const dailyOccupation = uniqueDates.map(date => {
      const dateShifts = eventShifts.filter(s => s.date === date);
      const dateBookings = eventBookings.filter(b => {
        const shift = eventShifts.find(s => s.id === b.shiftId);
        return shift?.date === date;
      });
      const dateVacancies = dateShifts.reduce((sum, s) => sum + s.totalVacancies, 0);
      const occupation = dateVacancies > 0 ? Math.round((dateBookings.length / dateVacancies) * 100) : 0;
      return { date, occupation };
    });

    // Shift occupation (dynamic)
    const shiftOccupation: Record<string, number> = {};
    const uniqueTimeSlots = [...new Set(eventShifts.map(s => s.timeSlot))].sort();

    uniqueTimeSlots.forEach(slot => {
      const slotShifts = eventShifts.filter(s => s.timeSlot === slot);
      const slotBookings = eventBookings.filter(b => {
        const shift = eventShifts.find(s => s.id === b.shiftId);
        return shift?.timeSlot === slot;
      });
      const slotVacancies = slotShifts.reduce((sum, s) => sum + s.totalVacancies, 0);
      shiftOccupation[slot] = slotVacancies > 0 ? Math.round((slotBookings.length / slotVacancies) * 100) : 0;
    });

    return {
      eventId,
      totalVacancies,
      occupiedVacancies,
      availableVacancies,
      occupationPercentage,
      totalVolunteers: uniqueVolunteers,
      uniqueVolunteers,
      avgShiftsPerVolunteer: Number(avgShiftsPerVolunteer),
      totalShifts: eventShifts.length,
      pendingCancellations,
      waitlistCount,
      roleDistribution,
      dailyOccupation,
      shiftOccupation,
    };
  },
};