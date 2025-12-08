import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Shift, Role, Booking } from '../types';
import { mockApi } from '../services/mockApiService';
import { ChevronLeft, ChevronRight, Clock, AlertTriangle, Calendar as CalendarIcon, MapPin, CheckCircle2, Plus, Info, Mail, Phone } from 'lucide-react';
import RoleDetailModal from './RoleDetailModal';
import Modal from './Modal';
import { toast } from 'react-hot-toast';

interface VolunteerPortalProps {
  user: User;
  onLogout: () => void;
  eventId?: string;
}

const VolunteerPortal: React.FC<VolunteerPortalProps> = ({ user, onLogout, eventId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [event, setEvent] = useState<any>(null); // To store event details
  const [showEventModal, setShowEventModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'shifts' | 'bookings'>('shifts');

  useEffect(() => {
    const loadEventData = async () => {
      if (eventId) {
        const eventData = await mockApi.getEventById(eventId);
        if (eventData) {
          setEvent(eventData);
          // Set initial dates based on event
          const start = new Date(eventData.fechaInicio);
          // Adjust for timezone if needed, but for now assume string is enough
          // Actually, let's just use the string date components to avoid timezone shifts on 'new Date()'
          const [y, m, d] = eventData.fechaInicio.split('-').map(Number);
          const startDate = new Date(y, m - 1, d);

          setCurrentDate(startDate);
          setSelectedDate(startDate);
        }
      }
    };
    loadEventData();
  }, [eventId]);

  const eventStartDate = event ? new Date(event.fechaInicio + 'T00:00:00') : new Date('2026-04-23T00:00:00');
  const eventEndDate = event ? new Date(event.fechaFin + 'T00:00:00') : new Date('2026-05-11T00:00:00');

  const fetchShifts = useCallback(async (date: Date) => {
    setIsLoading(true);
    try {
      const dateString = date.toISOString().split('T')[0];
      // Use eventId if available, otherwise default to event_1 (legacy behavior)
      const targetEventId = eventId || 'event_1';
      const fetchedShifts = await mockApi.getShiftsForDate(targetEventId, dateString);
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
    const confirmation = window.confirm("¿Confirmas tu inscripción? Recuerda que es un compromiso de asistencia.");
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
    const confirmation = window.confirm("¿Estás seguro de que deseas darte de baja?");
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
    const groups: Record<string, Shift[]> = {};
    shifts.forEach(shift => {
      if (!groups[shift.timeSlot]) {
        groups[shift.timeSlot] = [];
      }
      groups[shift.timeSlot].push(shift);
    });
    return groups;
  }, [shifts]);

  // Helper to parse date string "YYYY-MM-DD" to local Date object
  const parseLocalDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const renderCalendar = () => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="bg-white p-5 rounded-lg shadow-card border border-fs-border">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600"><ChevronLeft size={20} /></button>
          <h3 className="font-serif text-lg text-fs-text font-medium capitalize">{currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</h3>
          <button onClick={() => changeMonth(1)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600"><ChevronRight size={20} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-fs-meta uppercase mb-2">
          {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {blanks.map((_, i) => <div key={`blank-${i}`} />)}
          {days.map(day => {
            const date = new Date(year, month, day);
            const isSelected = selectedDate.toDateString() === date.toDateString();
            const isInEvent = date >= eventStartDate && date <= eventEndDate;
            const isBooked = userBookings.some(b => {
              if (!b.shift?.date) return false;
              const bookingDate = parseLocalDate(b.shift.date);
              return bookingDate.toDateString() === date.toDateString();
            });

            let classes = "w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm font-medium transition-colors ";
            if (isInEvent) {
              if (isSelected) {
                classes += "bg-primary-500 text-white shadow-sm ";
              } else if (isBooked) {
                classes += "bg-primary-100 text-primary-700 ring-1 ring-primary-200 ";
              } else {
                classes += "text-fs-text hover:bg-gray-100 cursor-pointer ";
              }
            } else {
              classes += "text-gray-300 cursor-default ";
            }

            return (
              <div key={day} className="py-1">
                <div className={classes} onClick={() => isInEvent && handleDateChange(date)}>
                  {day}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-fs-border text-xs text-gray-500 flex justify-center gap-4">
          <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-primary-500 mr-1.5"></span> Seleccionado</div>
          <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-primary-100 ring-1 ring-primary-200 mr-1.5"></span> Tu Turno</div>
        </div>
      </div>
    );
  };

  const renderMobileDateSelector = () => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Auto-scroll to selected date could be added here with a ref

    return (
      <div className="bg-white border-b border-fs-border shadow-sm sticky top-[60px] z-40">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
          <button onClick={() => changeMonth(-1)} className="p-1 rounded-full hover:bg-white text-gray-600"><ChevronLeft size={18} /></button>
          <span className="font-serif text-sm font-medium capitalize text-fs-text">
            {currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => changeMonth(1)} className="p-1 rounded-full hover:bg-white text-gray-600"><ChevronRight size={18} /></button>
        </div>
        <div className="overflow-x-auto flex gap-2 p-3 custom-scrollbar hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {days.map(day => {
            const date = new Date(year, month, day);
            const isSelected = selectedDate.toDateString() === date.toDateString();
            const isInEvent = date >= eventStartDate && date <= eventEndDate;
            const isBooked = userBookings.some(b => {
              if (!b.shift?.date) return false;
              const bookingDate = parseLocalDate(b.shift.date);
              return bookingDate.toDateString() === date.toDateString();
            });
            const isToday = new Date().toDateString() === date.toDateString();

            const dateLabel = date.toLocaleDateString('es-ES', { weekday: 'short' });

            return (
              <button
                key={day}
                onClick={() => isInEvent && handleDateChange(date)}
                disabled={!isInEvent}
                className={`flex flex-col items-center justify-center min-w-[3.5rem] h-14 rounded-lg transition-all flex-shrink-0 ${isSelected
                    ? 'bg-primary-500 text-white shadow-md transform scale-105'
                    : isInEvent
                      ? isBooked
                        ? 'bg-primary-50 border border-primary-200 text-primary-700'
                        : 'bg-white border border-gray-200 text-fs-text hover:border-primary-300'
                      : 'bg-gray-50 text-gray-300 border border-transparent'
                  }`}
              >
                <span className="text-[10px] uppercase font-bold leading-none mb-1 opacity-80">{dateLabel.slice(0, 3)}</span>
                <span className={`text-base font-bold leading-none ${isToday && !isSelected ? 'underline decoration-primary-300 decoration-2 underline-offset-2' : ''}`}>{day}</span>
                {isBooked && !isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1"></div>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Desconocido';

  return (
    <div className="pb-24 lg:pb-12">
      {selectedRole && <RoleDetailModal role={selectedRole} onClose={() => setSelectedRole(null)} />}

      {/* Modal de Detalles del Evento */}
      <Modal
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        title="Detalles del Evento"
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-fs-text mb-2">{event?.nombre}</h3>
            <p className="text-gray-600">{event?.descripcion || "Sin descripción disponible."}</p>
          </div>

          <div className="flex items-start space-x-3">
            <MapPin className="text-primary-500 mt-1 shrink-0" size={20} />
            <div>
              <h4 className="font-bold text-gray-900">Ubicación</h4>
              <p className="text-gray-600">{event?.ubicacion || "Ubicación no especificada"}</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <CalendarIcon className="text-primary-500 mt-1 shrink-0" size={20} />
            <div>
              <h4 className="font-bold text-gray-900">Fechas</h4>
              <p className="text-gray-600">
                Del {new Date(event?.fechaInicio + 'T00:00:00').toLocaleDateString()} al {new Date(event?.fechaFin + 'T00:00:00').toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <h4 className="font-bold text-gray-900 mb-3">Contacto del Administrador</h4>
            <div className="space-y-2">
              <div className="flex items-center text-gray-600">
                <Mail size={18} className="mr-2 text-gray-400" />
                <span>admin@feria.com</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Phone size={18} className="mr-2 text-gray-400" />
                <span>+54 11 1234-5678</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* MOBILE HEADER & TABS (Visible only on < lg) */}
      <div className="lg:hidden">
        {activeTab === 'shifts' && (
          <>
            {renderMobileDateSelector()}
            <div className="px-4 py-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-serif font-medium text-fs-text">
                  Turnos Disponibles
                </h2>
                <button onClick={() => setShowEventModal(true)} className="text-fs-blue">
                  <Info size={20} />
                </button>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-primary-500 mb-3"></div>
                  <p className="text-xs text-gray-500">Cargando...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Render Shifts for Mobile - simplified card */}
                  {Object.entries(groupedShifts).sort().map(([timeSlot, shiftsInSlot]: [string, Shift[]]) => shiftsInSlot.length > 0 && (
                    <div key={timeSlot}>
                      <div className="flex items-center mb-2 px-1">
                        <Clock size={14} className="text-primary-600 mr-2" />
                        <span className="text-sm font-bold text-fs-text">{timeSlot} hs</span>
                        <div className="h-px bg-gray-200 flex-grow ml-3"></div>
                      </div>
                      <div className="space-y-3">
                        {shiftsInSlot.map(shift => {
                          const role = roles.find(r => r.id === shift.roleId);
                          const isFull = shift.availableVacancies <= 0;
                          const isAlreadyBooked = userBookings.some(b => b.shiftId === shift.id && b.status !== 'cancelled');

                          return (
                            <div key={shift.id} className={`bg-white border rounded-lg p-4 shadow-sm ${isAlreadyBooked ? 'border-primary-300 bg-primary-50/30' : 'border-gray-200'}`}>
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-fs-text">{role?.name}</h4>
                                {isAlreadyBooked && <CheckCircle2 size={18} className="text-primary-600" />}
                              </div>
                              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{role?.description}</p>

                              <div className="flex justify-between items-center">
                                <div className="text-xs text-gray-500">
                                  <span className={`font-bold text-sm ${shift.availableVacancies < 3 ? 'text-orange-600' : 'text-gray-700'}`}>{shift.availableVacancies}</span> vacantes
                                </div>
                                {isAlreadyBooked ? (
                                  <span className="text-xs font-bold text-primary-700 bg-primary-100 px-2 py-1 rounded">Inscripto</span>
                                ) : (
                                  <button
                                    onClick={() => handleSignUp(shift.id)}
                                    disabled={isFull}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${isFull ? 'bg-gray-100 text-gray-400' : 'bg-primary-500 text-white'}`}
                                  >
                                    {isFull ? 'Lleno' : 'Inscribirme'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {Object.values(groupedShifts).every((arr: Shift[]) => arr.length === 0) && (
                    <div className="text-center py-10">
                      <p className="text-gray-400 text-sm">No hay turnos para esta fecha.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'bookings' && (
          <div className="px-4 py-6">
            <h2 className="text-xl font-serif text-fs-text mb-6">Mis Inscripciones</h2>
            {userBookings.length > 0 ? (
              <ul className="space-y-4">
                {userBookings.map(booking => (
                  <li key={booking.id} className="bg-white p-4 rounded-lg shadow-sm border border-fs-border">
                    <div className="flex justify-between mb-2">
                      <span className="font-bold text-fs-text">{booking.shift?.role.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {booking.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 mb-1">
                      <CalendarIcon size={14} className="mr-2" />
                      <span className="capitalize">
                        {booking.shift?.date ? parseLocalDate(booking.shift.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 mb-3">
                      <Clock size={14} className="mr-2" />
                      <span>{booking.shift?.timeSlot} hs</span>
                    </div>
                    {booking.status === 'confirmed' && (
                      <button onClick={() => handleCancellationRequest(booking.id)} className="w-full py-2 text-center text-red-600 border border-red-200 rounded hover:bg-red-50 text-sm font-medium transition-colors">
                        Solicitar Baja
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-12 px-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <div className="inline-block p-4 bg-white rounded-full mb-3 shadow-sm">
                  <CalendarIcon size={24} className="text-gray-300" />
                </div>
                <p className="text-gray-500 text-sm mb-4">No tienes turnos agendados aún.</p>
                <button onClick={() => setActiveTab('shifts')} className="text-primary-600 font-bold text-sm">Explorar turnos</button>
              </div>
            )}
          </div>
        )}

        {/* BOTTOM NAVIGATION BAR */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe pt-2 px-6 flex justify-around items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button
            onClick={() => setActiveTab('shifts')}
            className={`flex flex-col items-center p-2 min-w-[64px] ${activeTab === 'shifts' ? 'text-primary-600' : 'text-gray-400'}`}
          >
            <CalendarIcon size={24} strokeWidth={activeTab === 'shifts' ? 2.5 : 2} />
            <span className="text-[10px] font-bold mt-1">Turnos</span>
          </button>

          <div className="w-px h-8 bg-gray-100"></div>

          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex flex-col items-center p-2 min-w-[64px] ${activeTab === 'bookings' ? 'text-primary-600' : 'text-gray-400'}`}
          >
            <div className="relative">
              <CheckCircle2 size={24} strokeWidth={activeTab === 'bookings' ? 2.5 : 2} />
              {userBookings.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] text-white font-bold">
                  {userBookings.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold mt-1">Mis Turnos</span>
          </button>
        </div>
      </div>


      {/* DESKTOP LAYOUT (Hidden on Mobile) */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
          {renderCalendar()}

          {/* Botón para ver detalles del evento */}
          <button
            onClick={() => setShowEventModal(true)}
            className="w-full flex items-center justify-center px-4 py-3 bg-white border border-fs-border rounded-lg shadow-sm hover:shadow-md hover:border-primary-300 transition-all text-fs-blue font-medium"
          >
            <Info size={20} className="mr-2" />
            Ver detalles del evento
          </button>

          <div className="bg-white p-5 rounded-lg shadow-card border border-fs-border">
            <h3 className="font-serif text-lg text-fs-text mb-4 border-b border-fs-border pb-2">Mis Inscripciones</h3>
            {userBookings.length > 0 ? (
              <ul className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {userBookings.map(booking => (
                  <li key={booking.id} className="group p-3 rounded-fs border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm hover:border-gray-200 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-fs-text text-sm">{booking.shift?.role.name}</p>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <CalendarIcon size={12} className="mr-1" />
                          {/* Fix: Use parseLocalDate to display correct date */}
                          <span className="capitalize mr-2">
                            {booking.shift?.date ? parseLocalDate(booking.shift.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'N/A'}
                          </span>
                          <Clock size={12} className="mr-1" />
                          <span>{booking.shift?.timeSlot}</span>
                        </div>
                      </div>
                      {booking.status === 'confirmed' && (
                        <button
                          onClick={() => handleCancellationRequest(booking.id)}
                          className="text-xs font-medium text-fs-blue hover:text-red-600 hover:underline px-2 py-1"
                        >
                          Baja
                        </button>
                      )}
                    </div>

                    {booking.status === 'cancellation_requested' && (
                      <div className="mt-2 bg-yellow-50 text-yellow-800 text-xs px-2 py-1.5 rounded-fs inline-flex items-center w-full border border-yellow-100">
                        <AlertTriangle size={12} className="mr-1.5" /> Solicitud pendiente
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-10 px-4 bg-gray-50 rounded-fs border border-dashed border-gray-200">
                <CalendarIcon size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No tienes turnos agendados aún.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="mb-6">
            <h2 className="text-2xl font-serif text-fs-text">
              Turnos Disponibles
            </h2>
            <p className="text-fs-meta mt-1 capitalize flex items-center">
              <span className="font-medium text-gray-800">{selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              <span className="mx-2 text-gray-300">|</span>
              {event ? event.nombre : 'Cargando...'}
            </p>
          </div>

          {isLoading ? (
            <div className="text-center p-24 bg-white rounded-lg border border-fs-border shadow-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-primary-500 mx-auto mb-4"></div>
              <p className="text-gray-500 text-sm font-medium">Actualizando disponibilidad...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedShifts).sort().map(([timeSlot, shiftsInSlot]: [string, Shift[]]) => shiftsInSlot.length > 0 && (
                <div key={timeSlot} className="animate-fade-in">
                  <div className="flex items-center mb-3">
                    <div className="bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-sm font-bold flex items-center border border-primary-100">
                      <Clock size={16} className="mr-2" />
                      {timeSlot} hs
                    </div>
                    <div className="h-px bg-gray-200 flex-grow ml-4"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {shiftsInSlot.map(shift => {
                      const role = roles.find(r => r.id === shift.roleId);
                      const isFull = shift.availableVacancies <= 0;
                      const isAlreadyBooked = userBookings.some(b => b.shiftId === shift.id && b.status !== 'cancelled');

                      return (
                        <div key={shift.id} className={`bg-white border rounded-lg transition-all duration-200 flex flex-col
                          ${isAlreadyBooked
                            ? 'border-primary-200 ring-1 ring-primary-100 shadow-sm'
                            : 'border-fs-border shadow-card hover:shadow-card-hover hover:border-gray-300'
                          } ${isFull && !isAlreadyBooked ? 'opacity-75 bg-gray-50' : ''}`}>

                          <div className="p-5 flex-grow">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold text-base text-fs-text leading-snug">
                                {role?.name}
                              </h4>
                              {role?.youtubeUrl && (
                                <button onClick={() => setSelectedRole(role)} className="text-fs-blue hover:text-blue-800 text-xs font-medium shrink-0 ml-2">
                                  Ver detalle
                                </button>
                              )}
                            </div>

                            <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5em]">
                              {role?.description}
                            </p>

                            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                              <div className="flex flex-col">
                                <span className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-0.5">Vacantes</span>
                                <div className="flex items-baseline">
                                  <span className={`text-lg font-bold ${shift.availableVacancies > 3 ? 'text-gray-700' : 'text-orange-600'}`}>
                                    {shift.availableVacancies}
                                  </span>
                                  <span className="text-xs text-gray-400 ml-1">/ {shift.totalVacancies}</span>
                                </div>
                              </div>

                              {isAlreadyBooked ? (
                                <div className="flex items-center text-primary-600 font-bold text-sm bg-primary-50 px-3 py-2 rounded-fs">
                                  <CheckCircle2 size={18} className="mr-2" />
                                  Inscripto
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleSignUp(shift.id)}
                                  disabled={isFull}
                                  className={`flex items-center px-4 py-2 rounded-fs text-sm font-bold transition-colors ${isFull
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-primary-500 text-white hover:bg-primary-600 shadow-sm'
                                    }`}
                                >
                                  {isFull ? 'Completo' : <><Plus size={16} className="mr-1.5" /> Inscribirme</>}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {Object.values(groupedShifts).every((arr: Shift[]) => arr.length === 0) && (
                <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="text-gray-500">No hay turnos configurados para esta fecha.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VolunteerPortal;