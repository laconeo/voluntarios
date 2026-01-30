import React, { useState, useEffect } from 'react';
import { supabaseApi as mockApi } from '../services/supabaseApiService';
import type { User, Event, Shift, Booking, Role } from '../types';
import { Download, CheckCircle, XCircle, Clock, Calendar, Search, Printer, Share2, FileText, MoreVertical, ChevronUp, ChevronDown, Utensils } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-hot-toast';

interface CoordinatorDashboardProps {
    user: User;
    onLogout: () => void;
}

const CoordinatorDashboard: React.FC<CoordinatorDashboardProps> = ({ user, onLogout }) => {
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('all');
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const allEvents = await mockApi.getAllEvents();

                const userBookings = await mockApi.getUserBookings(user.id);
                const coordinatorBookingEventIds = userBookings
                    .filter(b => b.status === 'confirmed' && b.shift?.role?.requiresApproval)
                    .map(b => b.eventId);

                // Filter events where the user is a coordinator (via shift assignment or booking)
                const coordinatorEvents: Event[] = [];
                for (const event of allEvents) {
                    const eventShifts = await mockApi.getShiftsByEvent(event.id);
                    if (eventShifts.some(s => s.coordinatorIds.includes(user.id)) || coordinatorBookingEventIds.includes(event.id)) {
                        coordinatorEvents.push(event);
                    }
                }

                setEvents(coordinatorEvents);
                if (coordinatorEvents.length > 0) {
                    setSelectedEventId(coordinatorEvents[0].id);
                }
                const allRoles = await mockApi.getAllRoles();
                setRoles(allRoles);
            } catch (error) {
                toast.error('Error al cargar datos iniciales');
            } finally {
                setIsLoading(false);
            }
        };
        loadInitialData();
    }, [user.id]);

    useEffect(() => {
        if (selectedEventId) {
            loadEventData(selectedEventId);
            setSelectedTimeSlot('all'); // Reset time slot selection when event changes
        }
    }, [selectedEventId]);

    const loadEventData = async (eventId: string) => {
        setIsLoading(true);
        try {
            const eventShifts = await mockApi.getShiftsByEvent(eventId);

            const userBookings = await mockApi.getUserBookings(user.id, eventId);
            const coordinatorBookingShiftIds = userBookings
                .filter(b => b.status === 'confirmed' && b.shift?.role?.requiresApproval)
                .map(b => b.shiftId);

            // Filtrar turnos asignados directamente (donde es coordinador)
            const assignedShifts = eventShifts.filter(shift =>
                shift.coordinatorIds.includes(user.id) || coordinatorBookingShiftIds.includes(shift.id)
            );

            // Expandir visibilidad: incluir TODOS los turnos que ocurren en la misma fecha y hora que mis turnos asignados
            // Esto permite ver a voluntarios de otros roles (ej: Limpieza) si yo soy Coordinador en ese horario
            const visibleShifts = new Set<string>();

            assignedShifts.forEach(coordShift => {
                visibleShifts.add(coordShift.id);
                // Buscar concurrentes
                eventShifts.forEach(otherShift => {
                    if (otherShift.date === coordShift.date && otherShift.timeSlot === coordShift.timeSlot) {
                        visibleShifts.add(otherShift.id);
                    }
                });
            });

            const myShifts = eventShifts.filter(s => visibleShifts.has(s.id));

            // Sort shifts by date and time
            myShifts.sort((a, b) => {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
                return a.timeSlot.localeCompare(b.timeSlot);
            });
            setShifts(myShifts);

            const eventBookings = await mockApi.getBookingsByEvent(eventId);
            // Enrich bookings with user data
            const enrichedBookings = await Promise.all(eventBookings.map(async (booking) => {
                const user = await mockApi.getUserById(booking.userId);
                return { ...booking, user };
            }));
            setBookings(enrichedBookings);
        } catch (error) {
            toast.error('Error al cargar datos del evento');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAttendanceChange = async (bookingId: string, status: 'attended' | 'absent' | 'pending') => {
        // Optimistic update
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, attendance: status } : b));

        try {
            await mockApi.updateBookingAttendance(bookingId, status);
            toast.success('Asistencia actualizada');
        } catch (error) {
            // Revert on error (optional, but good practice)
            // For now, we just notify. To revert, we'd need the previous state.
            toast.error('Error al actualizar asistencia');
            console.error(error);
        }
    };

    const handleFoodStatusChange = async (bookingId: string, currentStatus: boolean | undefined) => {
        const newStatus = !currentStatus;
        // Optimistic update
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, foodDelivered: newStatus } : b));

        try {
            await mockApi.updateBookingFoodStatus(bookingId, newStatus);
            if (newStatus) toast.success('Vianda entregada');
        } catch (error) {
            toast.error('Error al actualizar vianda');
            console.error(error);
            // Revert
            setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, foodDelivered: currentStatus } : b));
        }
    };

    const exportToCSV = () => {
        const headers = ['Fecha', 'Horario', 'Rol', 'Nombre', 'DNI', 'Email', 'Teléfono', 'Estado', 'Vianda', 'Asistencia'];
        const csvRows = [headers.join(',')];

        filteredShifts.forEach(shift => {
            const shiftBookings = bookings.filter(b => b.shiftId === shift.id && b.status === 'confirmed');
            const role = roles.find(r => r.id === shift.roleId);

            shiftBookings.forEach(booking => {
                const row = [
                    shift.date,
                    shift.timeSlot,
                    role?.name || 'Desconocido',
                    booking.user?.fullName || '',
                    booking.user?.dni || '',
                    booking.user?.email || '',
                    booking.user?.phone || '',
                    booking.status,
                    booking.foodDelivered ? 'Si' : 'No',
                    booking.attendance || 'Pendiente'
                ];
                csvRows.push(row.map(field => `"${field}"`).join(','));
            });
        });

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `asistencia_evento_${selectedEventId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper robusto para fechas
    const parseDateHelper = (dateString: string) => {
        if (!dateString) return new Date();
        const cleanDate = dateString.split('T')[0];
        const [y, m, d] = cleanDate.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const eventName = events.find(e => e.id === selectedEventId)?.nombre || 'Evento';

        doc.setFillColor(243, 244, 246);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setFontSize(16);
        doc.setTextColor(17, 24, 39);
        doc.text("Planilla de Asistencia", 14, 15);

        doc.setFontSize(10);
        doc.setTextColor(55, 65, 81);
        doc.text(`Evento: ${eventName} | Coordinador: ${user.fullName}`, 14, 23);

        let yPos = 35;

        // Process each group of shifts as a section
        sortedGroups.forEach(group => {
            // Gather bookings for this group
            const groupBookings = group.shifts.flatMap(s =>
                bookings.filter(b => b.shiftId === s.id && b.status === 'confirmed').map(b => ({ ...b, roleName: getRoleName(s.roleId) }))
            );

            if (groupBookings.length === 0) return;

            // Section Header
            if (yPos > 270) { doc.addPage(); yPos = 20; }

            const localDate = parseDateHelper(group.date);
            const dateStr = localDate.toLocaleDateString();
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.setFillColor(229, 231, 235);
            doc.rect(14, yPos - 5, 182, 8, 'F');
            doc.text(`${dateStr} - ${group.timeSlot} (${groupBookings.length} voluntarios)`, 16, yPos);
            yPos += 8;

            // Table
            const tableColumn = ["Nombre", "DNI", "Rol", "Vianda", "Asistencia"];
            const tableRows = groupBookings.map(b => [
                b.user?.fullName || '',
                b.user?.dni || '',
                b.roleName || '',
                b.foodDelivered ? 'Si' : '',
                b.attendance === 'attended' ? 'Presente' : (b.attendance === 'absent' ? 'Ausente' : '')
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [tableColumn],
                body: tableRows,
                theme: 'grid', // 'striped', 'grid', 'plain'
                headStyles: { fillColor: [79, 70, 229], textColor: 255 },
                styles: { fontSize: 9, cellPadding: 2 },
                // @ts-ignore
                didDrawPage: (data) => {
                    // @ts-ignore
                    yPos = data.cursor.y;
                }
            });
            // @ts-ignore
            yPos = doc.lastAutoTable.finalY + 10;
        });

        doc.save(`planilla_asistencia_${selectedEventId}.pdf`);
        toast.success("PDF de asistencia descargado");
    };

    const handleShareWhatsApp = () => {
        const eventName = events.find(e => e.id === selectedEventId)?.nombre || 'Evento';
        let text = `*Listado de Voluntarios - ${eventName}*\n`;
        text += `Coordinador: ${user.fullName}\n\n`;

        sortedGroups.forEach(group => {
            const groupBookings = group.shifts.flatMap(s => bookings.filter(b => b.shiftId === s.id && b.status === 'confirmed'));
            if (groupBookings.length === 0) return;

            const localDate = parseDateHelper(group.date);
            const dateStr = localDate.toLocaleDateString();
            text += `*📅 ${dateStr} - ${group.timeSlot}*\n`;

            groupBookings.forEach(b => {
                text += `- ${b.user?.fullName} (${b.user?.phone || 'Sin tel'})\n`;
            });
            text += '\n';
        });

        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const handlePrint = () => {
        window.print();
    };

    const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Desconocido';

    const filteredShifts = shifts.filter(shift => {
        // Filter by selected time slot
        if (selectedTimeSlot !== 'all') {
            const [date, time] = selectedTimeSlot.split('|');
            if (shift.date !== date || shift.timeSlot !== time) return false;
        }

        if (!searchTerm) return true;
        const shiftBookings = bookings.filter(b => b.shiftId === shift.id);
        return shiftBookings.some(b =>
            b.user?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.user?.dni.includes(searchTerm)
        );
    });

    // Helper to get unique time slots for dropdown
    const uniqueTimeSlots = Array.from(new Set(shifts.map(s => `${s.date}|${s.timeSlot}`)))
        .sort((a, b) => {
            const [dateA, timeA] = a.split('|');
            const [dateB, timeB] = b.split('|');
            return dateA.localeCompare(dateB) || timeA.localeCompare(timeB);
        });

    // Group shifts by date and time
    const groupedShifts = filteredShifts.reduce((acc, shift) => {
        const key = `${shift.date}-${shift.timeSlot}`;
        if (!acc[key]) {
            acc[key] = {
                date: shift.date,
                timeSlot: shift.timeSlot,
                shifts: []
            };
        }
        acc[key].shifts.push(shift);
        return acc;
    }, {} as Record<string, { date: string, timeSlot: string, shifts: Shift[] }>);

    const sortedGroups = Object.values(groupedShifts).sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.timeSlot.localeCompare(b.timeSlot);
    });

    if (isLoading) return <div className="p-8 text-center">Cargando...</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow print:hidden">
                <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">Panel de Coordinador</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-600">Hola, {user.fullName}</span>
                        <button onClick={onLogout} className="text-sm text-red-600 hover:text-red-800">Cerrar Sesión</button>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 lg:pb-8 pb-32">
                {/* Print Header */}
                <div className="hidden print:block mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Listado de Voluntarios</h1>
                    <div className="flex flex-col gap-1 text-gray-700">
                        <p><span className="font-semibold">Evento:</span> {events.find(e => e.id === selectedEventId)?.nombre}</p>
                        <p><span className="font-semibold">Coordinador:</span> {user.fullName}</p>
                    </div>
                </div>

                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-4">
                        <div className="w-full sm:w-64">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar Evento</label>
                            <select
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white cursor-pointer"
                            >
                                {events.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                            </select>
                        </div>

                        <div className="w-full sm:w-64">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Horario</label>
                            <select
                                value={selectedTimeSlot}
                                onChange={(e) => setSelectedTimeSlot(e.target.value)}
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white cursor-pointer"
                            >
                                <option value="all">Todos los horarios</option>
                                {uniqueTimeSlots.map(slotKey => {
                                    const [date, time] = slotKey.split('|');
                                    const dateStr = parseDateHelper(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                                    return (
                                        <option key={slotKey} value={slotKey}>
                                            {dateStr} - {time}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                        <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={18} className="text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar voluntario..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 w-full"
                            />
                        </div>

                        {/* Desktop Action Buttons - Dropdown */}
                        <div className="hidden lg:relative lg:block">
                            <button
                                onClick={() => setShowActionsMenu(!showActionsMenu)}
                                className="flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm"
                            >
                                Acciones
                                <ChevronDown size={16} className="ml-2" />
                            </button>

                            {showActionsMenu && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                                    <button
                                        onClick={() => { handleShareWhatsApp(); setShowActionsMenu(false); }}
                                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        <Share2 size={16} className="mr-2 text-green-600" />
                                        WhatsApp
                                    </button>
                                    <button
                                        onClick={() => { handleDownloadPDF(); setShowActionsMenu(false); }}
                                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        <FileText size={16} className="mr-2 text-indigo-600" />
                                        Descargar PDF
                                    </button>
                                    <button
                                        onClick={() => { handlePrint(); setShowActionsMenu(false); }}
                                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        <Printer size={16} className="mr-2 text-gray-600" />
                                        Imprimir
                                    </button>
                                    <button
                                        onClick={() => { exportToCSV(); setShowActionsMenu(false); }}
                                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        <Download size={16} className="mr-2 text-green-700" />
                                        Exportar Excel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {sortedGroups.map(group => {
                        // Gather bookings: Show non-cancelled (including pending, waitlist, cancellation_requested)
                        const groupBookings = group.shifts.flatMap(s =>
                            bookings
                                .filter(b => b.shiftId === s.id && b.status !== 'cancelled')
                                .map(b => ({ ...b, roleName: getRoleName(s.roleId) }))
                        );

                        // Calculate total occupied spots based on shift data (from DB) to check consistency
                        const totalOccupied = group.shifts.reduce((acc, s) => acc + (s.totalVacancies - s.availableVacancies), 0);

                        // If searching, filter bookings
                        const displayBookings = searchTerm
                            ? groupBookings.filter(b =>
                                b.user?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                b.user?.dni.includes(searchTerm)
                            )
                            : groupBookings;

                        if (displayBookings.length === 0 && searchTerm) return null;

                        const dateStr = parseDateHelper(group.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });

                        return (
                            <div key={`${group.date}-${group.timeSlot}`} className="mb-6 last:mb-0">
                                {/* Desktop View */}
                                <div className="hidden sm:block bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center text-gray-700 font-medium">
                                                <Calendar size={18} className="mr-2 text-primary-500" />
                                                <span className="capitalize">{parseDateHelper(group.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                            </div>
                                            <div className="flex items-center text-gray-700 font-medium">
                                                <Clock size={18} className="mr-2 text-primary-500" />
                                                {group.timeSlot}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm text-gray-500 block">
                                                {displayBookings.length} voluntarios en lista
                                            </span>
                                            {totalOccupied > displayBookings.length && (
                                                <span className="text-xs text-orange-500 font-medium" title="Hay más vacantes ocupadas en el sistema de las que se muestran aquí. Posibles usuarios con estado desconocido o filtro activo.">
                                                    ⚠️ {totalOccupied} vacantes ocupadas
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {displayBookings.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Voluntario</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vianda</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asistencia</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {displayBookings.map(booking => (
                                                        <tr key={booking.id}>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="text-sm font-medium text-gray-900">{booking.user?.fullName}</div>
                                                                <div className="text-sm text-gray-500">DNI: {booking.user?.dni}</div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                    {booking.roleName}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="text-sm text-gray-900">{booking.user?.email}</div>
                                                                <div className="text-sm text-gray-500">{booking.user?.phone}</div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <button
                                                                    onClick={() => handleFoodStatusChange(booking.id, booking.foodDelivered)}
                                                                    className={`p-1.5 rounded-full transition-colors flex items-center gap-2 ${booking.foodDelivered
                                                                        ? 'bg-orange-100 text-orange-600 ring-2 ring-orange-500'
                                                                        : 'text-gray-400 hover:bg-orange-50 hover:text-orange-500'
                                                                        }`}
                                                                    title={booking.foodDelivered ? 'Vianda entregada' : 'Marcar vianda'}
                                                                >
                                                                    <Utensils size={20} />
                                                                </button>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => handleAttendanceChange(booking.id, 'attended')}
                                                                        className={`p-1 rounded-full transition-colors ${booking.attendance === 'attended'
                                                                            ? 'bg-green-100 text-green-600 ring-2 ring-green-500'
                                                                            : 'text-gray-400 hover:bg-green-50 hover:text-green-500'
                                                                            }`}
                                                                        title="Presente"
                                                                    >
                                                                        <CheckCircle size={24} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleAttendanceChange(booking.id, 'absent')}
                                                                        className={`p-1 rounded-full transition-colors ${booking.attendance === 'absent'
                                                                            ? 'bg-red-100 text-red-600 ring-2 ring-red-500'
                                                                            : 'text-gray-400 hover:bg-red-50 hover:text-red-500'
                                                                            }`}
                                                                        title="Ausente"
                                                                    >
                                                                        <XCircle size={24} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="p-4 text-center text-gray-500 text-sm">
                                            No hay voluntarios en la lista para este horario.
                                            {totalOccupied > 0 && <p className="text-xs text-orange-500 mt-1">Pero el sistema reporta {totalOccupied} vacantes ocupadas. Contacta al admin.</p>}
                                        </div>
                                    )}
                                </div>

                                {/* Mobile View */}
                                <div className="sm:hidden">
                                    <div className="bg-gray-100 rounded-xl p-4 mb-3 shadow-sm border border-gray-200 sticky top-0 z-10 backdrop-blur-md bg-opacity-95">
                                        <div className="flex justify-between items-start mb-1">
                                            <div>
                                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                    <Clock size={16} className="text-primary-600" />
                                                    {group.timeSlot}
                                                </h3>
                                                <p className="text-sm text-gray-600 capitalize">{dateStr}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500 font-medium">
                                                    {displayBookings.length} Voluntarios
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pl-2">
                                        {displayBookings.length > 0 ? (
                                            displayBookings.map(booking => (
                                                <div key={booking.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 relative overflow-hidden">
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${booking.attendance === 'attended' ? 'bg-green-500' : booking.attendance === 'absent' ? 'bg-red-500' : 'bg-gray-200'}`}></div>
                                                    <div className="flex justify-between items-start pl-2 mb-3">
                                                        <div>
                                                            <div className="font-bold text-gray-900">{booking.user?.fullName}</div>
                                                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded border border-blue-100">
                                                                {booking.roleName}
                                                            </span>
                                                        </div>
                                                        <div className="ml-2">
                                                            <button
                                                                onClick={() => handleFoodStatusChange(booking.id, booking.foodDelivered)}
                                                                className={`p-2 rounded-full transition-colors ${booking.foodDelivered
                                                                    ? 'bg-orange-100 text-orange-600 ring-2 ring-orange-500'
                                                                    : 'bg-gray-100 text-gray-400'
                                                                    }`}
                                                                title={booking.foodDelivered ? 'Vianda entregada' : 'Marcar vianda'}
                                                            >
                                                                <Utensils size={20} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="pl-2 grid grid-cols-1 gap-1 mb-4">
                                                        <div className="text-sm text-gray-600 flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-gray-400 uppercase w-12">DNI:</span>
                                                            <span className="font-mono">{booking.user?.dni}</span>
                                                        </div>
                                                        <div className="text-sm text-gray-600 flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-gray-400 uppercase w-12">Email:</span>
                                                            <span className="truncate">{booking.user?.email}</span>
                                                        </div>
                                                        <div className="text-sm text-gray-600 flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-gray-400 uppercase w-12">Tel:</span>
                                                            <span>{booking.user?.phone}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-3 pl-2 mt-4 border-t border-gray-100 pt-3">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleAttendanceChange(booking.id, 'attended'); }}
                                                            className={`flex-1 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${booking.attendance === 'attended'
                                                                ? 'bg-green-600 text-white shadow-green-200'
                                                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-green-50 hover:border-green-300 hover:text-green-700'
                                                                }`}
                                                        >
                                                            <CheckCircle size={18} className={booking.attendance === 'attended' ? 'text-white' : 'text-gray-400'} />
                                                            Presente
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleAttendanceChange(booking.id, 'absent'); }}
                                                            className={`flex-1 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${booking.attendance === 'absent'
                                                                ? 'bg-red-600 text-white shadow-red-200'
                                                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700'
                                                                }`}
                                                        >
                                                            <XCircle size={18} className={booking.attendance === 'absent' ? 'text-white' : 'text-gray-400'} />
                                                            Ausente
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-6 bg-white rounded-xl border border-dashed border-gray-300 text-center text-gray-500 text-sm">
                                                No hay voluntarios confirmados en este turno.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {
                        sortedGroups.length === 0 && !searchTerm && (
                            <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-200">
                                <div className="max-w-md mx-auto px-4">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No tienes turnos asignados</h3>
                                    <p className="text-gray-600 text-sm">
                                        Actualmente no estás asignado como coordinadores en ningún turno de este evento.
                                    </p>
                                </div>
                            </div>
                        )
                    }

                    {
                        sortedGroups.length === 0 && searchTerm && (
                            <div className="text-center py-12 text-gray-500">
                                No se encontraron turnos que coincidan con la búsqueda.
                            </div>
                        )
                    }
                </div >
            </main >

            {/* Fixed Bottom Footer - Mobile Only */}
            {/* Fixed Bottom Footer - Mobile Only */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 print:hidden lg:hidden safe-area-bottom">
                {/* Mobile Menu Dropup */}
                {showMobileMenu && (
                    <div className="border-b border-gray-200 bg-gray-50 animate-in slide-in-from-bottom duration-200">
                        <button
                            onClick={() => { handleDownloadPDF(); setShowMobileMenu(false); }}
                            className="flex items-center w-full px-6 py-4 text-gray-700 hover:bg-gray-100 border-b border-gray-200"
                        >
                            <div className="bg-indigo-100 p-2 rounded-full mr-3">
                                <FileText size={20} className="text-indigo-600" />
                            </div>
                            <span className="font-medium">Descargar PDF de Asistencia</span>
                        </button>
                        <button
                            onClick={() => { exportToCSV(); setShowMobileMenu(false); }}
                            className="flex items-center w-full px-6 py-4 text-gray-700 hover:bg-gray-100"
                        >
                            <div className="bg-green-100 p-2 rounded-full mr-3">
                                <Download size={20} className="text-green-700" />
                            </div>
                            <span className="font-medium">Exportar a Excel</span>
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-3 gap-2 p-2">
                    <button
                        onClick={handleShareWhatsApp}
                        className="flex flex-col items-center justify-center py-2 rounded-lg bg-green-50 text-green-700 active:bg-green-100"
                    >
                        <Share2 size={20} className="mb-1" />
                        <span className="text-[10px] font-medium leading-none">WhatsApp</span>
                    </button>

                    <button
                        onClick={handlePrint}
                        className="flex flex-col items-center justify-center py-2 rounded-lg bg-gray-50 text-gray-700 active:bg-gray-100"
                    >
                        <Printer size={20} className="mb-1" />
                        <span className="text-[10px] font-medium leading-none">Imprimir</span>
                    </button>

                    <button
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                        className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${showMobileMenu ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-700 active:bg-gray-100'}`}
                    >
                        {showMobileMenu ? <ChevronDown size={20} className="mb-1" /> : <ChevronUp size={20} className="mb-1" />}
                        <span className="text-[10px] font-medium leading-none">Más</span>
                    </button>
                </div>

                {/* DEBUG SECTION - REMOVE IN PRODUCTION */}
                <div className="mt-12 p-4 bg-gray-900 text-green-400 rounded-lg text-xs font-mono overflow-auto max-h-96">
                    <h4 className="font-bold text-white mb-2">🔧 DEBUG PANEL</h4>
                    <p>User ID (Me): {user.id}</p>
                    <p>Total Shifts Visible: {shifts.length}</p>
                    <p>Total Bookings Loaded: {bookings.length}</p>
                    <details className="mb-2">
                        <summary className="cursor-pointer text-white underline">Ver Mis Turnos ({shifts.length})</summary>
                        <pre>{JSON.stringify(shifts.map(s => ({ id: s.id, date: s.date, time: s.timeSlot, coords: s.coordinatorIds })), null, 2)}</pre>
                    </details>
                    <details>
                        <summary className="cursor-pointer text-white underline">Ver Reservas ({bookings.length})</summary>
                        <pre>{JSON.stringify(bookings.map(b => ({ id: b.id, shiftId: b.shiftId, userId: b.userId, name: b.user?.fullName, status: b.status })), null, 2)}</pre>
                    </details>
                </div>
            </div>
        </div >
    );
};

export default CoordinatorDashboard;
