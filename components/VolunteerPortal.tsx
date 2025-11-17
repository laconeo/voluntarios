
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Shift, Role, Booking } from '../types';
import { mockApi } from '../services/mockApiService';
import { Calendar, ChevronLeft, ChevronRight, Info, PlusCircle, Clock, Users, X, CheckCircle, AlertTriangle } from 'lucide-react';
import RoleDetailModal from './RoleDetailModal';
import { toast } from 'react-hot-toast';

interface VolunteerPortalProps {
  user: User;
  onLogout: () => void;
}

const VolunteerPortal: React.FC<VolunteerPortalProps> = ({ user, onLogout }) => {
  const [currentDate, setCurrentDate] = useState(new Date('2026-04-23'));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date('2026-04-23'));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  
  const eventStartDate = new Date('2026-04-23T00:00:00');
  const eventEndDate = new Date('2026-05-11T00:00:00');

  const fetchShifts = useCallback(async (date: Date) => {
    setIsLoading(true);
    try {
      const dateString = date.toISOString().split('T')[0];
      const fetchedShifts = await mockApi.getShiftsForDate(dateString);
      setShifts(fetchedShifts);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      toast.error('No se pudieron cargar los turnos.');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const fetchUserBookings = useCallback(async () => {
    try {
      const bookings = await mockApi.getUserBookings(user.id);
      setUserBookings(bookings);
    } catch (error) {
      console.error("Error fetching user bookings:", error);
      toast.error('No se pudieron cargar tus inscripciones.');
    }
  }, [user.id]);

  useEffect(() => {
    mockApi.getAllRoles().then(setRoles);
    fetchShifts(selectedDate);
    fetchUserBookings();
  }, [selectedDate, fetchShifts, fetchUserBookings]);
  
  const handleDateChange = (date: Date) => {
    if (date >= eventStartDate && date <= eventEndDate) {
        setSelectedDate(date);
    }
  };

  const changeMonth = (amount: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + amount);
      return newDate;
    });
  };

  const handleSignUp = async (shiftId: string) => {
    const confirmation = window.confirm("¿Estás seguro de que deseas inscribirte? Recuerda que esto es un COMPROMISO.");
    if (confirmation) {
        try {
            await mockApi.createBooking(user.id, shiftId);
            toast.success('¡Inscripción exitosa!');
            fetchShifts(selectedDate);
            fetchUserBookings();
        } catch (error: any) {
            toast.error(error.message || 'Error al inscribirse.');
        }
    }
  };

  const handleCancellationRequest = async (bookingId: string) => {
    const confirmation = window.confirm("¿Estás seguro de que deseas solicitar la baja de este turno?");
    if (confirmation) {
        try {
            await mockApi.requestBookingCancellation(bookingId);
            toast.success('Solicitud de baja enviada.');
            fetchUserBookings();
        } catch (error: any) {
            toast.error(error.message || 'Error al solicitar la baja.');
        }
    }
  };

  const groupedShifts = useMemo(() => {
    const groups: Record<string, Shift[]> = {
        '13:00-16:00': [],
        '16:00-22:00': [],
    };
    shifts.forEach(shift => {
        if (groups[shift.timeSlot]) {
            groups[shift.timeSlot].push(shift);
        }
    });
    return groups;
  }, [shifts]);

  const renderCalendar = () => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ChevronLeft /></button>
          <h3 className="font-semibold text-lg">{currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</h3>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ChevronRight /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm text-gray-500 dark:text-gray-400">
          {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 mt-2">
          {blanks.map((_, i) => <div key={`blank-${i}`} />)}
          {days.map(day => {
            const date = new Date(year, month, day);
            const isSelected = selectedDate.toDateString() === date.toDateString();
            const isInEvent = date >= eventStartDate && date <= eventEndDate;
            const isBooked = userBookings.some(b => new Date(b.shift?.date!).toDateString() === date.toDateString());

            let classes = "w-9 h-9 flex items-center justify-center rounded-full cursor-pointer transition-colors ";
            if (isInEvent) {
                classes += isSelected ? "bg-primary-600 text-white font-bold " : "hover:bg-primary-100 dark:hover:bg-primary-900 ";
                if(isBooked && !isSelected) classes += "bg-green-200 dark:bg-green-800 "
            } else {
                classes += "text-gray-400 dark:text-gray-600 cursor-not-allowed ";
            }

            return (
              <div key={day} className={classes} onClick={() => isInEvent && handleDateChange(date)}>
                {day}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Desconocido';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {selectedRole && <RoleDetailModal role={selectedRole} onClose={() => setSelectedRole(null)} />}
      
      <div className="lg:col-span-1 space-y-6">
        {renderCalendar()}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-3 border-b pb-2 border-gray-200 dark:border-gray-700">Mis Inscripciones</h3>
          {userBookings.length > 0 ? (
            <ul className="space-y-3 max-h-60 overflow-y-auto">
              {userBookings.map(booking => (
                <li key={booking.id} className="p-3 rounded-md bg-gray-100 dark:bg-gray-700/50">
                  <p className="font-semibold">{booking.shift?.role.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {new Date(booking.shift?.date!).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {' - '}
                    {booking.shift?.timeSlot}
                  </p>
                  {booking.status === 'confirmed' && (
                    <button onClick={() => handleCancellationRequest(booking.id)} className="text-xs text-red-500 hover:underline mt-1">Solicitar baja</button>
                  )}
                  {booking.status === 'cancellation_requested' && (
                    <p className="text-xs text-yellow-500 mt-1 flex items-center"><AlertTriangle size={14} className="mr-1"/>Baja solicitada</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Aún no te has inscripto a ningún turno.</p>
          )}
        </div>
      </div>

      <div className="lg:col-span-2">
        <h2 className="text-2xl font-bold mb-4">
          Turnos disponibles para {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>
        {isLoading ? (
          <div className="text-center p-10">Cargando turnos...</div>
        ) : (
          <div className="space-y-6">
            {/* FIX: Explicitly type the map parameters to fix type inference issue with Object.entries. */}
            {Object.entries(groupedShifts).map(([timeSlot, shiftsInSlot]: [string, Shift[]]) => shiftsInSlot.length > 0 && (
              <div key={timeSlot}>
                <h3 className="text-xl font-semibold mb-3 flex items-center text-primary-700 dark:text-primary-300">
                  <Clock size={20} className="mr-2"/> Turno {timeSlot}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {shiftsInSlot.map(shift => (
                    <div key={shift.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col justify-between hover:shadow-xl transition-shadow">
                      <div>
                        <h4 className="font-bold text-lg">{getRoleName(shift.roleId)}</h4>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center my-2">
                          <Users size={16} className="mr-2" />
                          <span>{shift.availableVacancies} de {shift.totalVacancies} vacantes</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-end space-x-2 mt-4">
                         <button onClick={() => setSelectedRole(roles.find(r => r.id === shift.roleId) || null)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
                          <Info size={20}/>
                        </button>
                        {shift.availableVacancies > 0 ? (
                           <button onClick={() => handleSignUp(shift.id)} className="flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:bg-gray-400">
                             <PlusCircle size={16} className="mr-2"/> Inscribirse
                           </button>
                         ) : (
                            <span className="px-4 py-2 text-sm text-gray-500">Completo</span>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VolunteerPortal;