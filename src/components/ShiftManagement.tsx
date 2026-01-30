import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, Users, Tag, AlertCircle, Edit2, Copy, Shield, Search } from 'lucide-react';
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
    const [searchTerm, setSearchTerm] = useState('');

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
        if (!confirm('¿Estás seguro de eliminar este turno? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            await mockApi.deleteShift(shiftId);
            toast.success('Turno eliminado');
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Error al eliminar turno');
        }
    };

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

    // Filter shifts
    const filteredShifts = shifts.filter(shift => {
        if (!searchTerm) return true;
        const roleName = getRoleName(shift.roleId).toLowerCase();
        return roleName.includes(searchTerm.toLowerCase());
    });

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
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium shadow-md"
                >
                    <Plus size={18} />
                    Agregar Turno
                </button>
            </div>

            {/* Search Filter */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={18} className="text-gray-400" />
                </div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar turno por nombre de rol..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition duration-150 ease-in-out"
                />
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
                    <p className="text-gray-500 mb-2">No hay turnos creados para este evento</p>
                    <p className="text-sm text-gray-400">Haz clic en "Agregar Turno" para comenzar</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {sortedDates.map(date => (
                        <div key={date} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Calendar size={18} className="text-gray-600" />
                                    <h4 className="font-semibold text-gray-900 capitalize">{getDateDayName(date)}</h4>
                                    <span className="text-sm text-gray-500">({date})</span>
                                </div>
                                <button
                                    onClick={() => handleOpenCloneModal(date)}
                                    className="text-primary-600 hover:text-primary-800 text-sm font-medium flex items-center gap-1 hover:underline"
                                    title="Copiar todos los turnos de este día a otra fecha"
                                >
                                    <Copy size={14} />
                                    Duplicar Día
                                </button>
                            </div>
                            <div className="divide-y divide-gray-200">
                                {shiftsByDate[date].map(shift => (
                                    <div key={shift.id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div className="flex items-center gap-2">
                                                    <Clock size={16} className="text-gray-400" />
                                                    <span className="font-medium text-gray-900">{shift.timeSlot}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Tag size={16} className="text-gray-400" />
                                                    <span className="text-sm text-gray-700">{getRoleName(shift.roleId)}</span>
                                                    {doesRoleRequireApproval(shift.roleId) && (
                                                        <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 flex items-center" title="Este rol requiere aprobación por un administrador">
                                                            <Shield size={10} className="mr-1" />
                                                            REQ. APROB
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Users size={16} className="text-gray-400" />
                                                <span className="text-sm text-gray-700">
                                                    {shift.availableVacancies} / {shift.totalVacancies} disponibles
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full ${shift.availableVacancies === 0 ? 'bg-red-500' :
                                                            shift.availableVacancies < shift.totalVacancies * 0.3 ? 'bg-yellow-500' :
                                                                'bg-green-500'
                                                            }`}
                                                        style={{ width: `${((shift.totalVacancies - shift.availableVacancies) / shift.totalVacancies) * 100}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-xs text-gray-500">
                                                    {Math.round(((shift.totalVacancies - shift.availableVacancies) / shift.totalVacancies) * 100)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 ml-4">
                                            <button
                                                onClick={() => openEditModal(shift)}
                                                className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                title="Editar turno"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteShift(shift.id)}
                                                disabled={shift.availableVacancies < shift.totalVacancies}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title={shift.availableVacancies < shift.totalVacancies ? 'No se puede eliminar un turno con reservas' : 'Eliminar turno'}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Clone Day Modal */}
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
