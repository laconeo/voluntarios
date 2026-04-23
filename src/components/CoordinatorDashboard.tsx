import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseApi as mockApi } from '../services/supabaseApiService';
import type { User, Event, Shift, Booking, Role, Material } from '../types';
import { Download, CheckCircle, XCircle, Clock, Calendar, Search, Printer, Share2, FileText, MoreVertical, ChevronUp, ChevronDown, Utensils, Monitor, BarChart2, X, Shirt, Tag, Ticket, Droplets, Package, Users } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import VolunteerPortal from './VolunteerPortal';

interface CoordinatorDashboardProps {
    user: User;
    onLogout?: () => void;
    globalEventId?: string;
    onClose?: () => void;
}

const CoordinatorDashboard: React.FC<CoordinatorDashboardProps> = ({ user, onLogout, globalEventId, onClose }) => {
    const navigate = useNavigate();
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
    const [hasNoAssignedShifts, setHasNoAssignedShifts] = useState(false);
    const [showVolunteerPortal, setShowVolunteerPortal] = useState(false);
    const [sortAlphabetically, setSortAlphabetically] = useState(false);
    const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // Materials tracking
    const [materials, setMaterials] = useState<Material[]>([]);
    const [deliveredMaterials, setDeliveredMaterials] = useState<Record<string, Record<string, boolean>>>({}); // userId -> materialId -> bool

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const allEvents = await mockApi.getAllEvents();

                // Get events where user is assigned as coordinator in shifts
                const userCoordinatorShifts = await mockApi.getShiftsWhereUserIsCoordinator(user.id);
                const shiftEventIds = new Set(userCoordinatorShifts.map(s => s.eventId));

                // Get user bookings to check for roles that require approval (often coordinators)
                const userBookings = await mockApi.getUserBookings(user.id);
                const approvedRoleEventIds = userBookings
                    .filter(b => b.status === 'confirmed' && b.shift?.role?.requiresApproval)
                    .map(b => b.eventId);

                // Combine sources
                const coordinatorRelevantEventIds = new Set([...shiftEventIds, ...approvedRoleEventIds]);

                const coordinatorEvents: Event[] = [];
                if (globalEventId) {
                    const event = allEvents.find(e => e.id === globalEventId);
                    if (event) coordinatorEvents.push(event);
                } else {
                    allEvents.forEach(event => {
                        if (coordinatorRelevantEventIds.has(event.id)) {
                            coordinatorEvents.push(event);
                        }
                    });
                }

                if (coordinatorEvents.length > 0) {
                    setEvents(coordinatorEvents);
                    setSelectedEventId(coordinatorEvents[0].id);
                    setHasNoAssignedShifts(false);
                } else {
                    // No assigned shifts — fall back to all active events so the Portal button still works
                    const activeEvents = allEvents.filter(e => e.estado === 'Activo');
                    setEvents(activeEvents);
                    if (activeEvents.length > 0) setSelectedEventId(activeEvents[0].id);
                    setHasNoAssignedShifts(true);
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
            loadMaterialsData(selectedEventId);
            setSelectedTimeSlot('all'); // Reset time slot selection when event changes
        }
    }, [selectedEventId]);

    const loadMaterialsData = async (eventId: string) => {
        try {
            const [materialsData, deliveryData] = await Promise.all([
                mockApi.getMaterialsByEvent(eventId),
                mockApi.getUserMaterials(eventId),
            ]);
            // Filter out 'food' category (handled separately via Vianda)
            const trackMaterials = materialsData.filter(m => m.category !== 'food');
            setMaterials(trackMaterials);

            // Build delivery state map
            const deliveryMap: Record<string, Record<string, boolean>> = {};
            if (Array.isArray(deliveryData)) {
                deliveryData.forEach((d: any) => {
                    if (!deliveryMap[d.user_id]) deliveryMap[d.user_id] = {};
                    deliveryMap[d.user_id][d.material_id] = true;
                });
            }
            setDeliveredMaterials(deliveryMap);
        } catch (error) {
            console.error('Error cargando materiales:', error);
        }
    };

    const handleMaterialToggle = async (userId: string, materialId: string) => {
        const current = deliveredMaterials[userId]?.[materialId] ?? false;
        const newStatus = !current;

        // Optimistic update
        setDeliveredMaterials(prev => ({
            ...prev,
            [userId]: { ...prev[userId], [materialId]: newStatus }
        }));

        try {
            await mockApi.toggleUserMaterial(selectedEventId, userId, materialId, newStatus);
        } catch (error) {
            console.error('Error guardando material:', error);
            // Revert
            setDeliveredMaterials(prev => ({
                ...prev,
                [userId]: { ...prev[userId], [materialId]: current }
            }));
        }
    };

    // Returns appropriate icon for a material based on its name/category
    const getMaterialIcon = (material: Material) => {
        const name = material.name.toLowerCase();
        if (name.includes('remera') || name.includes('camiseta') || name.includes('shirt')) return <Shirt size={13} />;
        if (name.includes('gafete') || name.includes('credencial') || name.includes('badge')) return <Tag size={13} />;
        if (name.includes('entrada') || name.includes('ticket') || name.includes('acceso')) return <Ticket size={13} />;
        if (name.includes('botella') || name.includes('agua') || name.includes('bottle')) return <Droplets size={13} />;
        return <Package size={13} />;
    };

    const loadEventData = async (eventId: string) => {
        setIsLoading(true);
        try {
            const eventShifts = await mockApi.getShiftsByEvent(eventId);

            const userBookings = await mockApi.getUserBookings(user.id, eventId);
            const coordinatorBookingShiftIds = userBookings
                .filter(b => b.status === 'confirmed' && b.shift?.role?.requiresApproval)
                .map(b => b.shiftId);

            let myShifts = eventShifts;
            
            if (!globalEventId) {
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

                myShifts = eventShifts.filter(s => visibleShifts.has(s.id));
            }

            // Sort shifts by date and time
            myShifts.sort((a, b) => {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
                return a.timeSlot.localeCompare(b.timeSlot);
            });
            setShifts(myShifts);

            const eventBookings = await mockApi.getBookingsByEvent(eventId);
            setBookings(eventBookings);
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
        const headers = ['Fecha', 'Horario', 'Rol', 'Nombre', 'Talle', 'DNI', 'Email', 'Teléfono', 'Estado', 'Vianda', ...materials.map(m => m.name), 'Asistencia'];
        const csvRows = [headers.join(',')];

        filteredShifts.forEach(shift => {
            let shiftBookings = bookings.filter(b => b.shiftId === shift.id && b.status === 'confirmed');
            
            if (sortAlphabetically) {
                shiftBookings = [...shiftBookings].sort((a, b) => (a.user?.fullName || '').localeCompare(b.user?.fullName || ''));
            }

            const role = roles.find(r => r.id === shift.roleId);

            shiftBookings.forEach(booking => {
                const row = [
                    shift.date,
                    shift.timeSlot,
                    role?.name || 'Desconocido',
                    booking.user?.fullName || '',
                    booking.user?.tshirtSize || '',
                    booking.user?.dni || '',
                    booking.user?.email || '',
                    booking.user?.phone || '',
                    booking.status,
                    booking.foodDelivered ? 'Si' : 'No',
                    ...materials.map(m => (booking.user?.id && deliveredMaterials[booking.user.id]?.[m.id] ? 'Si' : 'No')),
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
        doc.text("Voluntarios FamilySearch - Resumen de asignaciones", 14, 15);

        doc.setFontSize(10);
        doc.setTextColor(55, 65, 81);
        doc.text(`Evento: ${eventName}`, 14, 23);

        let yPos = 35;

        // Process each group of shifts as a section
        sortedGroups.forEach(group => {
            // Gather bookings for this group
            let groupBookings = group.shifts.flatMap(s =>
                bookings.filter(b => b.shiftId === s.id && b.status === 'confirmed').map(b => ({ ...b, roleName: getRoleName(s.roleId) }))
            );

            if (sortAlphabetically) {
                groupBookings.sort((a, b) => (a.user?.fullName || '').localeCompare(b.user?.fullName || ''));
            }

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
            const tableColumn = ["Nombre", "Talle", "DNI", "Rol", "Vianda", ...materials.map(m => m.name), "Asistencia"];
            const tableRows = groupBookings.map(b => [
                b.user?.fullName || '',
                b.user?.tshirtSize || '',
                b.user?.dni || '',
                b.roleName || '',
                b.foodDelivered ? 'Si' : '',
                ...materials.map(m => (b.user?.id && deliveredMaterials[b.user.id]?.[m.id] ? 'Si' : '')),
                b.attendance === 'attended' ? 'Presente' : (b.attendance === 'absent' ? 'Ausente' : '')
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [tableColumn],
                body: tableRows,
                theme: 'grid', // 'striped', 'grid', 'plain'
                headStyles: { fillColor: [140, 184, 62], textColor: 255 },
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
        let text = `*Listado de Voluntarios - ${eventName}*\n\n`;

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

        // Sanitize text to remove control characters that might cause encoding issues
        const sanitizedText = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(sanitizedText)}`;
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
        <div className="min-h-screen bg-transparent">
            {globalEventId && onClose && (
                <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 fixed top-0 w-full z-50 print:hidden hidden sm:block">
                    <button
                        onClick={onClose}
                        className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-2"
                    >
                        ← Volver al listado de eventos
                    </button>
                </div>
            )}
            <main className={`max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pb-32 lg:pb-8 ${globalEventId ? 'pt-24 sm:py-8' : 'py-8'}`}>
                <h1 className="text-3xl font-bold text-gray-900 mb-8 print:hidden">
                    {globalEventId ? 'Vista Coordinador Global' : 'Panel de Coordinador'}
                </h1>
                {/* Print Header */}
                <div className="hidden print:block mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Listado de Voluntarios</h1>
                    <div className="flex flex-col gap-1 text-gray-700">
                        <p><span className="font-semibold">Evento:</span> {events.find(e => e.id === selectedEventId)?.nombre}</p>
                        <p><span className="font-semibold">Coordinador:</span> {user.fullName}</p>
                    </div>
                </div>

                {/* T-shirt Size Summary */}
                {(() => {
                    const allCurrentBookings = filteredShifts.flatMap(s => 
                        bookings.filter(b => b.shiftId === s.id && b.status !== 'cancelled')
                    );
                    
                    // Filter them like the main list (using searchTerm)
                    const filteredForSummary = searchTerm
                        ? allCurrentBookings.filter(b => 
                            b.user?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            b.user?.dni.includes(searchTerm)
                        )
                        : allCurrentBookings;

                    const summary: Record<string, number> = {};
                    filteredForSummary.forEach(b => {
                        const size = b.user?.tshirtSize || 'Sin talle';
                        summary[size] = (summary[size] || 0) + 1;
                    });

                    // Delivery summary
                    const tShirtMaterial = materials.find(m => {
                        const n = m.name.toLowerCase();
                        return n.includes('remera') || n.includes('camiseta') || n.includes('shirt');
                    });

                    let deliveredCount = 0;
                    const pendingSizes: Record<string, number> = {};
                    if (tShirtMaterial) {
                        filteredForSummary.forEach(b => {
                            const isDelivered = b.user?.id && deliveredMaterials[b.user.id]?.[tShirtMaterial.id];
                            if (isDelivered) {
                                deliveredCount++;
                            } else {
                                const size = b.user?.tshirtSize || 'Sin talle';
                                pendingSizes[size] = (pendingSizes[size] || 0) + 1;
                            }
                        });
                    }
                    const pendingCount = filteredForSummary.length - deliveredCount;

                    const sizesOrder = ['S', 'M', 'L', 'XL', 'XXL', 'Sin talle'];
                    const activeSizes = sizesOrder.filter(s => summary[s]);
                    const activePendingSizes = sizesOrder.filter(s => pendingSizes[s]);

                    if (filteredForSummary.length === 0) return null;

                    return (
                        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm print:hidden">
                            <div className="flex items-center gap-2 mb-3 text-gray-700 font-semibold text-sm uppercase tracking-wider">
                                <Shirt size={16} className="text-primary-500" />
                                <span>Resumen de Talles ({filteredForSummary.length} personas)</span>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {activeSizes.map(size => (
                                    <div key={size} className="flex items-center bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 shadow-inner">
                                        <span className="text-xs font-bold text-gray-500 mr-2">{size}:</span>
                                        <span className="text-lg font-black text-primary-700">{summary[size]}</span>
                                    </div>
                                ))}
                            </div>
                            
                            {tShirtMaterial && (
                                <div className="mt-4 pt-3 border-t border-gray-100">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            <span className="text-xs text-gray-600">Entregadas: <span className="font-bold text-gray-900">{deliveredCount}</span></span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                                            <span className="text-xs text-gray-600">Pendientes: <span className="font-bold text-orange-600">{pendingCount}</span></span>
                                        </div>
                                        <div className="ml-auto bg-primary-50 px-2 py-1 rounded text-[10px] font-bold text-primary-700">
                                            {Math.round((deliveredCount / filteredForSummary.length) * 100)}% COMPLETADO
                                        </div>
                                    </div>
                                    
                                    {pendingCount > 0 && (
                                        <div className="bg-orange-50 rounded-lg p-2 border border-orange-100">
                                            <p className="text-[10px] font-bold text-orange-700 mb-1 uppercase tracking-tighter">Faltan entregar por talle:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {activePendingSizes.map(size => (
                                                    <span key={size} className="text-xs font-semibold text-orange-800">
                                                        {size}: <span className="font-black underline">{pendingSizes[size]}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })()}


                {/* ── Barra de controles: búsqueda arriba, selects + botones abajo ── */}
                <div className="mb-6 flex flex-col gap-3 print:hidden">

                    {/* Fila 1: búsqueda ancho completo */}
                    <div className="relative w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={18} className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar voluntario por nombre o DNI..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>

                    {/* Orden Alfabético y Modo de Vista */}
                    <div className="flex flex-wrap items-center gap-3 px-1">
                        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                            <button
                                onClick={() => setViewMode('grouped')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    viewMode === 'grouped' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Calendar size={14} className="inline mr-1.5" />
                                Por Turnos
                            </button>
                            <button
                                onClick={() => setViewMode('flat')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    viewMode === 'flat' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Users size={14} className="inline mr-1.5" />
                                Lista Única
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                if (sortAlphabetically) {
                                    setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                                } else {
                                    setSortAlphabetically(true);
                                    setSortDir('asc');
                                }
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                sortAlphabetically 
                                    ? 'bg-primary-100 text-primary-700 border border-primary-200 shadow-sm' 
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <Search size={14} />
                            Orden Alfabético {sortAlphabetically && (sortDir === 'asc' ? '↑' : '↓')}
                        </button>
                        
                        {sortAlphabetically && (
                            <button 
                                onClick={() => {
                                    setSortAlphabetically(false);
                                    setSortDir('asc');
                                }}
                                className="text-xs text-gray-400 hover:text-gray-600 underline"
                            >
                                Restablecer orden
                            </button>
                        )}
                    </div>

                    {/* Fila 2: selects izquierda • botones derecha */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                        {/* Selects */}
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <div className="w-full sm:w-52">
                                <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Evento</label>
                                <select
                                    value={selectedEventId}
                                    onChange={(e) => setSelectedEventId(e.target.value)}
                                    disabled={!!globalEventId}
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white cursor-pointer text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                                >
                                    {events.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                                </select>
                            </div>
                            <div className="w-full sm:w-52">
                                <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Horario</label>
                                <select
                                    value={selectedTimeSlot}
                                    onChange={(e) => setSelectedTimeSlot(e.target.value)}
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white cursor-pointer text-sm"
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

                        {/* Desktop: botones alineados a la derecha */}
                        <div className="hidden lg:flex lg:items-center lg:gap-2 flex-shrink-0">
                            <button
                                onClick={() => {
                                    setShowVolunteerPortal(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:opacity-90 transition-opacity font-medium shadow-sm text-sm text-white"
                                style={{ backgroundColor: '#8CB83E' }}
                            >
                                <Calendar size={15} />
                                Portal Voluntario
                            </button>
                            <button
                                onClick={() => {
                                    const evt = events.find(e => e.id === selectedEventId);
                                    if (evt) window.open(`${window.location.href.split('#')[0]}#/${evt.slug}/stand-monitor`, '_blank');
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:opacity-90 transition-opacity font-medium shadow-sm text-sm text-white"
                                style={{ backgroundColor: '#0077C5' }}
                            >
                                <Monitor size={15} />
                                Monitor
                            </button>
                            <button
                                onClick={() => {
                                    const evt = events.find(e => e.id === selectedEventId);
                                    if (evt) window.open(`${window.location.href.split('#')[0]}#/${evt.slug}/stand-metrics`, '_blank');
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:opacity-90 transition-opacity font-medium shadow-sm text-sm"
                                style={{ backgroundColor: '#e6f2d0', color: '#557326', border: '1px solid #d0e5a6' }}
                            >
                                <BarChart2 size={15} />
                                Métricas
                            </button>
                            <div className="relative">
                                <button
                                    onClick={() => setShowActionsMenu(!showActionsMenu)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm text-sm"
                                >
                                    Acciones
                                    <ChevronDown size={15} />
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
                </div>

                <div className="space-y-6">
                    {viewMode === 'grouped' ? sortedGroups.map(group => {
                        // Gather bookings: Show non-cancelled (including pending, waitlist, cancellation_requested)
                        const groupBookings = group.shifts.flatMap(s =>
                            bookings
                                .filter(b => b.shiftId === s.id && b.status !== 'cancelled')
                                .map(b => ({ ...b, roleName: getRoleName(s.roleId) }))
                        );

                        // Calculate total occupied spots based on shift data (from DB) to check consistency
                        // We subtract coordinators because they are counted in occupancy but usually not shown in this specific booking list
                        const totalCoordinators = group.shifts.reduce((acc, s) => acc + (s.coordinatorIds?.length || 0), 0);
                        const totalOccupied = group.shifts.reduce((acc, s) => acc + (s.totalVacancies - s.availableVacancies), 0);
                        const expectedVolunteers = Math.max(0, totalOccupied - totalCoordinators);

                        // If searching, filter bookings
                        let displayBookings = searchTerm
                            ? groupBookings.filter(b =>
                                b.user?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                b.user?.dni.includes(searchTerm)
                            )
                            : [...groupBookings];

                        // Sort alphabetically if enabled
                        if (sortAlphabetically) {
                            displayBookings.sort((a, b) => {
                                const cmp = (a.user?.fullName || '').localeCompare(b.user?.fullName || '');
                                return sortDir === 'asc' ? cmp : -cmp;
                            });
                        }

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
                                                {totalCoordinators > 0 && ` (+${totalCoordinators} coord.)`}
                                            </span>
                                            {!searchTerm && expectedVolunteers > displayBookings.length && (
                                                <span className="text-xs text-orange-500 font-medium" title="Hay más vacantes ocupadas en el sistema de las que se muestran aquí. Posibles usuarios con estado desconocido o filtro activo.">
                                                    ⚠️ {expectedVolunteers} vacantes ocupadas sin datos
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {displayBookings.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Voluntario / Talle</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Rol / Contacto</th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">Vianda</th>
                                                        {materials.length > 0 && (
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Materiales
                                                            </th>
                                                        )}
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Asistencia</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {displayBookings.map(booking => (
                                                        <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="text-sm font-bold text-gray-900">{booking.user?.fullName}</div>
                                                                    <span className="text-[10px] font-black bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded border border-primary-200">
                                                                        {booking.user?.tshirtSize || '-'}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[11px] text-gray-500 font-mono">DNI: {booking.user?.dni}</div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 mb-1">
                                                                    {booking.roleName}
                                                                </div>
                                                                <div className="text-[11px] text-gray-500 truncate max-w-[150px]" title={booking.user?.email}>
                                                                    {booking.user?.phone || booking.user?.email}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <button
                                                                    onClick={() => handleFoodStatusChange(booking.id, booking.foodDelivered)}
                                                                    className={`p-1.5 rounded-full transition-all ${booking.foodDelivered
                                                                        ? 'bg-orange-500 text-white shadow-sm ring-2 ring-orange-200'
                                                                        : 'bg-gray-100 text-gray-400 hover:bg-orange-100 hover:text-orange-500'
                                                                        }`}
                                                                    title={booking.foodDelivered ? 'Vianda entregada' : 'Marcar vianda'}
                                                                >
                                                                    <Utensils size={16} />
                                                                </button>
                                                            </td>
                                                            {materials.length > 0 && booking.user?.id && (
                                                                <td className="px-4 py-3">
                                                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                                        {materials.map(material => {
                                                                            const uid = booking.user!.id;
                                                                            const isDelivered = deliveredMaterials[uid]?.[material.id] ?? false;
                                                                            return (
                                                                                <button
                                                                                    key={material.id}
                                                                                    onClick={() => handleMaterialToggle(uid, material.id)}
                                                                                    title={`${material.name}: ${isDelivered ? 'Entregado ✓' : 'Pendiente'}`}
                                                                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border transition-all ${
                                                                                        isDelivered
                                                                                            ? 'bg-green-600 text-white border-green-700 shadow-sm'
                                                                                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                                                    }`}
                                                                                >
                                                                                    {getMaterialIcon(material)}
                                                                                    <span className="max-w-[40px] truncate">{material.name}</span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-3">
                                                                <div className="flex justify-center gap-1">
                                                                    <button
                                                                        onClick={() => handleAttendanceChange(booking.id, 'attended')}
                                                                        className={`p-1.5 rounded-lg transition-all ${booking.attendance === 'attended'
                                                                            ? 'bg-green-600 text-white shadow-md'
                                                                            : 'bg-gray-100 text-gray-300 hover:bg-green-50 hover:text-green-500'
                                                                            }`}
                                                                        title="Presente"
                                                                    >
                                                                        <CheckCircle size={20} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleAttendanceChange(booking.id, 'absent')}
                                                                        className={`p-1.5 rounded-lg transition-all ${booking.attendance === 'absent'
                                                                            ? 'bg-red-600 text-white shadow-md'
                                                                            : 'bg-gray-100 text-gray-300 hover:bg-red-50 hover:text-red-500'
                                                                            }`}
                                                                        title="Ausente"
                                                                    >
                                                                        <XCircle size={20} />
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
                                                    {/* Materials row - mobile */}
                                                    {materials.length > 0 && booking.user?.id && (
                                                        <div className="pl-2 mb-3">
                                                            <div className="text-xs font-semibold text-gray-400 uppercase mb-1.5">Materiales</div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {materials.map(material => {
                                                                    const uid = booking.user!.id;
                                                                    const isDelivered = deliveredMaterials[uid]?.[material.id] ?? false;
                                                                    return (
                                                                        <button
                                                                            key={material.id}
                                                                            onClick={() => handleMaterialToggle(uid, material.id)}
                                                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                                                                                isDelivered
                                                                                    ? 'bg-green-100 text-green-800 border-green-300 shadow-sm'
                                                                                    : 'bg-white text-gray-600 border-gray-300'
                                                                            }`}
                                                                        >
                                                                            {getMaterialIcon(material)}
                                                                            {material.name}
                                                                            {isDelivered && <CheckCircle size={11} className="text-green-600" />}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

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
                                                        <div className="text-sm text-gray-600 flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-gray-400 uppercase w-12">Talle:</span>
                                                            <span className="font-bold text-primary-700">{booking.user?.tshirtSize || '-'}</span>
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
                    }) : (
                        /* Flat List View */
                        <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                <div className="flex items-center gap-2 text-gray-700 font-medium">
                                    <Users size={18} className="text-primary-500" />
                                    <span>Listado General de Voluntarios</span>
                                </div>
                                <div className="text-sm text-gray-500">
                                    {shifts.reduce((acc, s) => acc + bookings.filter(b => b.shiftId === s.id && b.status !== 'cancelled').length, 0)} voluntarios en total
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Fecha/Hora</th>
                                            <th 
                                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                                onClick={() => {
                                                    setSortAlphabetically(true);
                                                    setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                                                }}
                                            >
                                                Voluntario {sortAlphabetically && (sortDir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol / Talle</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Asistencia</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {(() => {
                                            const allBookings = filteredShifts.flatMap(s => 
                                                bookings.filter(b => b.shiftId === s.id && b.status !== 'cancelled')
                                                    .map(b => ({ 
                                                        ...b, 
                                                        roleName: getRoleName(s.roleId),
                                                        shiftDate: s.date,
                                                        shiftTime: s.timeSlot
                                                    }))
                                            );

                                            const filteredBookings = searchTerm
                                                ? allBookings.filter(b => 
                                                    b.user?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                    b.user?.dni.includes(searchTerm)
                                                )
                                                : allBookings;

                                            const sortedBookings = [...filteredBookings].sort((a, b) => {
                                                if (sortAlphabetically) {
                                                    const cmp = (a.user?.fullName || '').localeCompare(b.user?.fullName || '');
                                                    return sortDir === 'asc' ? cmp : -cmp;
                                                }
                                                // Default sort by date/time
                                                const dateCompare = (a.shiftDate || '').localeCompare(b.shiftDate || '');
                                                if (dateCompare !== 0) return dateCompare;
                                                return (a.shiftTime || '').localeCompare(b.shiftTime || '');
                                            });

                                            return sortedBookings.length > 0 ? sortedBookings.map(booking => (
                                                <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900 font-medium">
                                                            {parseDateHelper(booking.shiftDate || '').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500">{booking.shiftTime}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm font-bold text-gray-900">{booking.user?.fullName}</div>
                                                        <div className="text-[11px] text-gray-500">DNI: {booking.user?.dni}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100 w-fit">
                                                                {booking.roleName}
                                                            </span>
                                                            <span className="text-[10px] font-black bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded border border-gray-200 w-fit">
                                                                Talle: {booking.user?.tshirtSize || '-'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="flex justify-center gap-1">
                                                            <button
                                                                onClick={() => handleAttendanceChange(booking.id, 'attended')}
                                                                className={`p-1.5 rounded-lg transition-all ${booking.attendance === 'attended' ? 'text-white bg-green-600 shadow-sm' : 'text-gray-300 bg-gray-100'}`}
                                                            >
                                                                <CheckCircle size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleAttendanceChange(booking.id, 'absent')}
                                                                className={`p-1.5 rounded-lg transition-all ${booking.attendance === 'absent' ? 'text-white bg-red-600 shadow-sm' : 'text-gray-300 bg-gray-100'}`}
                                                            >
                                                                <XCircle size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                                        No se encontraron voluntarios.
                                                    </td>
                                                </tr>
                                            );
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

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
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 print:hidden lg:hidden safe-area-bottom">
                
                {globalEventId && onClose && (
                    <button
                        onClick={onClose}
                        className="w-full flex items-center justify-center p-3 text-white font-medium bg-gray-800 hover:bg-gray-900"
                    >
                        ← Volver al listado
                    </button>
                )}

                {/* Mobile Menu Dropup */}
                {showMobileMenu && (
                    <div className="border-b border-gray-200 bg-gray-50 animate-in slide-in-from-bottom duration-200">
                        <button
                            onClick={() => {
                                setShowVolunteerPortal(true);
                                setShowMobileMenu(false);
                            }}
                            className="flex items-center w-full px-6 py-4 text-gray-700 hover:bg-gray-100 border-b border-gray-200"
                        >
                            <div className="p-2 rounded-full mr-3" style={{ backgroundColor: '#e6f2d0' }}>
                                <Calendar size={20} style={{ color: '#8CB83E' }} />
                            </div>
                            <span className="font-medium">Portal de Voluntario</span>
                        </button>
                        <button
                            onClick={() => {
                                const evt = events.find(e => e.id === selectedEventId);
                                if (evt) window.open(`${window.location.href.split('#')[0]}#/${evt.slug}/stand-monitor`, '_blank');
                                setShowMobileMenu(false);
                            }}
                            className="flex items-center w-full px-6 py-4 text-gray-700 hover:bg-gray-100 border-b border-gray-200"
                        >
                            <div className="p-2 rounded-full mr-3" style={{ backgroundColor: '#dbeafe' }}>
                                <Monitor size={20} style={{ color: '#0077C5' }} />
                            </div>
                            <span className="font-medium">Monitor de Stand</span>
                        </button>
                        <button
                            onClick={() => {
                                const evt = events.find(e => e.id === selectedEventId);
                                if (evt) window.open(`${window.location.href.split('#')[0]}#/${evt.slug}/stand-metrics`, '_blank');
                                setShowMobileMenu(false);
                            }}
                            className="flex items-center w-full px-6 py-4 text-gray-700 hover:bg-gray-100 border-b border-gray-200"
                        >
                            <div className="p-2 rounded-full mr-3" style={{ backgroundColor: '#e6f2d0' }}>
                                <BarChart2 size={20} style={{ color: '#557326' }} />
                            </div>
                            <span className="font-medium">Métricas del Stand</span>
                        </button>
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

            </div>

            {/* Volunteer Portal Fullscreen Modal */}
            {showVolunteerPortal && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-white">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shadow-sm bg-white flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e6f2d0' }}>
                                <Calendar size={15} style={{ color: '#8CB83E' }} />
                            </div>
                            <span className="font-semibold text-gray-800 text-sm">
                                Portal de Voluntario
                                {events.find(e => e.id === selectedEventId) && (
                                    <span className="ml-2 text-gray-500 font-normal">— {events.find(e => e.id === selectedEventId)?.nombre}</span>
                                )}
                            </span>
                        </div>
                        <button
                            onClick={() => setShowVolunteerPortal(false)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
                        >
                            <X size={16} />
                            Volver al panel
                        </button>
                    </div>
                    {/* Portal Content */}
                    <div className="flex-1 overflow-y-auto">
                        <VolunteerPortal
                            user={user}
                            onLogout={onLogout}
                            eventId={selectedEventId}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoordinatorDashboard;
