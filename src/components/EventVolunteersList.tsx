import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, Download, Mail, Phone, Edit2, X, Save, Eye, CheckCircle, XCircle, Calendar, Trash2, Share2, Copy, AlertCircle, Shield, UserCheck } from 'lucide-react';
import Modal from './Modal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabaseApi as mockApi } from '../services/supabaseApiService'; // Using Supabase API now
import type { User, Booking, Shift, Stake } from '../types';
import { toast } from 'react-hot-toast';
import { emailService } from '../services/emailService';
import * as XLSX from 'xlsx';

interface EventVolunteersListProps {
    eventId: string;
}

const EventVolunteersList: React.FC<EventVolunteersListProps> = ({ eventId }) => {
    const [volunteers, setVolunteers] = useState<User[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roles, setRoles] = useState<any[]>([]); // roles state
    const [filterRole, setFilterRole] = useState('todos');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [stakes, setStakes] = useState<Stake[]>([]);

    // New state for viewing user shifts
    const [viewingUser, setViewingUser] = useState<User | null>(null);

    const [viewingUserBookings, setViewingUserBookings] = useState<Booking[]>([]);
    const [isLoadingShifts, setIsLoadingShifts] = useState(false);
    const [eventDetails, setEventDetails] = useState<any>(null);

    // Store ALL system users for manual enrollment
    const [allSystemUsers, setAllSystemUsers] = useState<User[]>([]);

    // Pending management states
    const [pendingCancellations, setPendingCancellations] = useState<Booking[]>([]);
    const [pendingCoordinatorRequests, setPendingCoordinatorRequests] = useState<Booking[]>([]);
    const [showCancellationsModal, setShowCancellationsModal] = useState(false);
    const [showCoordinatorRequestsModal, setShowCoordinatorRequestsModal] = useState(false);

    useEffect(() => {
        fetchVolunteers();
    }, [eventId]);

    const fetchVolunteers = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const [allUsers, eventBookings, eventInfo, allShifts, eventRoles, eventStakes, eventPendingCancellations, eventPendingCoordinatorRequests] = await Promise.all([
                mockApi.getAllUsers(),
                mockApi.getBookingsByEvent(eventId),
                mockApi.getEventById(eventId),
                mockApi.getShiftsByEvent(eventId),
                mockApi.getRolesByEvent(eventId),
                mockApi.getStakesByEvent(eventId),
                mockApi.getPendingCancellations(eventId),
                mockApi.getPendingCoordinatorRequests(eventId)
            ]);

            // Filtrar solo usuarios que tienen bookings en este evento O son coordinadores en algun turno
            // EXCLUDE general enrollments (bookings without shifts) - they're just internal markers
            const realBookings = eventBookings.filter(b => b.shiftId !== null);
            const userIdsInEvent = new Set(realBookings.map(b => b.userId));

            // Add coordinators to the set
            allShifts.forEach(s => {
                if (s.coordinatorIds) {
                    s.coordinatorIds.forEach(id => userIdsInEvent.add(id));
                }
            });

            const eventVolunteers = allUsers.filter(u => userIdsInEvent.has(u.id));

            // Generate synthetic bookings for Coordinators to ensure they show up in counts and lists
            const coordinatorBookings: Booking[] = [];
            allShifts.forEach(shift => {
                if (shift.coordinatorIds) {
                    shift.coordinatorIds.forEach(uid => {
                        // Check if this user already has a booking for this shift to avoid duplicates (though rare)
                        const exists = realBookings.some(b => b.userId === uid && b.shiftId === shift.id);
                        if (!exists) {
                            const shiftRole = eventRoles.find(r => r.id === shift.roleId);
                            coordinatorBookings.push({
                                id: `coord_${shift.id}_${uid}`,
                                userId: uid,
                                shiftId: shift.id,
                                eventId: eventId,
                                status: 'confirmed' as const,
                                attendance: 'pending' as any,
                                requestedAt: new Date().toISOString(),
                                shift: { ...shift, role: shiftRole } as any, // Attach shift with role
                            });
                        }
                    });
                }
            });

            setVolunteers(eventVolunteers);
            setBookings([...realBookings, ...coordinatorBookings]);
            setEventDetails(eventInfo);
            setShifts(allShifts);
            setRoles(eventRoles);
            setStakes(eventStakes);
            setAllSystemUsers(allUsers); // Save all users
            setPendingCancellations(eventPendingCancellations);
            setPendingCoordinatorRequests(eventPendingCoordinatorRequests);
        } catch (error) {
            console.error('Error al cargar voluntarios:', error);
            toast.error('Error al cargar voluntarios del evento');
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const handleEditUser = (user: User) => {
        setEditingUser({ ...user });
        setShowEditModal(true);
    };

    const handleSaveUser = async () => {
        if (!editingUser) return;

        try {
            const userToUpdate = { ...editingUser };

            // Check if role degraded from coordinator to something else
            // We need to compare with the ORIGINAL user state in 'volunteers' list or fetch fresh.
            // But 'volunteers' list has the old state.
            const originalUser = volunteers.find(u => u.id === editingUser.id);
            if (originalUser && originalUser.role === 'coordinator' && userToUpdate.role !== 'coordinator') {
                // Remove from all coordinated shifts
                const coordinatedShifts = shifts.filter(s => s.coordinatorIds?.includes(editingUser.id));
                for (const shift of coordinatedShifts) {
                    await mockApi.removeCoordinatorFromShift(shift.id, editingUser.id);
                }
                toast.success('Se eliminaron los turnos de coordinación automáticamente.');
            }

            await mockApi.updateUser(userToUpdate);

            toast.success('Usuario actualizado correctamente');
            setShowEditModal(false);
            setEditingUser(null);
            fetchVolunteers();
        } catch (error: any) {
            toast.error(error.message || 'Error al actualizar usuario');
        }
    };

    const handleViewShifts = async (user: User) => {
        setViewingUser(user);
        setIsLoadingShifts(true);
        setViewingUserBookings([]); // clear previous

        try {
            const userShifts = await mockApi.getUserBookings(user.id, eventId);

            // Also fetch coordinator shifts manually if needed, or simply reuse the ones from 'bookings' state if they are there?
            // 'bookings' state has synthesized bookings. But 'getUserBookings' fetches from DB.
            // Let's stick to consistent DB fetch + synthesize.
            const allEventShifts = await mockApi.getShiftsByEvent(eventId);
            const coordShifts = allEventShifts.filter(s => s.coordinatorIds?.includes(user.id));

            const syntheticBookings: Booking[] = coordShifts.map(shift => {
                const shiftRole = roles.find(r => r.id === shift.roleId);
                return {
                    id: `coord|${shift.id}|${user.id}`,
                    userId: user.id,
                    shiftId: shift.id,
                    eventId: eventId,
                    status: 'confirmed' as const,
                    attendance: 'pending' as any,
                    requestedAt: new Date().toISOString(),
                    shift: { ...shift, role: shiftRole } as any
                };
            }).filter(sb => !userShifts.some(ub => ub.shiftId === sb.shiftId)); // Avoid dups

            setViewingUserBookings([...userShifts, ...syntheticBookings]);
        } catch (error) {
            console.error('Error fetching user shifts', error);
            toast.error('Error al cargar turnos del voluntario');
        } finally {
            setIsLoadingShifts(false);
        }
    };

    const handleAssignCoordinator = async (shiftId: string) => {
        if (!editingUser) return;
        try {
            await mockApi.assignCoordinatorToShift(shiftId, editingUser.id);
            toast.success('Turno asignado al coordinador');
            // Refresh shifts locally
            const updatedShifts = await mockApi.getShiftsByEvent(eventId);
            setShifts(updatedShifts);
            setShifts(updatedShifts);
            // Also refresh volunteers to update counts if needed
            fetchVolunteers(true);
        } catch (error: any) {
            toast.error(error.message || 'Error al asignar turno');
        }
    };

    const handleRemoveCoordinator = async (shiftId: string) => {
        if (!editingUser) return;
        try {
            await mockApi.removeCoordinatorFromShift(shiftId, editingUser.id);
            toast.success('Turno removido');
            // Refresh shifts locally
            const updatedShifts = await mockApi.getShiftsByEvent(eventId);
            setShifts(updatedShifts);
            setShifts(updatedShifts);
            // Also refresh volunteers
            fetchVolunteers(true);
        } catch (error: any) {
            toast.error(error.message || 'Error al remover turno');
        }
    };

    const handleDeleteBooking = async (bookingId: string) => {
        try {
            // Check if it is a synthetic coordinator booking
            if (bookingId.startsWith('coord|')) {
                // ID format: coord|{shiftId}|{userId}
                const parts = bookingId.split('|');
                if (parts.length >= 3) {
                    const shiftId = parts[1];
                    const userId = parts[2];

                    if (window.confirm('¿Estás seguro de que quieres quitar el rol de coordinador para este turno?')) {
                        await mockApi.removeCoordinatorFromShift(shiftId, userId);
                        toast.success('Rol de coordinador removido');

                        // Refresh shifts list
                        if (viewingUser) {
                            // Re-fetch logic or simulate
                            // For simplicity, just close modal or re-fetch shifts:
                            const userShifts = await mockApi.getUserBookings(viewingUser.id, eventId);
                            // Need to re-synthesize? Yes.
                            // Re-calling handleViewShifts is cleaner but it toggles loading.
                            // Let's manually trigger refresh of main list which updates 'shifts' state
                            // AND update secondary view.
                            fetchVolunteers(true);
                            // To refresh viewingUserBookings, we need to call logic similar to handleViewShifts
                            // We can't easily call handleViewShifts(viewingUser) because of state closure/recursion risk?
                            // Actually we can, just wait a bit.
                            setTimeout(() => handleViewShifts(viewingUser), 500);
                        } else {
                            fetchVolunteers(true);
                        }
                    }
                }
                return;
            }

            await mockApi.adminCancelBooking(bookingId);
            toast.success('Turno eliminado y voluntario notificado');

            // Refresh shifts list
            if (viewingUser) {
                const userShifts = await mockApi.getUserBookings(viewingUser.id, eventId);
                setViewingUserBookings(userShifts);
            }
            // Also refresh main list to update counts if necessary
            fetchVolunteers(true);
        } catch (error: any) {
            console.error('Error deleting booking', error);
            toast.error(error.message || 'Error al eliminar el turno');
        }
    };

    const exportToExcel = () => {
        try {
            const dataToExport = filteredVolunteers.map(v => {
                const userBookings = bookings.filter(b => b.userId === v.id);
                return {
                    'DNI': v.dni,
                    'Nombre Completo': v.fullName,
                    'Email': v.email,
                    'Teléfono': v.phone,
                    'Rol': getRoleLabel(v.role),
                    'Turnos Asignados': userBookings.length,
                    'Estado': v.status || 'active',
                    'Estaca / Barrio': getStakeName(v.stakeId)
                };
            });

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Voluntarios");

            const fileName = `Voluntarios_Evento_${eventId}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            toast.success('Excel generado correctamente');
        } catch (error) {
            console.error('Error exporting to excel:', error);
            toast.error('Error al exportar a Excel');
        }
    };

    // Pending Actions Management
    const handleViewCancellations = async () => {
        try {
            const cancellations = await mockApi.getPendingCancellations(eventId);
            setPendingCancellations(cancellations);
            setShowCancellationsModal(true);
        } catch (error) {
            toast.error('Error al cargar solicitudes de baja');
        }
    };

    const handleApproveCancellation = async (bookingId: string) => {
        try {
            await mockApi.approveCancellation(bookingId);
            toast.success('Baja confirmada exitosamente');
            const updatedCancellations = await mockApi.getPendingCancellations(eventId);
            setPendingCancellations(updatedCancellations);
            if (updatedCancellations.length === 0) setShowCancellationsModal(false);
            fetchVolunteers(true);
        } catch (error) {
            toast.error('Error al confirmar baja');
        }
    };

    const handleRejectCancellation = async (bookingId: string) => {
        try {
            await mockApi.rejectCancellation(bookingId);
            toast.success('Baja rechazada exitosamente');
            const updatedCancellations = await mockApi.getPendingCancellations(eventId);
            setPendingCancellations(updatedCancellations);
            if (updatedCancellations.length === 0) setShowCancellationsModal(false);
            fetchVolunteers(true);
        } catch (error) {
            toast.error('Error al rechazar baja');
        }
    };

    const handleViewCoordinatorRequests = async () => {
        try {
            const requests = await mockApi.getPendingCoordinatorRequests(eventId);
            setPendingCoordinatorRequests(requests);
            setShowCoordinatorRequestsModal(true);
        } catch (error) {
            toast.error('Error al cargar solicitudes de coordinación');
        }
    };

    const handleApproveCoordinator = async (bookingId: string) => {
        try {
            await mockApi.approveCoordinatorRequest(bookingId);
            toast.success('Solicitud aprobada y rol asignado');
            const updatedRequests = await mockApi.getPendingCoordinatorRequests(eventId);
            setPendingCoordinatorRequests(updatedRequests);
            if (updatedRequests.length === 0) setShowCoordinatorRequestsModal(false);
            fetchVolunteers(true);
        } catch (error) {
            toast.error('Error al aprobar solicitud');
        }
    };

    const getRoleLabel = (role: string) => {
        const labels = {
            superadmin: 'Super Admin',
            admin: 'Administrador',
            coordinator: 'Coordinador',
            volunteer: 'Voluntario'
        };
        return labels[role as keyof typeof labels] || role;
    };

    const getStakeName = (stakeId?: string) => {
        return stakes.find(s => s.id === stakeId)?.name || 'Sin Estaca/Barrio';
    };

    // Summary Generation Logic
    const [summaryUser, setSummaryUser] = useState<User | null>(null);
    const [summaryBookings, setSummaryBookings] = useState<Booking[]>([]);
    const [showSummaryModal, setShowSummaryModal] = useState(false);

    const handleOpenSummary = async (user: User) => {
        setSummaryUser(user);

        // Fetch specific bookings for this user to be sure we have the latest
        const userShifts = await mockApi.getUserBookings(user.id, eventId);
        setSummaryBookings(userShifts);

        setShowSummaryModal(true);
    };

    const generateSummaryText = () => {
        if (!summaryUser) return '';

        // Header con datos del evento
        let text = `*RECORDATORIO DE ASIGNACIONES*\n`;
        text += `*${eventDetails?.nombre || 'Evento'}*\n`;
        if (eventDetails) {
            text += `📅 ${new Date(eventDetails.fechaInicio + 'T00:00:00').toLocaleDateString()} - ${new Date(eventDetails.fechaFin + 'T00:00:00').toLocaleDateString()}\n`;
            text += `📍 ${eventDetails.ubicacion}\n`;
        }
        text += `\nHola ${summaryUser.fullName}, te comparto el resumen de tus turnos asignados:\n\n`;

        // Listado de turnos
        const activeBookings = summaryBookings.filter(b => b.status !== 'cancelled');
        if (activeBookings.length === 0) {
            text += "No tienes turnos registrados.\n";
        } else {
            activeBookings.forEach(booking => {
                const date = booking.shift?.date ? new Date(booking.shift.date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', weekday: 'short' }) : 'N/A';
                const roleName = booking.shift?.role?.name || 'Rol';
                text += `✅ ${date} ${booking.shift?.timeSlot} | ${roleName}\n`;
            });
        }

        // Footer con link y aviso
        text += `\n⚠️ *Importante:* Si tienes alguna novedad o no puedes asistir a algún turno, por favor avísanos lo antes posible.\n\n`;

        const eventUrl = eventDetails?.slug ? `${window.location.origin}/#/${eventDetails.slug}` : window.location.href;
        text += `🔗 Más info y autogestión en:\n${eventUrl}`;

        return text;
    };

    const handleCopySummary = () => {
        const text = generateSummaryText();
        navigator.clipboard.writeText(text);
        toast.success('Resumen copiado al portapapeles');
    };

    const handleDownloadSummaryPDF = async () => {
        if (!summaryUser) return;
        const doc = new jsPDF();

        // Header
        doc.setFillColor(243, 244, 246);
        doc.rect(0, 0, 210, 45, 'F'); // Increased height for more info

        doc.setFontSize(20);
        doc.setTextColor(17, 24, 39);
        doc.text("Recordatorio de Asignaciones", 14, 20);

        // Event Info in Header
        doc.setFontSize(14);
        doc.setTextColor(31, 41, 55);
        doc.text(eventDetails?.nombre || 'Evento', 14, 30);

        doc.setFontSize(10);
        doc.setTextColor(75, 85, 99);
        if (eventDetails) {
            const dateStr = `${new Date(eventDetails.fechaInicio + 'T00:00:00').toLocaleDateString('es-AR')} - ${new Date(eventDetails.fechaFin + 'T00:00:00').toLocaleDateString('es-AR')}`;
            doc.text(`Fechas: ${dateStr}   |   Ubicación: ${eventDetails.ubicacion}`, 14, 38);
        }

        let yPos = 60;
        doc.setFontSize(14);
        doc.setTextColor(17, 24, 39);
        doc.text(`Voluntario: ${summaryUser.fullName}`, 14, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.setTextColor(75, 85, 99);
        doc.text(`DNI: ${summaryUser.dni} | Email: ${summaryUser.email}`, 14, yPos);
        yPos += 15;

        // Table
        const tableColumn = ["Fecha", "Horario", "Rol", "Estado"];
        const activeBookings = summaryBookings.filter(b => b.status !== 'cancelled');
        const warningBookings = activeBookings.map(booking => [
            booking.shift?.date ? new Date(booking.shift.date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', weekday: 'short' }) : 'N/A',
            booking.shift?.timeSlot || '-',
            booking.shift?.role?.name || 'Rol',
            booking.status === 'confirmed' ? 'Confirmado' : 'Pendiente'
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [tableColumn],
            body: warningBookings,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], textColor: 255 },
            styles: { fontSize: 10, cellPadding: 3 },
            alternateRowStyles: { fillColor: [249, 250, 251] }
        });

        // Footer
        // Get the final Y position after the table
        // @ts-ignore
        const finalY = doc.lastAutoTable.finalY + 15;

        doc.setDrawColor(253, 224, 71); // yellow-300
        doc.setFillColor(254, 252, 232); // yellow-50
        doc.roundedRect(14, finalY, 182, 25, 3, 3, 'FD');

        doc.setFontSize(10);
        doc.setTextColor(161, 98, 7); // yellow-800
        doc.text("IMPORTANTE: Si tienes alguna novedad o no puedes asistir a algún turno, por favor avísanos lo antes posible.", 18, finalY + 8, { maxWidth: 174 });

        doc.setTextColor(31, 41, 55); // gray-800
        doc.text("Más info y autogestión en:", 18, finalY + 16);
        doc.setTextColor(37, 99, 235); // blue-600
        const eventUrl = eventDetails?.slug ? `${window.location.origin}/#/${eventDetails.slug}` : window.location.href;
        doc.textWithLink(eventUrl, 65, finalY + 16, { url: eventUrl });

        doc.save(`resumen_${summaryUser.fullName.replace(/\s+/g, '_')}.pdf`);
        toast.success('PDF generado exitosamente');
    };

    const handleShareWhatsApp = () => {
        if (!summaryUser) return;
        const text = generateSummaryText();

        // Limpiar el número dejando solo dígitos
        let phone = summaryUser.phone.replace(/\D/g, '');

        // Lógica específica para Argentina (mejora la probabilidad de que funcione el enlace directo)
        // Si tiene 10 dígitos (ej: 11 1234 5678), asumimos que es número local y agregamos 549
        if (phone.length === 10) {
            phone = '549' + phone;
        }
        // Si tiene 11 dígitos y empieza con 0 (ej: 011 1234 5678), quitamos el 0 y agregamos 549
        else if (phone.length === 11 && phone.startsWith('0')) {
            phone = '549' + phone.substring(1);
        }

        // Si ya tiene 12 o 13 dígitos (ej: 54911...), lo dejamos así.

        // Construir URL. Si el teléfono es válido (>6 dígitos al menos), intentamos el enlace directo.
        let url = phone.length > 6
            ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
            : `https://wa.me/?text=${encodeURIComponent(text)}`;

        window.open(url, '_blank');
    };

    const getRoleBadge = (role: string) => {
        const badges = {
            superadmin: 'bg-purple-100 text-purple-700 border-purple-200',
            admin: 'bg-blue-100 text-blue-700 border-blue-200',
            coordinator: 'bg-green-100 text-green-700 border-green-200',
            volunteer: 'bg-gray-100 text-gray-700 border-gray-200'
        };
        return badges[role as keyof typeof badges] || badges.volunteer;
    };

    const filteredVolunteers = volunteers.filter(volunteer => {
        const matchSearch = volunteer.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            volunteer.dni.includes(searchTerm) ||
            volunteer.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchRole = filterRole === 'todos' || volunteer.role === filterRole;
        return matchSearch && matchRole;
    });

    // Find users NOT in the event but in the system matching search
    const notEnrolledUsers = searchTerm.length > 2 ? allSystemUsers.filter(u => {
        const isEnrolled = volunteers.some(v => v.id === u.id);
        if (isEnrolled) return false;

        return u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.dni.includes(searchTerm) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase());
    }) : [];

    const handleEnrollUser = async (userToEnroll: User) => {
        if (!confirm(`¿Deseas inscribir a ${userToEnroll.fullName} en este evento?`)) return;
        try {
            await mockApi.enrollUserInEvent(userToEnroll.id, eventId);
            toast.success('Usuario inscripto exitosamente');
            fetchVolunteers(true);
        } catch (error: any) {
            toast.error(error.message || 'Error al inscribir usuario');
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-12">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    <span className="ml-3 text-gray-600">Cargando voluntarios...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Voluntarios del Evento</h3>
                    <p className="text-sm text-gray-600">
                        Total de voluntarios registrados: <span className="font-semibold text-gray-900">{volunteers.length}</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={handleViewCancellations}
                        disabled={pendingCancellations.length === 0}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-bold shadow-sm ${pendingCancellations.length > 0
                            ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                            : 'bg-gray-50 text-gray-400 border border-gray-200 cursor-default opacity-60'}`}
                    >
                        <AlertCircle size={18} />
                        {pendingCancellations.length} Bajas Pendientes
                    </button>

                    <button
                        onClick={handleViewCoordinatorRequests}
                        disabled={pendingCoordinatorRequests.length === 0}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-bold shadow-sm ${pendingCoordinatorRequests.length > 0
                            ? 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                            : 'bg-gray-50 text-gray-400 border border-gray-200 cursor-default opacity-60'}`}
                    >
                        <Shield size={18} />
                        {pendingCoordinatorRequests.length} Solicitudes Coord.
                    </button>
                    <button
                        onClick={exportToExcel}
                        disabled={filteredVolunteers.length === 0}
                        className="flex items-center justify-center gap-2 bg-[#8CB83E] text-white px-4 py-2 rounded-lg hover:bg-[#7cb342] font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Download size={18} />
                        Exportar Excel
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={18} className="text-gray-600" />
                    <h4 className="font-semibold text-gray-900">Filtros</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Nombre, DNI o email..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Rol</label>
                        <select
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                        >
                            <option value="todos">Todos los roles</option>
                            <option value="volunteer">Voluntarios</option>
                            <option value="coordinator">Coordinadores</option>
                            <option value="admin">Administradores</option>
                        </select>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                        Mostrando <span className="font-semibold text-gray-900">{filteredVolunteers.length}</span> de {volunteers.length} voluntarios
                    </p>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block"> {/* Removed overflow-x-auto to try to fit content */}
                <table className="w-full table-fixed"> {/* table-fixed helps contain width */}
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                                Voluntario
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                                Contacto
                            </th>
                            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">
                                Participo
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">
                                Rol
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">
                                Turnos
                            </th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">
                                Estado
                            </th>
                            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredVolunteers.map((volunteer) => {
                            const userBookings = bookings.filter(b => b.userId === volunteer.id);
                            return (
                                <tr key={volunteer.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4"> {/* Removed whitespace-nowrap */}
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                                                <span className="text-primary-700 font-semibold">
                                                    {volunteer.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                </span>
                                            </div>
                                            <div className="ml-4 overflow-hidden">
                                                <div className="text-sm font-medium text-gray-900 truncate" title={volunteer.fullName}>{volunteer.fullName}</div>
                                                <div className="text-sm text-gray-500 truncate">DNI: {volunteer.dni}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-4"> {/* Removed whitespace-nowrap */}
                                        <div className="flex items-center gap-2 text-sm text-gray-900 mb-1 overflow-hidden">
                                            <Mail size={14} className="text-gray-400 flex-shrink-0" />
                                            <span className="truncate" title={volunteer.email}>{volunteer.email}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <Phone size={14} className="text-gray-400 flex-shrink-0" />
                                            <span className="truncate">{volunteer.phone}</span>
                                        </div>
                                    </td>
                                    <td className="px-2 py-4 text-center text-sm font-medium">
                                        {volunteer.attendedPrevious ? (
                                            <span className="text-green-600">SI</span>
                                        ) : (
                                            <span className="text-gray-400">NO</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-4">
                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getRoleBadge(volunteer.role)}`}>
                                            {getRoleLabel(volunteer.role)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-4">
                                        <div className="text-sm text-gray-900 font-semibold">{userBookings.length} turnos</div>
                                    </td>
                                    <td className="px-3 py-4">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${(volunteer.status || 'active') === 'active'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {(volunteer.status || 'active') === 'active' ? 'Activo' : 'Suspendido'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 text-right text-sm font-medium">
                                        <div className="flex justify-end gap-1">
                                            <button
                                                onClick={() => handleViewShifts(volunteer)}
                                                className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Ver historial de turnos"
                                            >
                                                <Calendar size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenSummary(volunteer)}
                                                className="text-green-600 hover:text-green-900 p-2 hover:bg-green-50 rounded-lg transition-colors"
                                                title="Compartir resumen de asignaciones"
                                            >
                                                <Share2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleEditUser(volunteer)}
                                                className="text-primary-600 hover:text-primary-900 p-2 hover:bg-primary-50 rounded-lg transition-colors"
                                                title="Editar usuario"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden divide-y divide-gray-200">
                {filteredVolunteers.map((volunteer) => {
                    const userBookings = bookings.filter(b => b.userId === volunteer.id);
                    return (
                        <div key={volunteer.id} className="p-4 bg-white flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                                        <span className="text-primary-700 font-semibold">
                                            {volunteer.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-900">{volunteer.fullName}</div>
                                        <div className="text-xs text-gray-500">DNI: {volunteer.dni}</div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleViewShifts(volunteer)}
                                        className="p-2 text-blue-600 bg-blue-50 rounded-lg"
                                        title="Ver historial"
                                    >
                                        <Calendar size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleOpenSummary(volunteer)}
                                        className="p-2 text-green-600 bg-green-50 rounded-lg"
                                        title="Compartir resumen"
                                    >
                                        <Share2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleEditUser(volunteer)}
                                        className="p-2 text-primary-600 bg-primary-50 rounded-lg"
                                        title="Editar"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                                <div>
                                    <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Rol</div>
                                    <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${getRoleBadge(volunteer.role)}`}>
                                        {getRoleLabel(volunteer.role)}
                                    </span>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Estado</div>
                                    <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${(volunteer.status || 'active') === 'active'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {(volunteer.status || 'active') === 'active' ? 'Activo' : 'Suspendido'}
                                    </span>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Experiencia</div>
                                    {volunteer.attendedPrevious ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                            Participó en Anterior
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-500">Primera vez</span>
                                    )}
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Turnos</div>
                                    <div className="font-medium">{userBookings.length} asignados</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Email</div>
                                    <div className="truncate">{volunteer.email}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Edit User Modal */}
            {showEditModal && editingUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-2xl font-serif font-bold text-gray-900">
                                Editar Usuario
                            </h3>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Nombre Completo
                                    </label>
                                    <input
                                        type="text"
                                        value={editingUser.fullName}
                                        onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        DNI
                                    </label>
                                    <input
                                        type="text"
                                        value={editingUser.dni}
                                        onChange={(e) => setEditingUser({ ...editingUser, dni: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={editingUser.email}
                                        onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Teléfono
                                    </label>
                                    <input
                                        type="tel"
                                        value={editingUser.phone}
                                        onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Rol
                                    </label>
                                    <select
                                        value={editingUser.role}
                                        onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="volunteer">Voluntario</option>
                                        <option value="coordinator">Coordinador</option>
                                        <option value="admin">Administrador</option>
                                        <option value="superadmin">Super Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Estado
                                    </label>
                                    <select
                                        value={editingUser.status || 'active'}
                                        onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="active">Activo</option>
                                        <option value="suspended">Suspendido</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Estaca / Barrio
                                    </label>
                                    <select
                                        value={editingUser.stakeId || ''}
                                        onChange={(e) => setEditingUser({ ...editingUser, stakeId: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        required
                                    >
                                        <option value="">Seleccionar Estaca/Barrio...</option>
                                        {stakes.map(stake => (
                                            <option key={stake.id} value={stake.id}>{stake.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Coordinator Shift Assignment Section */}
                            {editingUser.role === 'coordinator' && (
                                <div className="mt-6 border-t border-gray-100 pt-4">
                                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Asignar Turnos (Coordinación)</h4>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Agregar Turno</label>
                                        <div className="flex gap-2">
                                            <select
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                                id="coordinator-shift-select"
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        handleAssignCoordinator(e.target.value);
                                                        e.target.value = ""; // Reset
                                                    }
                                                }}
                                            >
                                                <option value="">Seleccionar un turno para asignar...</option>
                                                {shifts
                                                    .filter(s => !s.coordinatorIds?.includes(editingUser.id))
                                                    .filter(s => {
                                                        const role = roles.find(r => r.id === s.roleId);
                                                        return role?.name.toLowerCase().includes('coordinador');
                                                    })
                                                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                                    .map(s => (
                                                        <option key={s.id} value={s.id}>
                                                            {new Date(s.date + 'T12:00:00').toLocaleDateString()} - {s.timeSlot} (Vacantes: {s.availableVacancies})
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Horario</th>
                                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {shifts
                                                    .filter(s => s.coordinatorIds?.includes(editingUser.id))
                                                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                                    .map(s => (
                                                        <tr key={s.id}>
                                                            <td className="px-4 py-2 text-sm text-gray-900">{new Date(s.date + 'T12:00:00').toLocaleDateString()}</td>
                                                            <td className="px-4 py-2 text-sm text-gray-500">{s.timeSlot}</td>
                                                            <td className="px-4 py-2 text-right">
                                                                <button
                                                                    onClick={() => handleRemoveCoordinator(s.id)}
                                                                    className="text-red-600 hover:text-red-900 text-xs font-medium hover:underline"
                                                                >
                                                                    Quitar
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                {shifts.filter(s => s.coordinatorIds?.includes(editingUser.id)).length === 0 && (
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">
                                                            No tiene turnos de coordinación asignados.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}



                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                                <p className="text-sm text-yellow-700">
                                    <strong>Nota:</strong> Los cambios en el rol afectarán los permisos del usuario en todo el sistema.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveUser}
                                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex items-center justify-center gap-2"
                            >
                                <Save size={18} />
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {filteredVolunteers.length === 0 && (
                <div className="text-center py-12">
                    <Users size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No se encontraron voluntarios inscriptos con los filtros seleccionados</p>

                    {/* Show potential matches from system users */}
                    {notEnrolledUsers.length > 0 && (
                        <div className="mt-8 max-w-2xl mx-auto text-left bg-blue-50 rounded-lg p-6 border border-blue-100">
                            <h4 className="text-sm font-semibold text-blue-900 mb-4">
                                Usuarios encontrados en el sistema (no inscriptos en este evento):
                            </h4>
                            <div className="space-y-3">
                                {notEnrolledUsers.map(u => (
                                    <div key={u.id} className="flex items-center justify-between bg-white p-3 rounded shadow-sm">
                                        <div>
                                            <p className="font-medium text-gray-900">{u.fullName}</p>
                                            <p className="text-xs text-gray-500">{u.email} • DNI: {u.dni}</p>
                                        </div>
                                        <button
                                            onClick={() => handleEnrollUser(u)}
                                            className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                                        >
                                            Inscribir
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Summary Share Modal */}
            {showSummaryModal && summaryUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">
                                Compartir Asignaciones
                            </h3>
                            <button onClick={() => setShowSummaryModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="mb-6">
                            <p className="text-sm text-gray-600 mb-2">
                                Genera un resumen de los turnos asignados a <strong>{summaryUser.fullName}</strong> para enviárselo como recordatorio.
                            </p>
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                                {generateSummaryText()}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                                onClick={handleShareWhatsApp}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] text-white rounded-lg hover:brightness-105 font-medium transition-colors shadow-sm"
                            >
                                <Share2 size={18} />
                                WhatsApp
                            </button>
                            <button
                                onClick={handleCopySummary}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors shadow-sm"
                            >
                                <Copy size={18} />
                                Copiar
                            </button>
                            <button
                                onClick={handleDownloadSummaryPDF}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-black font-medium transition-colors shadow-sm"
                            >
                                <Download size={18} />
                                Descargar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Shifts Modal */}
            {viewingUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-2xl font-serif font-bold text-gray-900">
                                    Historial de Turnos
                                </h3>
                                <p className="text-gray-600">
                                    Voluntario: <span className="font-semibold text-primary-600">{viewingUser.fullName}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setViewingUser(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {isLoadingShifts ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                            </div>
                        ) : viewingUserBookings.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-gray-500">Este voluntario no tiene turnos asignados en este evento.</p>
                            </div>
                        ) : (
                            <>
                                {/* Desktop View */}
                                <div className="hidden sm:block overflow-hidden bg-white border border-gray-200 rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horario</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asistencia</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {viewingUserBookings.map((booking) => (
                                                <tr key={booking.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {booking.shift?.date ? new Date(booking.shift.date + 'T12:00:00').toLocaleDateString('es-AR') : (booking.shiftId === null ? 'Sin Fecha' : '-')}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {booking.shift?.timeSlot || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getRoleBadge(booking.shift?.role?.name || '')}`}>
                                                            {booking.shift?.role?.name || (booking.shiftId === null ? 'Inscripción General' : '-')}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                            ${booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                                booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                                    'bg-yellow-100 text-yellow-800'}`}>
                                                            {booking.status === 'confirmed' ? 'Confirmado' :
                                                                booking.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {booking.attendance === 'attended' ? (
                                                            <span className="flex items-center gap-1 text-green-600 font-medium">
                                                                <CheckCircle size={16} /> Asistió
                                                            </span>
                                                        ) : booking.attendance === 'absent' ? (
                                                            <span className="flex items-center gap-1 text-red-600 font-medium">
                                                                <XCircle size={16} /> Ausente
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400 italic">Pendiente</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        {booking.status !== 'cancelled' ? (
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm('¿Estás seguro de que quieres eliminar este turno? Se enviará un aviso al voluntario.')) {
                                                                        handleDeleteBooking(booking.id);
                                                                    }
                                                                }}
                                                                className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
                                                                title="Eliminar turno"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile View */}
                                <div className="sm:hidden space-y-4">
                                    {viewingUserBookings.map((booking) => (
                                        <div key={booking.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">
                                                        {booking.shift?.date ? new Date(booking.shift.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) : '-'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{booking.shift?.timeSlot || '-'}</p>
                                                </div>
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getRoleBadge(booking.shift?.role?.name || '')}`}>
                                                    {booking.shift?.role?.name || '-'}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-2">
                                                <div>
                                                    <div className="text-xs text-gray-500 mb-1">Estado</div>
                                                    <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full 
                                                        ${booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                            booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                                'bg-yellow-100 text-yellow-800'}`}>
                                                        {booking.status === 'confirmed' ? 'Confirmado' :
                                                            booking.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-gray-500 mb-1">Asistencia</div>
                                                    {booking.attendance === 'attended' ? (
                                                        <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                                                            <CheckCircle size={14} /> Asistió
                                                        </span>
                                                    ) : booking.attendance === 'absent' ? (
                                                        <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                                                            <XCircle size={14} /> Ausente
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 italic text-sm">Pendiente</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setViewingUser(null)}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
            {/* Modal de Solicitudes de Baja */}
            <Modal
                isOpen={showCancellationsModal}
                onClose={() => setShowCancellationsModal(false)}
                title="Solicitudes de Baja Pendientes"
            >
                <div>
                    {pendingCancellations.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No hay solicitudes de baja pendientes.</p>
                    ) : (
                        <div className="space-y-4">
                            {pendingCancellations.map((cancellation) => (
                                <div key={cancellation.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <h4 className="font-bold text-gray-900">{cancellation.user?.fullName}</h4>
                                        <div className="text-sm text-gray-600 space-y-1 mt-1">
                                            <p><strong>Rol:</strong> {cancellation.shift?.role?.name}</p>
                                            <p><strong>Turno:</strong> {cancellation.shift?.date ? new Date(cancellation.shift.date + 'T12:00:00').toLocaleDateString() : '-'} - {cancellation.shift?.timeSlot}</p>
                                            <p><strong>Motivo:</strong> Solicitada el {cancellation.cancelledAt ? new Date(cancellation.cancelledAt).toLocaleDateString() : '-'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button
                                            onClick={() => handleRejectCancellation(cancellation.id)}
                                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium"
                                        >
                                            <XCircle size={18} />
                                            Rechazar
                                        </button>
                                        <button
                                            onClick={() => handleApproveCancellation(cancellation.id)}
                                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors font-medium"
                                        >
                                            <CheckCircle size={18} />
                                            Confirmar Baja
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Modal de Solicitudes de Coordinación */}
            <Modal
                isOpen={showCoordinatorRequestsModal}
                onClose={() => setShowCoordinatorRequestsModal(false)}
                title="Aprobar Coordinadores"
            >
                <div>
                    {pendingCoordinatorRequests.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No hay solicitudes pendientes.</p>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 mb-4 bg-blue-50 p-3 rounded border border-blue-100">
                                Al aprobar, el usuario quedará inscrito en el turno y se le asignará el rol de <strong>Coordinador</strong> en el sistema global.
                            </p>
                            {pendingCoordinatorRequests.map((req) => (
                                <div key={req.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <h4 className="font-bold text-gray-900">{req.user?.fullName}</h4>
                                        <div className="text-sm text-gray-600 space-y-1 mt-1">
                                            <p><strong>Rol Evento:</strong> {req.shift?.role?.name}</p>
                                            <p><strong>Turno:</strong> {req.shift?.date ? new Date(req.shift.date + 'T12:00:00').toLocaleDateString() : '-'} - {req.shift?.timeSlot}</p>
                                            <p><strong>Solicitado:</strong> {req.requestedAt ? new Date(req.requestedAt).toLocaleDateString() : '-'}</p>
                                            <p className="text-xs text-gray-500 mt-1">Email: {req.user?.email}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleApproveCoordinator(req.id)}
                                        className="flex items-center justify-center gap-2 px-4 py-2 border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors font-medium w-full sm:w-auto"
                                    >
                                        <UserCheck size={18} />
                                        Aprobar y Asignar
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default EventVolunteersList;

