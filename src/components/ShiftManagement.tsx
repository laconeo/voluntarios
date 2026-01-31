import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, Users, Tag, AlertCircle, Edit2, Copy, Shield, Search, Filter, X } from 'lucide-react';
import { mockApi } from '../services/mockApiService';
import type { Shift, Role } from '../types';
import { toast } from 'react-hot-toast';

interface ShiftManagementProps {
    eventId: string;
    eventStartDate: string;
    eventEndDate: string;
}

const ShiftManagement: React.FC<ShiftManagementProps> = ({ eventId, eventStartDate, eventEndDate }) => {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingShift, setEditingShift] = useState<Shift | null>(null);
    const [showCloneModal, setShowCloneModal] = useState(false);
    const [cloneSourceDate, setCloneSourceDate] = useState('');
    const [cloneTargetDate, setCloneTargetDate] = useState('');
    const [isCloning, setIsCloning] = useState(false);
    const [showBulkCloneModal, setShowBulkCloneModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set());

    // Filters State
    const [filterDate, setFilterDate] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterTime, setFilterTime] = useState('');
    const [showDuplicates, setShowDuplicates] = useState(false);

    const [formData, setFormData] = useState({
        date: '',
        startTime: '13:00',
        endTime: '16:00',
        roleId: '',
        totalVacancies: 10,
    });

    useEffect(() => {
        fetchData();
    }, [eventId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [shiftsData, rolesData] = await Promise.all([
                mockApi.getShiftsByEvent(eventId),
                mockApi.getRolesByEvent(eventId)
            ]);
            setShifts(shiftsData);
            setRoles(rolesData);
            setSelectedShifts(new Set()); // Clear selection
        } catch (error) {
            console.error('Error al cargar datos:', error);
            toast.error('Error al cargar turnos y roles');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenCloneModal = (sourceDate: string) => {
        setCloneSourceDate(sourceDate);
        setCloneTargetDate('');
        setShowCloneModal(true);
    };

    const handleCloneDay = async () => {
        if (!cloneTargetDate) {
            toast.error('Selecciona una fecha destino');
            return;
        }

        if (cloneTargetDate < eventStartDate || cloneTargetDate > eventEndDate) {
            toast.error(`La fecha debe estar entre ${eventStartDate} y ${eventEndDate}`);
            return;
        }

        if (cloneTargetDate === cloneSourceDate) {
            toast.error('La fecha destino debe ser diferente a la origen');
            return;
        }

        setIsCloning(true);
        try {
            // Get shifts from source date
            const sourceShifts = shifts.filter(s => s.date === cloneSourceDate);

            // Create duplicates
            const promises = sourceShifts.map(shift => {
                const shiftData: Omit<Shift, 'id'> = {
                    eventId,
                    date: cloneTargetDate,
                    timeSlot: shift.timeSlot,
                    roleId: shift.roleId,
                    totalVacancies: shift.totalVacancies,
                    availableVacancies: shift.totalVacancies, // Reset vacancies
                    coordinatorIds: [] // Do not copy assigned coordinators
                };
                return mockApi.createShift(shiftData);
            });

            await Promise.all(promises);

            toast.success(`Se duplicaron ${sourceShifts.length} turnos exitosamente`);
            setShowCloneModal(false);
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error('Error al duplicar turnos');
        } finally {
            setIsCloning(false);
        }
    };

    const handleBulkClone = async () => {
        if (!cloneTargetDate) {
            toast.error('Selecciona una fecha destino');
            return;
        }

        if (cloneTargetDate < eventStartDate || cloneTargetDate > eventEndDate) {
            toast.error(`La fecha debe estar entre ${eventStartDate} y ${eventEndDate}`);
            return;
        }

        setIsCloning(true);
        try {
            const shiftsToClone = shifts.filter(s => selectedShifts.has(s.id));

            const promises = shiftsToClone.map(shift => {
                // Check if we are cloning to the same day (valid use case? maybe, but usually duplicates)
                // But let's allow it, user might want to double capacity quickly

                const shiftData: Omit<Shift, 'id'> = {
                    eventId,
                    date: cloneTargetDate,
                    timeSlot: shift.timeSlot,
                    roleId: shift.roleId,
                    totalVacancies: shift.totalVacancies,
                    availableVacancies: shift.totalVacancies,
                    coordinatorIds: []
                };
                return mockApi.createShift(shiftData);
            });

            await Promise.all(promises);

            toast.success(`Se duplicaron ${shiftsToClone.length} turnos exitosamente`);
            setShowBulkCloneModal(false);

            // Clear filters so user can see the new shifts (which are likely not duplicates yet)
            setShowDuplicates(false);
            setFilterDate(cloneTargetDate);

            setSelectedShifts(new Set());
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error('Error al duplicar turnos seleccionados');
        } finally {
            setIsCloning(false);
        }
    };

    const openCreateModal = () => {
        setEditingShift(null);
        setFormData({
            date: '',
            startTime: '13:00',
            endTime: '16:00',
            roleId: '',
            totalVacancies: 10,
        });
        setShowModal(true);
    };

    const openEditModal = (shift: Shift) => {
        setEditingShift(shift);
        const [start, end] = shift.timeSlot.split('-');
        setFormData({
            date: shift.date,
            startTime: start ? start.trim() : '13:00',
            endTime: end ? end.trim() : '16:00',
            roleId: shift.roleId,
            totalVacancies: shift.totalVacancies,
        });
        // Note: totalVacancies edit logic might need refinement if current bookings exist, but assuming simple edit for now
        setFormData(prev => ({ ...prev, totalVacancies: shift.totalVacancies }));
        setShowModal(true);
    };

    const handleSaveShift = async () => {
        if (!formData.date || !formData.roleId) {
            toast.error('Por favor completa todos los campos');
            return;
        }

        // Validar que la fecha esté dentro del rango del evento
        if (formData.date < eventStartDate || formData.date > eventEndDate) {
            toast.error(`La fecha debe estar entre ${eventStartDate} y ${eventEndDate}`);
            return;
        }

        try {
            const timeSlot = `${formData.startTime} - ${formData.endTime}`;

            if (editingShift) {
                // Ensure totalVacancies is a number
                const total = Number(formData.totalVacancies);
                await mockApi.updateShift(editingShift.id, {
                    date: formData.date,
                    timeSlot,
                    roleId: formData.roleId,
                    totalVacancies: total,
                });
                toast.success('Turno actualizado exitosamente');
            } else {
                const shiftData: Omit<Shift, 'id'> = {
                    eventId,
                    date: formData.date,
                    timeSlot,
                    roleId: formData.roleId,
                    totalVacancies: Number(formData.totalVacancies),
                    availableVacancies: Number(formData.totalVacancies),
                    coordinatorIds: []
                };
                await mockApi.createShift(shiftData);
                toast.success('Turno creado exitosamente');
            }

            setShowModal(false);
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Error al guardar turno');
        }
    };

    const handleDeleteShift = async (shiftId: string) => {
        if (!confirm('¿Estás seguro de eliminar este turno? Si tiene inscripciones, estas serán canceladas.')) {
            return;
        }

        try {
            await mockApi.deleteShift(shiftId, true);
            toast.success('Turno eliminado');
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Error al eliminar turno');
        }
    };

    const handleToggleShift = (shiftId: string) => {
        const newSelected = new Set(selectedShifts);
        if (newSelected.has(shiftId)) {
            newSelected.delete(shiftId);
        } else {
            newSelected.add(shiftId);
        }
        setSelectedShifts(newSelected);
    };

    const handleSelectAll = (dateShifts: Shift[]) => {
        const newSelected = new Set(selectedShifts);
        const allSelected = dateShifts.every(s => newSelected.has(s.id));

        if (allSelected) {
            dateShifts.forEach(s => newSelected.delete(s.id));
        } else {
            dateShifts.forEach(s => newSelected.add(s.id));
        }
        setSelectedShifts(newSelected);
    };

    const handleBulkDelete = async () => {
        if (selectedShifts.size === 0) return;

        if (!confirm(`¿Estás seguro de eliminar ${selectedShifts.size} turnos seleccionados? Esta acción cancelará las inscripciones asociadas.`)) {
            return;
        }

        setIsLoading(true);
        try {
            // Sequential delete to handle potential errors individually? Or Promise.all
            // Promise.all is faster but might hit rate limits. 50 parallel reqs usually fine for Supabase.
            const promises = Array.from(selectedShifts).map(id => mockApi.deleteShift(id, true));
            await Promise.all(promises);

            toast.success('Turnos eliminados correctamente');
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error('Hubo errores al eliminar algunos turnos');
            fetchData(); // Refresh to see what's left
        } finally {
            setIsLoading(false);
        }
    };

    // Derived Data for Filters
    const uniqueDates = Array.from(new Set(shifts.map(s => s.date))).sort();
    const uniqueTimes = Array.from(new Set(shifts.map(s => s.timeSlot))).sort();

    // Logic to identify duplicates (same date, time, role, and vacancies)
    const duplicateShiftIds = React.useMemo(() => {
        const groups: Record<string, string[]> = {};
        shifts.forEach(s => {
            const key = `${s.date}|${s.timeSlot}|${s.roleId}|${s.totalVacancies}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(s.id);
        });
        const ids = new Set<string>();
        Object.values(groups).forEach(group => {
            if (group.length > 1) {
                group.forEach(id => ids.add(id));
            }
        });
        return ids;
    }, [shifts]);

    const getRoleName = (roleId: string) => {
        const role = roles.find(r => r.id === roleId);
        return role ? role.name : 'Rol desconocido';
    };

    const getDateDayName = (dateStr: string) => {
        const date = new Date(dateStr + 'T12:00:00');
        return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const doesRoleRequireApproval = (roleId: string) => {
        return roles.find(r => r.id === roleId)?.requiresApproval;
    };


    // Filter shifts logic
    const filteredShifts = shifts.filter(shift => {
        // 1. Text Search
        if (searchTerm) {
            const roleName = getRoleName(shift.roleId).toLowerCase();
            if (!roleName.includes(searchTerm.toLowerCase())) return false;
        }

        // 2. Show Duplicates Mode
        if (showDuplicates) {
            if (!duplicateShiftIds.has(shift.id)) return false;
        }

        // 3. Dropdown Filters
        if (filterDate && shift.date !== filterDate) return false;
        if (filterRole && shift.roleId !== filterRole) return false;
        if (filterTime && shift.timeSlot !== filterTime) return false;

        return true;
    });

    // Clear filters helper
    const clearFilters = () => {
        setFilterDate('');
        setFilterRole('');
        setFilterTime('');
        setSearchTerm('');
        setShowDuplicates(false);
    };

    // Agrupar turnos por fecha
    const shiftsByDate = filteredShifts.reduce((acc, shift) => {
        if (!acc[shift.date]) {
            acc[shift.date] = [];
        }
        acc[shift.date].push(shift);
        return acc;
    }, {} as Record<string, Shift[]>);

    const sortedDates = Object.keys(shiftsByDate).sort();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                <span className="ml-3 text-gray-600">Cargando turnos...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Gestión de Turnos</h3>
                    <p className="text-sm text-gray-600">
                        Total de turnos: <span className="font-semibold text-gray-900">{filteredShifts.length}</span>
                        {' • '}
                        Vacantes totales: <span className="font-semibold text-gray-900">
                            {filteredShifts.reduce((sum, s) => sum + s.totalVacancies, 0)}
                        </span>
                    </p>
                </div>
                <div className="flex gap-2">
                    {selectedShifts.size > 0 && (
                        <>
                            <button
                                onClick={() => {
                                    setCloneTargetDate('');
                                    setShowBulkCloneModal(true);
                                }}
                                className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 font-medium shadow-sm transition-colors"
                            >
                                <Copy size={18} />
                                Duplicar ({selectedShifts.size})
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 font-medium shadow-sm transition-colors"
                            >
                                <Trash2 size={18} />
                                Eliminar ({selectedShifts.size})
                            </button>
                        </>
                    )}
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium shadow-md"
                    >
                        <Plus size={18} />
                        Agregar Turno
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                <div className="flex flex-wrap gap-3">
                    {/* Date Filter */}
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Fecha</label>
                        <select
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="w-full text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                        >
                            <option value="">Todas las fechas</option>
                            {uniqueDates.map(date => (
                                <option key={date} value={date}>{date} ({getDateDayName(date)})</option>
                            ))}
                        </select>
                    </div>

                    {/* Time Filter */}
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Horario</label>
                        <select
                            value={filterTime}
                            onChange={(e) => setFilterTime(e.target.value)}
                            className="w-full text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                        >
                            <option value="">Todos los horarios</option>
                            {uniqueTimes.map(time => (
                                <option key={time} value={time}>{time}</option>
                            ))}
                        </select>
                    </div>

                    {/* Role Filter */}
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Rol</label>
                        <select
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                            className="w-full text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                        >
                            <option value="">Todos los roles</option>
                            {roles.map(role => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search Text */}
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Buscar</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                <Search size={14} className="text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Nombre rol..."
                                className="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md leading-tight bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Duplicates Toggle & Clear */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <label className="inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showDuplicates}
                                onChange={(e) => setShowDuplicates(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                            <span className="ms-3 text-sm font-medium text-gray-700">Ver Solo Duplicados ({duplicateShiftIds.size} encontrados)</span>
                        </label>
                        {showDuplicates && (
                            <span className="ml-2 text-xs text-gray-500 hidden sm:inline">(Misma fecha, hora, rol y vacantes)</span>
                        )}
                    </div>

                    {(filterDate || filterRole || filterTime || searchTerm || showDuplicates) && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                            <X size={12} className="mr-1" />
                            Limpiar filtros
                        </button>
                    )}
                </div>
            </div>

            {/* Info Alert */}
            {roles.length === 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="text-sm text-yellow-700">
                                <strong>Nota:</strong> Necesitas crear roles primero antes de poder agregar turnos.
                                Los roles definen las tareas que los voluntarios realizarán en cada turno.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Shifts List */}
            {sortedDates.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-2">No hay turnos creados que coincidan con los filtros</p>
                    <p className="text-sm text-gray-400">Intenta limpiar los filtros o agregar nuevos turnos</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {sortedDates.map(date => {
                        const dateShifts = shiftsByDate[date];
                        const allSelected = dateShifts.length > 0 && dateShifts.every(s => selectedShifts.has(s.id));

                        // Group by TimeSlot
                        const shiftsByTime: Record<string, Shift[]> = {};
                        dateShifts.forEach(s => {
                            if (!shiftsByTime[s.timeSlot]) shiftsByTime[s.timeSlot] = [];
                            shiftsByTime[s.timeSlot].push(s);
                        });
                        const sortedTimeSlots = Object.keys(shiftsByTime).sort();

                        return (
                            <div key={date} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                                {/* Date Header */}
                                <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center sticky top-0 z-10">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={() => handleSelectAll(dateShifts)}
                                            className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                                            title="Seleccionar todos los turnos del día"
                                        />
                                        <div className="flex items-center gap-2">
                                            <Calendar size={20} className="text-gray-700" />
                                            <h4 className="text-lg font-bold text-gray-900 capitalize">{getDateDayName(date)}</h4>
                                            <span className="text-sm text-gray-500 font-medium">({date})</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-200 px-2 py-1 rounded">
                                            {dateShifts.length} Turnos
                                        </span>
                                        <button
                                            onClick={() => handleOpenCloneModal(date)}
                                            className="text-primary-600 hover:text-primary-800 text-sm font-medium flex items-center gap-1 hover:underline"
                                            title="Copiar todos los turnos de este día a otra fecha"
                                        >
                                            <Copy size={14} />
                                            Duplicar Día
                                        </button>
                                    </div>
                                </div>

                                <div className="divide-y divide-gray-200">
                                    {sortedTimeSlots.map(timeSlot => (
                                        <div key={timeSlot} className="relative">
                                            {/* Time Slot Header Marker */}
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-200"></div>

                                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                                <Clock size={16} className="text-primary-600" />
                                                <span className="font-bold text-gray-800 text-sm">{timeSlot}</span>
                                            </div>

                                            <div className="divide-y divide-gray-100">
                                                {shiftsByTime[timeSlot].map(shift => (
                                                    <div key={shift.id} className="p-4 hover:bg-yellow-50 transition-colors pl-6 border-l-4 border-transparent hover:border-yellow-200">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3 mr-4">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedShifts.has(shift.id)}
                                                                    onChange={() => handleToggleShift(shift.id)}
                                                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                                                                />
                                                            </div>
                                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                                                {/* Role Info */}
                                                                <div className="flex items-center gap-2">
                                                                    <Tag size={16} className="text-gray-400" />
                                                                    <span className="font-medium text-gray-800">{getRoleName(shift.roleId)}</span>
                                                                    {doesRoleRequireApproval(shift.roleId) && (
                                                                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 flex items-center" title="Requiere aprobación">
                                                                            <Shield size={10} className="mr-1" />
                                                                            REQ
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Occupancy Text */}
                                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                                    <Users size={16} className="text-gray-400" />
                                                                    <span>
                                                                        {shift.totalVacancies - shift.availableVacancies} ocupados / <strong>{shift.totalVacancies}</strong>
                                                                    </span>
                                                                </div>

                                                                {/* Progress Bar */}
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex-1 bg-gray-200 rounded-full h-2.5 w-full min-w-[100px]">
                                                                        <div
                                                                            className={`h-2.5 rounded-full transition-all duration-300 ${shift.availableVacancies === 0 ? 'bg-red-500' :
                                                                                shift.availableVacancies < shift.totalVacancies * 0.3 ? 'bg-yellow-500' :
                                                                                    'bg-green-500'
                                                                                }`}
                                                                            style={{ width: `${((shift.totalVacancies - shift.availableVacancies) / shift.totalVacancies) * 100}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="text-xs font-medium text-gray-500 w-8 text-right">
                                                                        {Math.round(((shift.totalVacancies - shift.availableVacancies) / shift.totalVacancies) * 100)}%
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Actions */}
                                                            <div className="flex gap-1 ml-6 border-l border-gray-200 pl-4 items-center">
                                                                <button
                                                                    onClick={() => openEditModal(shift)}
                                                                    className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                                                                    title="Editar turno"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteShift(shift.id)}
                                                                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                    title='Eliminar turno'
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Clone Day Modal, Add/Edit Shift Modal ... (existing code) */}
            {
                showCloneModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
                            <h3 className="text-xl font-serif font-bold text-gray-900 mb-4">
                                Duplicar Día
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                                Se copiarán todos los turnos del día <strong>{cloneSourceDate}</strong> a la nueva fecha seleccionada.
                            </p>

                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha Destino</label>
                                <input
                                    type="date"
                                    value={cloneTargetDate}
                                    onChange={(e) => setCloneTargetDate(e.target.value)}
                                    min={eventStartDate}
                                    max={eventEndDate}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowCloneModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                                    disabled={isCloning}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCloneDay}
                                    disabled={!cloneTargetDate || isCloning}
                                    className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isCloning ? 'Copiando...' : 'Confirmar Copia'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Bulk Clone Modal */}
            {
                showBulkCloneModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
                            <h3 className="text-xl font-serif font-bold text-gray-900 mb-4">
                                Duplicar Selección
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                                Se copiarán <strong>{selectedShifts.size} turnos seleccionados</strong> a la nueva fecha.
                            </p>

                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha Destino</label>
                                <input
                                    type="date"
                                    value={cloneTargetDate}
                                    onChange={(e) => setCloneTargetDate(e.target.value)}
                                    min={eventStartDate}
                                    max={eventEndDate}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowBulkCloneModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                                    disabled={isCloning}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleBulkClone}
                                    disabled={!cloneTargetDate || isCloning}
                                    className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isCloning ? 'Copiando...' : 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add/Edit Shift Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
                            <h3 className="text-xl font-serif font-bold text-gray-900 mb-4">
                                {editingShift ? 'Editar Turno' : 'Agregar Nuevo Turno'}
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha *</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        min={eventStartDate}
                                        max={eventEndDate}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Rango permitido: {eventStartDate} a {eventEndDate}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Hora Inicio *</label>
                                        <input
                                            type="time"
                                            value={formData.startTime}
                                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Hora Fin *</label>
                                        <input
                                            type="time"
                                            value={formData.endTime}
                                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Rol *</label>
                                    <select
                                        value={formData.roleId}
                                        onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="">Selecciona un rol</option>
                                        {roles.map(role => (
                                            <option key={role.id} value={role.id}>{role.name}</option>
                                        ))}
                                    </select>
                                    {roles.length === 0 && (
                                        <p className="text-xs text-red-500 mt-1">
                                            No hay roles disponibles. Crea roles primero.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Cantidad de Voluntarios *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={formData.totalVacancies}
                                        onChange={(e) => setFormData({ ...formData, totalVacancies: parseInt(e.target.value) || 1 })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Número de voluntarios necesarios para este turno
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveShift}
                                    disabled={!formData.date || !formData.roleId || roles.length === 0}
                                    className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {editingShift ? 'Guardar Cambios' : 'Crear Turno'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ShiftManagement;
