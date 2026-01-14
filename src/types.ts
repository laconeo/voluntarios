export interface User {
  id: string;
  dni: string;
  fullName: string;
  email: string;
  phone: string;
  tshirtSize: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  isMember: boolean;
  attendedPrevious: boolean;
  isOver18: boolean;
  howTheyHeard: string;
  role: 'volunteer' | 'admin' | 'coordinator' | 'superadmin';
  password?: string; // Solo para admin y superadmin
  status?: 'active' | 'suspended' | 'deleted'; // Estado del usuario
  createdAt?: string;
}

export interface Event {
  id: string;
  slug: string;
  nombre: string;
  ubicacion: string;
  pais: string;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;
  descripcion: string;
  estado: 'Activo' | 'Inactivo' | 'Archivado';
  voluntarios: number; // contador
  turnos: number; // contador
  ocupacion: number; // porcentaje
  createdAt: string;
}

export interface Role {
  id: string;
  eventId: string; // Roles son por evento
  name: string;
  description: string;
  detailedTasks: string;
  youtubeUrl?: string;
  experienceLevel: 'nueva' | 'intermedia' | 'avanzada';
  requiresApproval?: boolean; // Indica si el rol requiere aprobación de admin (ej: Coordinador)
  isVisible?: boolean; // Nuevo: Controla la visibilidad del rol en el frontend
  createdAt: string;
}

export interface Shift {
  id: string;
  eventId: string; // Turnos pertenecen a un evento
  date: string; // YYYY-MM-DD
  timeSlot: string;
  roleId: string;
  totalVacancies: number;
  availableVacancies: number;
  coordinatorIds: string[]; // Array de IDs de coordinadores asignados
}

export interface Booking {
  id: string;
  userId: string;
  shiftId: string;
  eventId: string;
  status: 'confirmed' | 'cancellation_requested' | 'cancelled' | 'waitlist' | 'pending_approval';
  attendance?: 'pending' | 'attended' | 'absent'; // Estado de asistencia
  requestedAt: string; // Timestamp de cuando se registró
  cancelledAt?: string; // Timestamp de cuando solicitó baja
  user?: User;
  shift?: Shift & { role: Role };
}

export interface WaitlistEntry {
  id: string;
  userId: string;
  shiftId: string;
  eventId: string;
  position: number;
  createdAt: string;
}

export interface EventAdmin {
  id: string;
  userId: string;
  eventId: string;
  assignedAt: string;
  assignedBy: string; // userId del super admin que lo asignó
}

export interface DashboardMetrics {
  eventId: string;
  totalVacancies: number;
  occupiedVacancies: number;
  availableVacancies: number;
  occupationPercentage: number;
  totalVolunteers: number;
  uniqueVolunteers: number;
  avgShiftsPerVolunteer: number;
  totalShifts: number;
  pendingCancellations: number;
  pendingCoordinatorRequests?: number; // Nuevas solicitudes de coordinación pendientes
  waitlistCount: number;
  roleDistribution: { roleName: string; count: number }[];
  dailyOccupation: { date: string; occupation: number }[];
  shiftOccupation: Record<string, number>; // Ocupación por franja horaria (timeSlot -> cantidad)
  attendancePercentage?: number;
  previousExperiencePercentage?: number;
}