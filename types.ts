
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
  role: 'volunteer' | 'admin' | 'coordinator';
}

export interface Role {
  id: string;
  name: string;
  description: string;
  detailedTasks: string;
  youtubeUrl?: string;
  experienceLevel: 'nueva' | 'intermedia' | 'avanzada';
}

export interface Shift {
  id: string;
  date: string; // YYYY-MM-DD
  timeSlot: '13:00-16:00' | '16:00-22:00';
  roleId: string;
  totalVacancies: number;
  availableVacancies: number;
}

export interface Booking {
  id: string;
  userId: string;
  shiftId: string;
  status: 'confirmed' | 'cancellation_requested' | 'cancelled';
  user?: User;
  shift?: Shift & { role: Role };
}
