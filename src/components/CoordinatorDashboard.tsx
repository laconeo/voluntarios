import React, { useState, useEffect } from 'react';
import { mockApi } from '../services/mockApiService';
import type { User, Event, Shift, Booking, Role } from '../types';
import { Download, CheckCircle, XCircle, Clock, Calendar, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CoordinatorDashboardProps {
    user: User;
    onLogout: () => void;
}

const CoordinatorDashboard: React.FC<CoordinatorDashboardProps> = ({ user, onLogout }) => {
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const allEvents = await mockApi.getAllEvents();
                setEvents(allEvents);
                if (allEvents.length > 0) {
                    setSelectedEventId(allEvents[0].id);
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
    }, []);

    useEffect(() => {
        if (selectedEventId) {
            loadEventData(selectedEventId);
        }
    }, [selectedEventId]);

    const loadEventData = async (eventId: string) => {
        setIsLoading(true);
        try {
            const eventShifts = await mockApi.getShiftsByEvent(eventId);

            // Filtrar solo los turnos donde este coordinador está asignado
            const myShifts = eventShifts.filter(shift =>
                shift.coordinatorIds.includes(user.id)
            );

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
        try {
            await mockApi.updateBookingAttendance(bookingId, status);
            setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, attendance: status } : b));
            toast.success('Asistencia actualizada');
        } catch (error) {
            toast.error('Error al actualizar asistencia');
        }
    };

    const exportToCSV = () => {
        const headers = ['Fecha', 'Horario', 'Rol', 'Nombre', 'DNI', 'Email', 'Teléfono', 'Estado', 'Asistencia'];
        const csvRows = [headers.join(',')];

        shifts.forEach(shift => {
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

    const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Desconocido';

    const filteredShifts = shifts.filter(shift => {
        if (!searchTerm) return true;
        const shiftBookings = bookings.filter(b => b.shiftId === shift.id);
        return shiftBookings.some(b =>
            b.user?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.user?.dni.includes(searchTerm)
        );
    });

    if (isLoading) return <div className="p-8 text-center">Cargando...</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">Panel de Coordinador</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-600">Hola, {user.fullName}</span>
                        <button onClick={onLogout} className="text-sm text-red-600 hover:text-red-800">Cerrar Sesión</button>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8">
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="w-full sm:w-64">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar Evento</label>
                        <select
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        >
                            {events.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <div className="relative flex-grow sm:flex-grow-0">
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
                        <button
                            onClick={exportToCSV}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                        >
                            <Download size={18} className="mr-2" />
                            Exportar Excel
                        </button>
                    </div>
                </div>

                <div className="space-y-6">
                    {filteredShifts.map(shift => {
                        const shiftBookings = bookings.filter(b => b.shiftId === shift.id && b.status === 'confirmed');
                        if (shiftBookings.length === 0 && searchTerm) return null; // Hide empty shifts when searching

                        const roleName = getRoleName(shift.roleId);
                        const dateStr = new Date(shift.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });

                        return (
                            <div key={shift.id} className="mb-6 last:mb-0">
                                {/* Desktop View */}
                                <div className="hidden sm:block bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center text-gray-700 font-medium">
                                                <Calendar size={18} className="mr-2 text-primary-500" />
                                                {new Date(shift.date).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center text-gray-700 font-medium">
                                                <Clock size={18} className="mr-2 text-primary-500" />
                                                {shift.timeSlot}
                                            </div>
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                                                {roleName}
                                            </span>
                                        </div>
                                        <span className="text-sm text-gray-500">
                                            {shiftBookings.length} voluntarios confirmados
                                        </span>
                                    </div>

                                    {shiftBookings.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Voluntario</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asistencia</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {shiftBookings.map(booking => (
                                                        <tr key={booking.id}>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="text-sm font-medium text-gray-900">{booking.user?.fullName}</div>
                                                                <div className="text-sm text-gray-500">DNI: {booking.user?.dni}</div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="text-sm text-gray-900">{booking.user?.email}</div>
                                                                <div className="text-sm text-gray-500">{booking.user?.phone}</div>
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
                                            No hay voluntarios confirmados para este turno.
                                        </div>
                                    )}
                                </div>

                                {/* Mobile View */}
                                <div className="sm:hidden">
                                    <div className="bg-gray-100 rounded-xl p-4 mb-3 shadow-sm border border-gray-200 sticky top-16 z-10 backdrop-blur-md bg-opacity-95">
                                        <div className="flex justify-between items-start mb-1">
                                            <div>
                                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                    <Clock size={16} className="text-primary-600" />
                                                    {shift.timeSlot}
                                                </h3>
                                                <p className="text-sm text-gray-600 capitalize">{dateStr}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="inline-block px-2 py-0.5 bg-white text-primary-700 text-xs font-bold rounded border border-primary-100 shadow-sm mb-1">
                                                    {roleName}
                                                </span>
                                                <p className="text-xs text-gray-500 font-medium">
                                                    {shiftBookings.length} Voluntarios
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pl-2">
                                        {shiftBookings.length > 0 ? (
                                            shiftBookings.map(booking => (
                                                <div key={booking.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 relative overflow-hidden">
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${booking.attendance === 'attended' ? 'bg-green-500' : booking.attendance === 'absent' ? 'bg-red-500' : 'bg-gray-200'}`}></div>
                                                    <div className="flex justify-between items-start pl-2 mb-3">
                                                        <div>
                                                            <div className="font-bold text-gray-900">{booking.user?.fullName}</div>
                                                            <div className="text-xs text-gray-500 font-mono mt-0.5">DNI: {booking.user?.dni}</div>
                                                        </div>
                                                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm">
                                                            {booking.user?.fullName.charAt(0)}
                                                        </div>
                                                    </div>

                                                    <div className="pl-2 grid grid-cols-1 gap-1 mb-4">
                                                        <div className="text-sm text-gray-600 flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-gray-400 uppercase w-12">Email:</span>
                                                            <span className="truncate">{booking.user?.email}</span>
                                                        </div>
                                                        <div className="text-sm text-gray-600 flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-gray-400 uppercase w-12">Tel:</span>
                                                            <span>{booking.user?.phone}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2 pl-2">
                                                        <button
                                                            onClick={() => handleAttendanceChange(booking.id, 'attended')}
                                                            className={`flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${booking.attendance === 'attended'
                                                                ? 'bg-green-100 text-green-700 shadow-inner'
                                                                : 'bg-gray-50 text-gray-600 hover:bg-green-50 hover:text-green-600 border border-gray-100'
                                                                }`}
                                                        >
                                                            <CheckCircle size={16} className={booking.attendance === 'attended' ? 'fill-current' : ''} />
                                                            Presente
                                                        </button>
                                                        <button
                                                            onClick={() => handleAttendanceChange(booking.id, 'absent')}
                                                            className={`flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${booking.attendance === 'absent'
                                                                ? 'bg-red-100 text-red-700 shadow-inner'
                                                                : 'bg-gray-50 text-gray-600 hover:bg-red-50 hover:text-red-600 border border-gray-100'
                                                                }`}
                                                        >
                                                            <XCircle size={16} className={booking.attendance === 'absent' ? 'fill-current' : ''} />
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

                    {filteredShifts.length === 0 && !searchTerm && (
                        <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-200">
                            <div className="max-w-md mx-auto px-4">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">No tienes turnos asignados</h3>
                                <p className="text-gray-600 text-sm">
                                    Actualmente no estás asignado como  coordinador en ningún turno de este evento.
                                </p>
                                <p className="text-gray-500 text-xs mt-2">
                                    Contacta al administrador si crees que esto es un error.
                                </p>
                            </div>
                        </div>
                    )}

                    {filteredShifts.length === 0 && searchTerm && (
                        <div className="text-center py-12 text-gray-500">
                            No se encontraron turnos que coincidan con la búsqueda.
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default CoordinatorDashboard;
