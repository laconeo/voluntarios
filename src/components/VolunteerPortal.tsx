import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Shift, Role, Booking } from '../types';
import { mockApi } from '../services/mockApiService';
import { ChevronLeft, ChevronRight, Clock, AlertTriangle, Calendar as CalendarIcon, MapPin, CheckCircle2, Plus, Info, Mail, Phone, Shield, Share2, Copy, Download, X, Youtube } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import RoleDetailModal from './RoleDetailModal';
import Modal from './Modal';
import { toast } from 'react-hot-toast';

interface VolunteerPortalProps {
  user: User;
  onLogout: () => void;
  eventId?: string;
}

const VolunteerPortal: React.FC<VolunteerPortalProps> = ({ user, onLogout, eventId }) => {
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftDates, setShiftDates] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [event, setEvent] = useState<any>(null); // To store event details
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'shifts' | 'bookings'>('shifts');
  const [isBooking, setIsBooking] = useState(false);

  // Auto-scroll to selected date in mobile view
  const scrollRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      const selectedElement = scrollRef.current.querySelector('[data-selected="true"]');
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedDate, activeTab]);

  useEffect(() => {
    const loadEventData = async () => {
      if (eventId) {
        const eventData = await mockApi.getEventById(eventId);

        if (eventData) {
          setEvent(eventData);

          // Get dates with shifts
          const dates = await mockApi.getEventShiftDates(eventId);
          setShiftDates(dates);

          const [y, m, d] = eventData.fechaInicio.split('-').map(Number);
          const startDate = new Date(y, m - 1, d);

          let initialDate = startDate;
          if (dates.length > 0) {
            const firstShift = dates.sort()[0]; // dates are strings YYYY-MM-DD
            const [sy, sm, sd] = firstShift.split('-').map(Number);
            const firstShiftDate = new Date(sy, sm - 1, sd);
            initialDate = firstShiftDate;
          }

          setCurrentDate(initialDate);
          setSelectedDate(initialDate);
        }
      }
    };
    loadEventData();
  }, [eventId]);

  const eventStartDate = event ? new Date(event.fechaInicio + 'T00:00:00') : new Date('2026-04-23T00:00:00');
  const eventEndDate = event ? new Date(event.fechaFin + 'T00:00:00') : new Date('2026-05-11T00:00:00');

  // Ref to track the latest requested date to avoid race conditions
  const lastRequestedDateRef = React.useRef<string>('');

  const fetchShifts = useCallback(async (date: Date) => {
    setIsLoading(true);
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    lastRequestedDateRef.current = dateString;

    try {
      const targetEventId = eventId || 'event_1';
      const fetchedShifts = await mockApi.getShiftsForDate(targetEventId, dateString);

      if (lastRequestedDateRef.current === dateString) {
        setShifts(fetchedShifts);
      }
    } catch (error) {
      console.error("Error fetching shifts:", error);
      toast.error('No se pudieron cargar los turnos.');
    } finally {
      if (lastRequestedDateRef.current === dateString) {
        setIsLoading(false);
      }
    }
  }, [eventId]);

  const parseLocalDate = (dateString: string) => {
    const [y, m, d] = dateString.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const [coordinatorsMap, setCoordinatorsMap] = useState<Record<string, User[]>>({});

  const fetchUserBookings = useCallback(async () => {
    try {
      const bookings = await mockApi.getUserBookings(user.id);
      setUserBookings(bookings);

      const myShiftIds = bookings
        .filter(b => b.status !== 'cancelled' && b.shift?.id)
        .map(b => b.shift!.id);

      if (myShiftIds.length > 0) {
        const coordinatorIds = new Set<string>();
        bookings.forEach(b => {
          b.shift?.coordinatorIds?.forEach(id => coordinatorIds.add(id));
        });

        const usersFromAssignment = await (coordinatorIds.size > 0
          ? mockApi.getUsersByIds(Array.from(coordinatorIds))
          : Promise.resolve([]));

        const shiftBookings = await mockApi.getBookingsForShifts(myShiftIds);
        const usersFromBookings = shiftBookings
          .filter(b => {
            const roleName = b.shift?.role?.name;
            const isCoordinator = roleName?.toLowerCase().includes('coordinador');
            return isCoordinator;
          })
          .map(b => ({ ...b.user!, shiftId: b.shiftId }));

        const map: Record<string, User[]> = {};
        bookings.forEach(myBooking => {
          if (!myBooking.shift) return;
          const shiftId = myBooking.shift.id;
          const shiftCoords: User[] = [];

          if (myBooking.shift.coordinatorIds) {
            const assigned = usersFromAssignment.filter(u => myBooking.shift!.coordinatorIds.includes(u.id));
            shiftCoords.push(...assigned);
          }

          const booked = usersFromBookings
            .filter(ub => ub.shiftId === shiftId && ub.id)
            .map(ub => ({ ...ub, shiftId: undefined }));

          const all = [...shiftCoords, ...booked];
          const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
          map[shiftId] = unique as User[];
        });

        setCoordinatorsMap(map);
      } else {
        setCoordinatorsMap({});
      }
    } catch (error) {
      console.error("Error fetching user bookings:", error);
      toast.error('No se pudieron cargar tus inscripciones.');
    }
  }, [user.id]);

  useEffect(() => {
    mockApi.getAllRoles().then(setRoles);
    if (event && selectedDate) {
      fetchShifts(selectedDate);
    }
    fetchUserBookings();
  }, [selectedDate, fetchShifts, fetchUserBookings, event]);

  const handleDateChange = (date: Date) => {
    if (event && date >= eventStartDate && date <= eventEndDate) {
      setSelectedDate(date);
    }
  };

  const changeMonth = (amount: number) => {
    setCurrentDate(prev => {
      if (!prev) return null;
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + amount);
      return newDate;
    });
  };

  const handleSignUp = async (shiftId: string) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (shift) {
      const conflict = userBookings.find(b =>
        b.status !== 'cancelled' &&
        b.shift &&
        b.shift.date === shift.date &&
        b.shift.timeSlot === shift.timeSlot
      );

      if (conflict) {
        toast.error('Ya estás inscripto en un turno en este mismo horario.');
        return;
      }
    }

    const role = roles.find(r => r.id === shift?.roleId);
    let message = "¿Confirmas tu inscripción? Recuerda que es un compromiso de asistencia.";
    if (role?.requiresApproval) {
      message = "⚠️ IMPORTANTE: Este rol requiere aprobación de un administrador. Tu inscripción quedará PENDIENTE hasta ser revisada. ¿Deseas continuar?";
    }

    const confirmation = window.confirm(message);
    if (confirmation) {
      setIsBooking(true);
      const toastId = toast.loading('Procesando inscripción, por favor espere...');

      try {
        await mockApi.createBooking(user.id, shiftId);
        toast.dismiss(toastId);

        if (role?.requiresApproval) {
          toast.success('Solicitud enviada. Pendiente de aprobación.');
        } else {
          toast.success('¡Inscripción exitosa!');
        }

        if (selectedDate) fetchShifts(selectedDate);
        fetchUserBookings();
      } catch (error: any) {
        toast.dismiss(toastId);
        toast.error(error.message || 'Error al inscribirse.');
      } finally {
        setIsBooking(false);
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
    const visibleRoles = roles.filter(r => r.isVisible !== false);
    shifts.forEach(shift => {
      const role = visibleRoles.find(r => r.id === shift.roleId);
      if (!role) return;
      if (!groups[shift.timeSlot]) groups[shift.timeSlot] = [];
      groups[shift.timeSlot].push(shift);
    });
    return groups;
  }, [shifts, roles]);

  const sortedActiveBookings = useMemo(() => {
    return userBookings
      .filter(b => b.status !== 'cancelled' && b.shift)
      .sort((a, b) => {
        if (!a.shift || !b.shift) return 0;
        const timeA = a.shift.timeSlot.split(' - ')[0];
        const timeB = b.shift.timeSlot.split(' - ')[0];
        const dateAStr = `${a.shift.date}T${timeA}:00`;
        const dateBStr = `${b.shift.date}T${timeB}:00`;
        return new Date(dateAStr).getTime() - new Date(dateBStr).getTime();
      });
  }, [userBookings]);

  const renderCalendar = () => {
    if (!currentDate || !selectedDate) {
      return (
        <div className="bg-white p-5 rounded-lg shadow-card border border-fs-border text-center text-gray-500">
          Cargando calendario...
        </div>
      );
    }

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
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = selectedDate.toDateString() === date.toDateString();
            const isInEvent = date >= eventStartDate && date <= eventEndDate;
            const hasShifts = shiftDates.includes(dateStr);
            const isBooked = userBookings.some(b => b.shift?.date === dateStr && b.status !== 'cancelled');

            let classes = "w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm font-medium transition-colors relative ";
            if (isInEvent) {
              if (isSelected) classes += "bg-primary-500 text-white shadow-sm ";
              else if (isBooked) classes += "bg-primary-100 text-primary-700 ring-1 ring-primary-200 ";
              else if (hasShifts) classes += "text-fs-text font-bold bg-gray-100 hover:bg-gray-200 cursor-pointer ";
              else classes += "text-fs-text hover:bg-gray-50 cursor-pointer opacity-60 ";
            } else classes += "text-gray-300 cursor-default ";

            return (
              <div key={day} className="py-1">
                <div className={classes} onClick={() => isInEvent && handleDateChange(date)}>
                  {day}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMobileDateSelector = () => {
    if (!currentDate || !selectedDate) {
      return (
        <div className="bg-white border-b border-fs-border shadow-sm sticky top-0 z-40 p-4 text-center text-gray-500">
          Cargando calendario...
        </div>
      );
    }

    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="bg-white border-b border-fs-border shadow-sm sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
          <button onClick={() => changeMonth(-1)} className="p-1 rounded-full hover:bg-white text-gray-600"><ChevronLeft size={18} /></button>
          <span className="font-serif text-sm font-medium capitalize text-fs-text">
            {currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => changeMonth(1)} className="p-1 rounded-full hover:bg-white text-gray-600"><ChevronRight size={18} /></button>
        </div>
        <div ref={scrollRef} className="overflow-x-auto flex gap-2 p-3 custom-scrollbar hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {days.map(day => {
            const date = new Date(year, month, day);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = selectedDate.toDateString() === date.toDateString();
            const isInEvent = date >= eventStartDate && date <= eventEndDate;
            const isBooked = userBookings.some(b => b.shift?.date === dateStr && b.status !== 'cancelled');
            const isToday = new Date().toDateString() === date.toDateString();
            const dateLabel = date.toLocaleDateString('es-ES', { weekday: 'short' });

            return (
              <button
                key={day}
                data-selected={isSelected}
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

  const generateSummaryText = () => {
    let text = `*Resumen de Asignaciones - ${event?.nombre || 'Evento'}*\n\n`;
    text += `📍 Ubicación: ${event?.ubicacion || 'No especificada'}\n`;
    if (event) {
      text += `📅 Fechas: ${new Date(event.fechaInicio + 'T00:00:00').toLocaleDateString('es-ES')} - ${new Date(event.fechaFin + 'T00:00:00').toLocaleDateString('es-ES')}\n`;
      const eventUrl = event.slug ? `${window.location.origin}/#/${event.slug}` : window.location.href;
      text += `🔗 Link Evento: ${eventUrl}\n\n`;
    }

    text += `*Mis Turnos:*\n`;
    const activeBookings = sortedActiveBookings;
    if (activeBookings.length === 0) {
      text += "No tienes turnos registrados.\n";
    } else {
      activeBookings.forEach(booking => {
        const date = booking.shift.date ? new Date(booking.shift.date + 'T12:00:00').toLocaleDateString('es-ES') : 'N/A';
        const roleName = booking.shift.role?.name || 'Rol';
        text += `- ${date} ${booking.shift.timeSlot} (${roleName}) - ${booking.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}\n`;
        if (booking.shift?.id && coordinatorsMap[booking.shift.id] && coordinatorsMap[booking.shift.id].length > 0) {
          const coords = coordinatorsMap[booking.shift.id];
          text += `  👤 Coordinador: ${coords.map(c => `${c.fullName} (${c.phone})`).join(', ')}\n`;
        }
      });
    }
    text += `\n*Contacto Admins:*\n📧 Email: ${event?.contactEmail || 'admin@evento.com'}`;
    return text;
  };

  const handleAddToCalendar = (booking: Booking) => {
    if (!booking.shift || !event) return;
    const shift = booking.shift;
    const [startTime, endTime] = shift.timeSlot.split(' - ');
    const dateStr = shift.date;
    const [startHour, startMin] = startTime.split(':');
    const [endHour, endMin] = endTime.split(':');
    const startDate = new Date(`${dateStr}T${startHour}:${startMin}:00`);
    const endDate = new Date(`${dateStr}T${endHour}:${endMin}:00`);

    const formatGoogleDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}${month}${day}T${hours}${minutes}00`;
    };

    const startFormatted = formatGoogleDate(startDate);
    const endFormatted = formatGoogleDate(endDate);
    let description = `Voluntariado - ${event.nombre}\n\nRol: ${shift.role?.name || 'Voluntario'}\n`;
    if (shift.id && coordinatorsMap[shift.id] && coordinatorsMap[shift.id].length > 0) {
      description += `Coordinador(es):\n`;
      coordinatorsMap[shift.id].forEach(c => description += `- ${c.fullName} (${c.phone})\n`);
    }
    const title = `${event.nombre} - ${shift.role?.name || 'Voluntariado'}`;
    const location = event.ubicacion || '';
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startFormatted}/${endFormatted}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;
    window.open(googleCalendarUrl, '_blank');
  };

  const handleShareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(generateSummaryText())}`, '_blank');
  const handleShareEmail = () => window.location.href = `mailto:?subject=${encodeURIComponent(`Resumen Voluntariado - ${event?.nombre || ''}`)}&body=${encodeURIComponent(generateSummaryText())}`;
  const handleCopyToClipboard = () => { navigator.clipboard.writeText(generateSummaryText()); toast.success('Resumen copiado al portapapeles'); };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(243, 244, 246);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setFontSize(22);
    doc.text("Voluntarios FamilySearch - Resumen de asignaciones", 14, 25);
    let yPos = 55;
    doc.setFontSize(14);
    doc.text(event?.nombre || 'Evento', 14, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.text(`Ubicación: ${event?.ubicacion || 'No especificada'}`, 14, yPos);
    yPos += 20;

    const tableColumn = ["Fecha", "Horario", "Rol", "Coordinador", "Estado"];
    const activeBookings = sortedActiveBookings;
    const tableRows = activeBookings.map(booking => [
      booking.shift.date ? new Date(booking.shift.date + 'T12:00:00').toLocaleDateString('es-ES') : 'N/A',
      booking.shift.timeSlot,
      booking.shift.role?.name || 'Rol',
      booking.shift?.id && coordinatorsMap[booking.shift.id] ? coordinatorsMap[booking.shift.id].map(c => c.fullName).join(', ') : 'No asignado',
      booking.status === 'confirmed' ? 'Confirmado' : 'Pendiente'
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [tableColumn],
      body: tableRows,
      headStyles: { fillColor: [140, 184, 62], textColor: 255 }
    });
    doc.save(`resumen_voluntariado_${event?.slug || 'evento'}.pdf`);
    toast.success('PDF descargado correctamente');
  };

  return (
    <div className="pb-24 lg:pb-12">
      {selectedRole && <RoleDetailModal role={selectedRole} onClose={() => setSelectedRole(null)} />}

      <Modal isOpen={showSummaryModal} onClose={() => setShowSummaryModal(false)} title="Resumen de Asignaciones">
        <div className="space-y-6">
          <div className="flex justify-around items-center bg-gray-50 border border-gray-200 p-3 rounded-lg shadow-sm mb-4">
            <button onClick={handleShareWhatsApp} title="Compartir por WhatsApp" className="p-3 bg-[#25D366] text-white rounded-full hover:bg-green-600 transition-colors shadow-sm"><Share2 size={20} /></button>
            <button onClick={handleShareEmail} title="Enviar por Email" className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm"><Mail size={20} /></button>
            <button onClick={handleCopyToClipboard} title="Copiar al portapapeles" className="p-3 bg-white border border-gray-300 text-gray-700 rounded-full hover:bg-gray-100 transition-colors shadow-sm"><Copy size={20} /></button>
            <button onClick={handleDownloadPDF} title="Descargar PDF" className="p-3 bg-gray-900 text-white rounded-full hover:bg-black transition-colors shadow-sm"><Download size={20} /></button>
          </div>

          <div className="bg-primary-50 p-4 rounded-lg border border-primary-100">
            <h4 className="font-bold text-lg text-primary-900 mb-2">{event?.nombre}</h4>
            <div className="text-sm text-primary-800 space-y-1">
              <div className="flex items-center gap-2"><MapPin size={16} /><span>{event?.ubicacion}</span></div>
              <div className="flex items-center gap-2"><CalendarIcon size={16} /><span>{event ? `${new Date(event.fechaInicio + 'T00:00:00').toLocaleDateString('es-ES')} - ${new Date(event.fechaFin + 'T00:00:00').toLocaleDateString('es-ES')}` : ""}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t border-primary-200">
              <p className="font-semibold text-sm text-primary-900 mb-2">Contacto Administradores: {event?.contactEmail}</p>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 mb-3 flex items-center justify-between">
              <span>Mis Turnos Activos</span>
              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{sortedActiveBookings.length} asignados</span>
            </h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {sortedActiveBookings.map(booking => (
                  <li key={booking.id} className="p-3 bg-white">
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-gray-900 text-sm">{booking.shift?.role?.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{booking.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{booking.shift?.date ? new Date(booking.shift.date + 'T12:00:00').toLocaleDateString('es-ES') : ''}</span><span>{booking.shift?.timeSlot}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showEventModal} onClose={() => setShowEventModal(false)} title="Detalles del Evento">
        <div className="space-y-6">
          <div><h3 className="text-lg font-bold text-fs-text mb-2">{event?.nombre}</h3><p className="text-gray-600">{event?.descripcion}</p></div>
          <div className="flex items-start space-x-3"><MapPin className="text-primary-500 mt-1" size={20} /><div><h4 className="font-bold">Ubicación</h4><p>{event?.ubicacion}</p></div></div>
          <div className="flex items-start space-x-3"><CalendarIcon className="text-primary-500 mt-1" size={20} /><div><h4 className="font-bold">Fechas</h4><p>{event?.fechaInicio} - {event?.fechaFin}</p></div></div>
        </div>
      </Modal>

      <div className="lg:hidden">
        {activeTab === 'shifts' && (
          <>
            {renderMobileDateSelector()}
            <div className="px-4 py-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-serif font-medium text-fs-text">Turnos Disponibles</h2>
                <button onClick={() => setShowEventModal(true)} className="text-fs-blue"><Info size={20} /></button>
              </div>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-primary-500 mb-3"></div><p className="text-xs text-gray-500">Cargando...</p></div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedShifts).sort().map(([timeSlot, shiftsInSlot]: [string, Shift[]]) => shiftsInSlot.length > 0 && (
                    <div key={timeSlot} className="mb-8 relative">
                      <div className="flex items-center mb-4 sticky top-[75px] bg-gray-50/95 backdrop-blur-sm py-2 z-10 -mx-2 px-2">
                        <div className="bg-primary-100 text-primary-800 px-4 py-2 rounded-lg text-base font-extrabold flex items-center border border-primary-200 shadow-sm">
                          <Clock size={18} className="mr-2 text-primary-600" />
                          {timeSlot} hs
                        </div>
                        <div className="h-px bg-primary-200 flex-grow ml-4 opacity-70"></div>
                      </div>
                      <div className="space-y-3">
                        {shiftsInSlot.map(shift => {
                          const role = roles.find(r => r.id === shift.roleId);
                          const isFull = shift.availableVacancies <= 0;
                          const isAlreadyBooked = userBookings.some(b => b.shiftId === shift.id && b.status !== 'cancelled');
                          return (
                            <div key={shift.id} className={`bg-white border rounded-lg p-4 shadow-sm ${isAlreadyBooked ? 'border-primary-300 bg-primary-50/30' : 'border-gray-200'}`}>
                              <div className="flex justify-between items-start mb-2"><div className="flex items-center"><h4 className="font-bold text-fs-text mr-2">{role?.name}</h4>{isAlreadyBooked && <CheckCircle2 size={18} className="text-primary-600 shrink-0" />}</div></div>
                              <p className="text-sm text-gray-600 line-clamp-2">{role?.description}</p>
                              <button onClick={() => role && setSelectedRole(role)} className="text-xs text-primary-600 font-bold hover:underline mb-3 mt-1 block">Mas Detalles</button>
                              {role?.requiresApproval && <div className="mb-3"><span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200"><Shield size={12} className="mr-1" />Requiere Aprobación Admin</span></div>}
                              <div className="flex justify-between items-center"><div className="text-xs text-gray-500"><span className={`font-bold text-sm ${shift.availableVacancies < 3 ? 'text-orange-600' : 'text-gray-700'}`}>{shift.availableVacancies}</span> vacantes</div>
                                {isAlreadyBooked ? (<span className={`text-xs font-bold px-2 py-1 rounded ${userBookings.find(b => b.shiftId === shift.id && b.status === 'pending_approval') ? 'text-orange-700 bg-orange-100' : 'text-primary-700 bg-primary-100'}`}>{userBookings.find(b => b.shiftId === shift.id && b.status === 'pending_approval') ? 'Pendiente' : 'Inscripto'}</span>
                                ) : (<button onClick={() => handleSignUp(shift.id)} disabled={isFull} className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase ${isFull ? 'bg-gray-100 text-gray-400' : 'bg-primary-500 text-white'}`}>{isFull ? 'Lleno' : (role?.requiresApproval ? 'Postularme' : 'Inscribirme')}</button>)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {Object.values(groupedShifts).every((arr: Shift[]) => arr.length === 0) && (<div className="text-center py-10"><p className="text-gray-400 text-sm">No hay turnos para esta fecha.</p></div>)}
                </div>
              )}
            </div>
          </>
        )}
        {activeTab === 'bookings' && (
          <div className="px-4 py-6">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-serif text-fs-text">Mis Inscripciones</h2>{userBookings.filter(b => b.shift).length > 0 && (<button onClick={() => setShowSummaryModal(true)} className="flex items-center gap-1 text-sm font-medium text-primary-600 px-3 py-1.5 bg-primary-50 rounded-full"><Share2 size={16} /><span className="text-xs">Compartir</span></button>)}</div>
            {userBookings.filter(b => b.shift).length > 0 ? (
              <ul className="space-y-4">
                {userBookings.filter(b => b.shift).map(booking => {
                  const role = roles.find(r => r.id === booking.shift?.roleId);
                  return (
                    <li key={booking.id} className="bg-white p-4 rounded-lg shadow-sm border border-fs-border">
                      <div className="flex justify-between mb-2">
                        <div className="flex flex-col items-start">
                          <span className="font-bold text-fs-text">{booking.shift?.role.name}</span>
                          {role && (
                            <button onClick={() => setSelectedRole(role)} className="text-fs-blue text-xs font-medium hover:underline mt-0.5">
                              Ver detalle
                            </button>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full h-fit ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : booking.status === 'pending_approval' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {booking.status === 'confirmed' ? 'Confirmado' : booking.status === 'pending_approval' ? 'Pendiente Aprobación' : 'Pendiente'}
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
                        <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                          <strong>Coordinador(es):</strong>
                          {booking.shift?.id && coordinatorsMap[booking.shift.id] && coordinatorsMap[booking.shift.id].length > 0 ? (
                            <ul className="mt-1 space-y-1">
                              {coordinatorsMap[booking.shift.id].map(c => (
                                <li key={c.id}>
                                  <div className="font-semibold">{c.fullName}</div>
                                  <div>{c.email}</div>
                                  <div>{c.phone}</div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="mt-1 text-gray-400 italic">No asignado</div>
                          )}
                        </div>
                      )}

                      {booking.status === 'confirmed' && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleAddToCalendar(booking)}
                            className="flex-1 py-2 text-center text-primary-600 border border-primary-200 rounded hover:bg-primary-50 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <CalendarIcon size={16} />
                            Agregar a Calendario
                          </button>
                          <button
                            onClick={() => handleCancellationRequest(booking.id)}
                            className="flex-1 py-2 text-center text-red-600 border border-red-200 rounded hover:bg-red-50 text-sm font-medium transition-colors"
                          >
                            Solicitar Baja
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (<div className="text-center py-12 px-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200"><p className="text-gray-500 text-sm mb-4">No tienes turnos agendados aún.</p><button onClick={() => setActiveTab('shifts')} className="text-primary-600 font-bold text-sm">Explorar turnos</button></div>)}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe pt-2 px-6 flex justify-around items-center z-50 lg:hidden">
        <button onClick={() => setActiveTab('shifts')} className={`flex flex-col items-center p-2 ${activeTab === 'shifts' ? 'text-primary-600' : 'text-gray-400'}`}><CalendarIcon size={24} /><span className="text-[10px] font-bold mt-1">Turnos</span></button>
        <button onClick={() => setActiveTab('bookings')} className={`flex flex-col items-center p-2 ${activeTab === 'bookings' ? 'text-primary-600' : 'text-gray-400'}`}><CheckCircle2 size={24} /><span className="text-[10px] font-bold mt-1">Mis Turnos</span></button>
      </div>

      <div className="hidden lg:grid grid-cols-12 gap-8 items-start px-12 mt-8">
        <div className="col-span-4 space-y-6">
          {renderCalendar()}
          <button onClick={() => setShowEventModal(true)} className="w-full flex items-center justify-center px-4 py-3 bg-white border border-fs-border rounded-lg shadow-sm hover:border-primary-300 transition-all text-fs-blue font-medium"><Info size={20} className="mr-2" />Ver detalles del evento</button>
          <div className="bg-white p-5 rounded-lg shadow-card border border-fs-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-lg text-fs-text">Mis Inscripciones</h3>
              {userBookings.filter(b => b.shift).length > 0 && (
                <button
                  onClick={() => setShowSummaryModal(true)}
                  className="flex items-center gap-1 text-sm font-medium text-primary-600 px-3 py-1.5 bg-primary-50 hover:bg-primary-100 rounded-full transition-colors"
                >
                  <Share2 size={16} />
                  <span className="text-xs">Compartir</span>
                </button>
              )}
            </div>
            {userBookings.filter(b => b.shift).length > 0 ? (
              <ul className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {userBookings.filter(b => b.shift).map(booking => {
                  const role = roles.find(r => r.id === booking.shift?.roleId);
                  return (
                    <li key={booking.id} className="group p-3 rounded-fs border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm hover:border-gray-200 transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-fs-text text-sm">{booking.shift?.role.name}</p>
                          {role && (
                            <button onClick={() => setSelectedRole(role)} className="text-fs-blue text-xs font-medium hover:underline block mb-1">
                              Ver detalle
                            </button>
                          )}
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <CalendarIcon size={12} className="mr-1" />
                            <span className="capitalize mr-2">
                              {booking.shift?.date ? parseLocalDate(booking.shift.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'N/A'}
                            </span>
                            <Clock size={12} className="mr-1" />
                            <span>{booking.shift?.timeSlot}</span>
                          </div>

                          {booking.status === 'confirmed' && (
                            <div className="mt-2 text-xs bg-white p-2 border border-gray-100 rounded">
                              <span className="font-semibold text-gray-600 block mb-1">Coordinador:</span>
                              {booking.shift?.id && coordinatorsMap[booking.shift.id] && coordinatorsMap[booking.shift.id].length > 0 ? (
                                coordinatorsMap[booking.shift.id].map(c => (
                                  <div key={c.id} className="mb-1 last:mb-0">
                                    <div className="font-medium text-gray-800">{c.fullName}</div>
                                    <div className="text-gray-500 text-[10px]">{c.email} | {c.phone}</div>
                                  </div>
                                ))
                              ) : <span className="text-gray-400 italic">No asignado</span>}
                            </div>
                          )}
                        </div>
                        {booking.status === 'confirmed' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleAddToCalendar(booking)}
                              className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                              title="Agregar a Google Calendar"
                            >
                              <CalendarIcon size={16} />
                            </button>
                            <button
                              onClick={() => handleCancellationRequest(booking.id)}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Solicitar baja del turno"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      {booking.status === 'cancellation_requested' && (
                        <div className="mt-2 bg-yellow-50 text-yellow-800 text-xs px-2 py-1.5 rounded-fs inline-flex items-center w-full border border-yellow-100">
                          <AlertTriangle size={12} className="mr-1.5" /> Solicitud pendiente
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (<div className="text-center py-10 bg-gray-50 rounded-fs border border-dashed border-gray-200"><p className="text-sm text-gray-500">No tienes turnos agendados aún.</p></div>)}
          </div>
        </div>

        <div className="col-span-8">
          <div className="mb-6">
            <h2 className="text-2xl font-serif text-fs-text">Turnos Disponibles</h2>
            <p className="text-fs-meta mt-1">{selectedDate?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} | {event?.nombre}</p>
          </div>
          {isLoading ? (
            <div className="text-center p-24 bg-white rounded-lg border border-fs-border shadow-sm"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-primary-500 mx-auto mb-4"></div><p className="text-gray-500">Actualizando disponibilidad...</p></div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedShifts).sort().map(([timeSlot, shiftsInSlot]: [string, Shift[]]) => shiftsInSlot.length > 0 && (
                <div key={timeSlot} className="animate-fade-in"><div className="flex items-center mb-3"><div className="bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-sm font-bold flex items-center border border-primary-100"><Clock size={16} className="mr-2" />{timeSlot} hs</div><div className="h-px bg-gray-200 flex-grow ml-4"></div></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {shiftsInSlot.map(shift => {
                      const role = roles.find(r => r.id === shift.roleId);
                      const isFull = shift.availableVacancies <= 0;
                      const isAlreadyBooked = userBookings.some(b => b.shiftId === shift.id && b.status !== 'cancelled');
                      return (
                        <div key={shift.id} className={`bg-white border rounded-lg p-5 flex flex-col ${isAlreadyBooked ? 'border-primary-200 ring-1 ring-primary-100' : 'border-fs-border shadow-card'}`}>
                          <h4 className="font-bold text-base text-fs-text mb-2">{role?.name}</h4>
                          <p className="text-sm text-gray-600 line-clamp-2">{role?.description}</p>
                          <button onClick={() => role && setSelectedRole(role)} className="text-xs text-primary-600 font-bold hover:underline mb-4 mt-1 block w-fit">Mas Detalles</button>
                          <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                            <div><span className="text-[11px] uppercase font-bold text-gray-400 block">Vacantes</span><span className={`text-lg font-bold ${shift.availableVacancies > 3 ? 'text-gray-700' : 'text-orange-600'}`}>{shift.availableVacancies}</span><span className="text-xs text-gray-400 ml-1">/ {shift.totalVacancies}</span></div>
                            {isAlreadyBooked ? (<div className="text-primary-600 font-bold text-sm bg-primary-50 px-3 py-2 rounded-fs flex items-center"><CheckCircle2 size={18} className="mr-2" />Inscripto</div>
                            ) : (<button onClick={() => handleSignUp(shift.id)} disabled={isFull || isBooking} className={`px-4 py-2 rounded-fs text-sm font-bold ${isFull ? 'bg-gray-100 text-gray-400' : 'bg-primary-500 text-white hover:bg-primary-600'}`}>{isFull ? 'Completo' : 'Inscribirme'}</button>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VolunteerPortal;