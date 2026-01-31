import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Shift, Role, Booking } from '../types';
import { mockApi } from '../services/mockApiService';
import { ChevronLeft, ChevronRight, Clock, AlertTriangle, Calendar as CalendarIcon, MapPin, CheckCircle2, Plus, Info, Mail, Phone, Shield, Share2, Copy, Download, X } from 'lucide-react';
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

          // Set initial dates based on event
          // If first shift date exists, jump to it. Else event start.
          // Adjust for timezone if needed, but for now assume string is enough
          // Actually, let's just use the string date components to avoid timezone shifts on 'new Date()'
          const [y, m, d] = eventData.fechaInicio.split('-').map(Number);
          const startDate = new Date(y, m - 1, d);

          let initialDate = startDate;
          if (dates.length > 0) {
            const firstShift = dates.sort()[0]; // dates are strings YYYY-MM-DD
            const [sy, sm, sd] = firstShift.split('-').map(Number);
            const firstShiftDate = new Date(sy, sm - 1, sd);
            // If first shift is after start date (or whatever), we might want to default to it
            // to avoid showing empty list.
            initialDate = firstShiftDate;
          } else {
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

      // Use eventId if available, otherwise default to event_1 (legacy behavior)
      const targetEventId = eventId || 'event_1';
      const fetchedShifts = await mockApi.getShiftsForDate(targetEventId, dateString);

      // Only update state if this is still the most recent request
      if (lastRequestedDateRef.current === dateString) {
        setShifts(fetchedShifts);
      } else {
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

  // Helper date parsing (duplicated from Coord for safety)
  const parseLocalDate = (dateString: string) => {
    const [y, m, d] = dateString.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const [coordinatorsMap, setCoordinatorsMap] = useState<Record<string, User[]>>({});

  const fetchUserBookings = useCallback(async () => {
    try {
      const bookings = await mockApi.getUserBookings(user.id);
      setUserBookings(bookings);

      // Collect shift IDs from current user bookings
      const myShiftIds = bookings
        .filter(b => b.status !== 'cancelled' && b.shift?.id)
        .map(b => b.shift!.id);

      if (myShiftIds.length > 0) {

        // 1. Fetch Explicit Coordinators (from shift.coordinatorIds)
        const coordinatorIds = new Set<string>();
        bookings.forEach(b => {
          b.shift?.coordinatorIds?.forEach(id => coordinatorIds.add(id));
        });


        const usersFromAssignment = await (coordinatorIds.size > 0
          ? mockApi.getUsersByIds(Array.from(coordinatorIds))
          : Promise.resolve([]));


        // 2. Fetch "Coordinator Role" Bookings for these shifts
        const shiftBookings = await mockApi.getBookingsForShifts(myShiftIds);

        const usersFromBookings = shiftBookings
          .filter(b => {
            const roleName = b.shift?.role?.name;
            const isCoordinator = roleName?.toLowerCase().includes('coordinador');
            return isCoordinator;
          })
          .map(b => ({ ...b.user!, shiftId: b.shiftId }));


        // Merge results into map
        const map: Record<string, User[]> = {};

        bookings.forEach(myBooking => {
          if (!myBooking.shift) return;
          const shiftId = myBooking.shift.id;

          // Start with empty list
          const shiftCoords: User[] = [];

          // Add assigned
          if (myBooking.shift.coordinatorIds) {
            const assigned = usersFromAssignment.filter(u => myBooking.shift!.coordinatorIds.includes(u.id));
            shiftCoords.push(...assigned);
          } else {
          }

          // Add booked coordinators for this shift
          const booked = usersFromBookings
            .filter(ub => ub.shiftId === shiftId && ub.id)
            .map(ub => ({ ...ub, shiftId: undefined }));


          // Merge and dedup by ID
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

    // Only fetch shifts if event is loaded AND we have a valid selected date
    if (event && selectedDate) {
      fetchShifts(selectedDate);
    } else {
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
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + amount);
      return newDate;
    });
  };

  const handleSignUp = async (shiftId: string) => {
    // Find role to check if approval is needed
    const shift = shifts.find(s => s.id === shiftId);

    // Check for concurrent bookings
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

        if (selectedDate) {
          fetchShifts(selectedDate);
        }
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
    const visibleRoles = roles.filter(r => r.isVisible !== false); // Default true if undefined

    shifts.forEach(shift => {
      // Check if role is visible
      const role = visibleRoles.find(r => r.id === shift.roleId);
      if (!role) return; // Skip if role not found or not visible

      if (!groups[shift.timeSlot]) {
        groups[shift.timeSlot] = [];
      }
      groups[shift.timeSlot].push(shift);
    });
    return groups;
  }, [shifts, roles]);

  // Helper to parse date string "YYYY-MM-DD" to local Date object
  // Removed duplicate definition

  const renderCalendar = () => {
    // Guard: Don't render if dates aren't loaded yet
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

            const isBooked = userBookings.some(b => {
              if (!b.shift?.date) return false;
              const bookingDate = parseLocalDate(b.shift.date);
              return bookingDate.toDateString() === date.toDateString();
            });

            let classes = "w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm font-medium transition-colors relative ";
            if (isInEvent) {
              if (isSelected) {
                classes += "bg-primary-500 text-white shadow-sm ";
              } else if (isBooked) {
                classes += "bg-primary-100 text-primary-700 ring-1 ring-primary-200 ";
              } else if (hasShifts) {
                classes += "text-fs-text font-bold bg-gray-100 hover:bg-gray-200 cursor-pointer ";
              } else {
                classes += "text-fs-text hover:bg-gray-50 cursor-pointer opacity-60 ";
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
    // Guard: Don't render if dates aren't loaded yet
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

    // Auto-scroll to selected date logic moved to top level hooks

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

  const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Desconocido';

  const generateSummaryText = () => {
    let text = `*Resumen de Asignaciones - ${event?.nombre || 'Evento'}*\n\n`;
    text += `📍 Ubicación: ${event?.ubicacion || 'No especificada'}\n`;
    if (event) {
      text += `📅 Fechas: ${new Date(event.fechaInicio + 'T00:00:00').toLocaleDateString()} - ${new Date(event.fechaFin + 'T00:00:00').toLocaleDateString()}\n`;
      const eventUrl = event.slug ? `${window.location.origin}/#/${event.slug}` : window.location.href;
      text += `🔗 Link Evento: ${eventUrl}\n\n`;
    }

    text += `*Mis Turnos:*\n`;
    const activeBookings = userBookings.filter(b => b.status !== 'cancelled' && b.shift);
    if (activeBookings.length === 0) {
      text += "No tienes turnos registrados.\n";
    } else {
      activeBookings.forEach(booking => {
        const date = booking.shift.date ? new Date(booking.shift.date + 'T12:00:00').toLocaleDateString() : 'N/A';
        const roleName = booking.shift.role?.name || 'Rol';
        text += `- ${date} ${booking.shift.timeSlot} (${roleName}) - ${booking.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}\n`;

        // Add coordinator info if available
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

    // Parse date and times
    const dateStr = shift.date;
    const [startHour, startMin] = startTime.split(':');
    const [endHour, endMin] = endTime.split(':');

    // Create date objects in local timezone
    const startDate = new Date(`${dateStr}T${startHour}:${startMin}:00`);
    const endDate = new Date(`${dateStr}T${endHour}:${endMin}:00`);

    // Format for Google Calendar (YYYYMMDDTHHmmss)
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

    // Build description with coordinator info
    let description = `Voluntariado - ${event.nombre}\n\n`;
    description += `Rol: ${shift.role?.name || 'Voluntario'}\n`;
    description += `Estado: ${booking.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}\n\n`;

    if (shift.id && coordinatorsMap[shift.id] && coordinatorsMap[shift.id].length > 0) {
      description += `Coordinador(es):\n`;
      coordinatorsMap[shift.id].forEach(c => {
        description += `- ${c.fullName}\n  📧 ${c.email}\n  📱 ${c.phone}\n`;
      });
      description += '\n';
    }

    description += `Contacto Admin: ${event.contactEmail || 'admin@evento.com'}`;

    const title = `${event.nombre} - ${shift.role?.name || 'Voluntariado'}`;
    const location = event.ubicacion || '';

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startFormatted}/${endFormatted}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;

    window.open(googleCalendarUrl, '_blank');
  };

  const handleShareWhatsApp = () => {
    const text = generateSummaryText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleShareEmail = () => {
    const text = generateSummaryText();
    const subject = `Resumen Voluntariado - ${event?.nombre || ''}`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.href = url;
  };

  const handleCopyToClipboard = () => {
    const text = generateSummaryText();
    navigator.clipboard.writeText(text);
    toast.success('Resumen copiado al portapapeles');
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFillColor(243, 244, 246); // gray-100
    doc.rect(0, 0, 210, 40, 'F');

    doc.setFontSize(22);
    doc.setTextColor(17, 24, 39); // gray-900
    doc.text("Resumen de Asignaciones", 14, 25);

    let yPos = 55;

    // Event Details
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55); // gray-800
    doc.text(event?.nombre || 'Evento', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99); // gray-600
    doc.text(`Ubicación: ${event?.ubicacion || 'No especificada'}`, 14, yPos);
    yPos += 6;

    if (event) {
      doc.text(`Fechas: ${new Date(event.fechaInicio + 'T00:00:00').toLocaleDateString()} - ${new Date(event.fechaFin + 'T00:00:00').toLocaleDateString()}`, 14, yPos);
      yPos += 12;
    } else {
      yPos += 12;
    }

    // Admin Contact Box
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setFillColor(249, 250, 251); // gray-50
    doc.roundedRect(14, yPos - 5, 182, 28, 3, 3, 'FD');

    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text("Contacto Administradores", 20, yPos + 3);

    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(`Email: ${event?.contactEmail || 'admin@evento.com'}`, 20, yPos + 10);

    yPos += 35;

    // Table
    const tableColumn = ["Fecha", "Horario", "Rol", "Coordinador", "Estado"];
    const activeBookings = userBookings.filter(b => b.status !== 'cancelled' && b.shift);
    const tableRows = activeBookings.map(booking => {
      const coords = booking.shift?.id && coordinatorsMap[booking.shift.id]
        ? coordinatorsMap[booking.shift.id].map(c => `${c.fullName} (${c.phone})`).join(', ')
        : 'No asignado';

      return [
        booking.shift.date ? new Date(booking.shift.date + 'T12:00:00').toLocaleDateString() : 'N/A',
        booking.shift.timeSlot,
        booking.shift.role?.name || 'Rol',
        coords,
        booking.status === 'confirmed' ? 'Confirmado' : 'Pendiente'
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 2
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      columnStyles: {
        3: { cellWidth: 50 } // Coordinator column wider
      }
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Generado el ${new Date().toLocaleDateString()} - Sistema de Voluntariado`, 14, pageHeight - 10);

    doc.save(`resumen_voluntariado_${event?.slug || 'evento'}.pdf`);
    toast.success('PDF descargado correctamente');
  };

  return (
    <div className="pb-24 lg:pb-12">
      {selectedRole && <RoleDetailModal role={selectedRole} onClose={() => setSelectedRole(null)} />}

      {/* Modal de Resumen y Compartir */}
      <Modal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        title="Resumen de Asignaciones"
      >
        <div className="space-y-6">
          <div className="bg-primary-50 p-4 rounded-lg border border-primary-100">
            <h4 className="font-bold text-lg text-primary-900 mb-2">{event?.nombre}</h4>
            <div className="text-sm text-primary-800 space-y-1">
              <div className="flex items-center gap-2">
                <MapPin size={16} />
                <span>{event?.ubicacion || "Ubicación no especificada"}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarIcon size={16} />
                <span>{event ? `${new Date(event.fechaInicio + 'T00:00:00').toLocaleDateString()} - ${new Date(event.fechaFin + 'T00:00:00').toLocaleDateString()}` : "Fechas no disponibles"}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-primary-200">
              <p className="font-semibold text-sm text-primary-900 mb-2">Contacto Administradores:</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-primary-800">
                  <Mail size={14} />
                  <span>{event?.contactEmail || 'admin@evento.com'}</span>
                </div>

              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 mb-3 flex items-center justify-between">
              <span>Mis Turnos Activos</span>
              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {userBookings.filter(b => b.status !== 'cancelled' && b.shift).length} asignados
              </span>
            </h4>
            {userBookings.filter(b => b.status !== 'cancelled' && b.shift).length > 0 ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <ul className="divide-y divide-gray-100">
                  {userBookings.filter(b => b.status !== 'cancelled' && b.shift).map(booking => (
                    <li key={booking.id} className="p-3 bg-white hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-gray-900 text-sm">{booking.shift?.role?.name || 'Sin rol'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide
                                        ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {booking.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <CalendarIcon size={12} />
                          {booking.shift?.date ? new Date(booking.shift.date + 'T12:00:00').toLocaleDateString() : 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {booking.shift?.timeSlot || 'N/A'}
                        </span>
                      </div>
                      {booking.status === 'confirmed' && booking.shift?.id && coordinatorsMap[booking.shift.id] && coordinatorsMap[booking.shift.id].length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-[10px] font-semibold text-gray-600 mb-1">Coordinador(es):</p>
                          <div className="space-y-1">
                            {coordinatorsMap[booking.shift.id].map(c => (
                              <div key={c.id} className="text-[10px] text-gray-600">
                                <div className="font-medium">{c.fullName}</div>
                                <div className="flex items-center gap-2">
                                  <span>{c.email}</span>
                                  <span>•</span>
                                  <span>{c.phone}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <p className="text-gray-500 text-sm italic">No tienes turnos activos.</p>
                <p className="text-gray-400 text-xs mt-1">Selecciona una fecha en el calendario para ver los turnos disponibles.</p>
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <h4 className="font-bold text-gray-900 text-sm mb-1">Compartir copia de respaldo</h4>
            <p className="text-xs text-gray-500 mb-4">Envía este resumen a tu dispositivo para tener los datos de acceso siempre a mano.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={handleShareWhatsApp}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:brightness-105 transition-all text-sm font-bold shadow-sm"
              >
                <Share2 size={16} />
                WhatsApp
              </button>
              <button
                onClick={handleShareEmail}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-bold shadow-sm"
              >
                <Mail size={16} />
                Email
              </button>
              <button
                onClick={handleCopyToClipboard}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm font-bold shadow-sm"
              >
                <Copy size={16} />
                Copiar
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={handleDownloadPDF}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-black transition-all text-sm font-bold shadow-lg"
              >
                <Download size={18} />
                Descargar PDF
              </button>
              <p className="text-[10px] text-center text-gray-400 mt-2">Descarga un archivo PDF oficial con el membrete del evento.</p>
            </div>
          </div>
        </div>
      </Modal>

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
                <span>{event?.contactEmail || 'admin@evento.com'}</span>
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
                                <div className="flex items-center">
                                  <h4 className="font-bold text-fs-text mr-2">{role?.name}</h4>
                                  {isAlreadyBooked && <CheckCircle2 size={18} className="text-primary-600 shrink-0" />}
                                </div>
                                {role?.youtubeUrl && (
                                  <button
                                    onClick={() => setSelectedRole(role)}
                                    className="text-fs-blue text-xs font-medium shrink-0"
                                  >
                                    Ver detalle
                                  </button>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{role?.description}</p>

                              {role?.requiresApproval && (
                                <div className="mb-3">
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                                    <Shield size={12} className="mr-1" />
                                    Requiere Aprobación Admin
                                  </span>
                                </div>
                              )}

                              <div className="flex justify-between items-center">
                                <div className="text-xs text-gray-500">
                                  <span className={`font-bold text-sm ${shift.availableVacancies < 3 ? 'text-orange-600' : 'text-gray-700'}`}>{shift.availableVacancies}</span> vacantes
                                </div>
                                {isAlreadyBooked ? (
                                  userBookings.find(b => b.shiftId === shift.id && b.status === 'pending_approval') ? (
                                    <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded">Pendiente</span>
                                  ) : (
                                    <span className="text-xs font-bold text-primary-700 bg-primary-100 px-2 py-1 rounded">Inscripto</span>
                                  )
                                ) : (
                                  <button
                                    onClick={() => handleSignUp(shift.id)}
                                    disabled={isFull}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${isFull ? 'bg-gray-100 text-gray-400' : 'bg-primary-500 text-white'}`}
                                  >
                                    {isFull ? 'Lleno' : (role?.requiresApproval ? 'Postularme' : 'Inscribirme')}
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-serif text-fs-text">Mis Inscripciones</h2>
              {userBookings.filter(b => b.shift).length > 0 && (
                <button
                  onClick={() => setShowSummaryModal(true)}
                  className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 px-3 py-1.5 bg-primary-50 rounded-full"
                >
                  <Share2 size={16} />
                  <span className="text-xs">Compartir</span>
                </button>
              )}
            </div>
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
              {userBookings.filter(b => b.shift).length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] text-white font-bold">
                  {userBookings.filter(b => b.shift).length}
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
            <div className="flex items-center justify-between mb-4 border-b border-fs-border pb-2">
              <h3 className="font-serif text-lg text-fs-text">Mis Inscripciones</h3>
              {userBookings.filter(b => b.shift).length > 0 && (
                <button
                  onClick={() => setShowSummaryModal(true)}
                  className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-colors"
                  title="Compartir resumen"
                >
                  <Share2 size={18} />
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
                            {/* Fix: Use parseLocalDate to display correct date */}
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
              <span className="font-medium text-gray-800">{selectedDate ? selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Cargando...'}</span>
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

                            {role?.requiresApproval && (
                              <div className="mb-4">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                                  <Shield size={14} className="mr-1.5" />
                                  Requiere Aprobación del Administrador
                                </span>
                              </div>
                            )}

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
                                userBookings.find(b => b.shiftId === shift.id && b.status === 'pending_approval') ? (
                                  <div className="flex items-center text-orange-600 font-bold text-sm bg-orange-50 px-3 py-2 rounded-fs">
                                    <AlertTriangle size={18} className="mr-2" />
                                    Pendiente
                                  </div>
                                ) : (
                                  <div className="flex items-center text-primary-600 font-bold text-sm bg-primary-50 px-3 py-2 rounded-fs">
                                    <CheckCircle2 size={18} className="mr-2" />
                                    Inscripto
                                  </div>
                                )
                              ) : (
                                <button
                                  onClick={() => handleSignUp(shift.id)}
                                  disabled={isFull || isBooking}
                                  className={`flex items-center px-4 py-2 rounded-fs text-sm font-bold transition-colors ${isFull || isBooking
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-primary-500 text-white hover:bg-primary-600 shadow-sm'
                                    }`}
                                >
                                  {isFull
                                    ? 'Completo'
                                    : (isBooking
                                      ? <div className="flex items-center"><div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-500 mr-2"></div></div>
                                      : <>{role?.requiresApproval ? <Shield size={16} className="mr-1.5" /> : <Plus size={16} className="mr-1.5" />} {role?.requiresApproval ? 'Postularme' : 'Inscribirme'}</>
                                    )
                                  }
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