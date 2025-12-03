import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, Download, Mail, Phone, Edit2, X, Save } from 'lucide-react';
import { mockApi } from '../services/mockApiService';
import type { User, Booking } from '../types';
import { toast } from 'react-hot-toast';

interface EventVolunteersListProps {
    eventId: string;
}

const EventVolunteersList: React.FC<EventVolunteersListProps> = ({ eventId }) => {
    const [volunteers, setVolunteers] = useState<User[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('todos');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => {
        fetchVolunteers();
    }, [eventId]);

    const fetchVolunteers = async () => {
        setIsLoading(true);
        try {
            const [allUsers, eventBookings] = await Promise.all([
                mockApi.getAllUsers(),
                mockApi.getBookingsByEvent(eventId)
            ]);

            // Filtrar solo usuarios que tienen bookings en este evento
            const userIdsInEvent = new Set(eventBookings.map(b => b.userId));
            const eventVolunteers = allUsers.filter(u => userIdsInEvent.has(u.id));

            setVolunteers(eventVolunteers);
            setBookings(eventBookings);
        } catch (error) {
            console.error('Error al cargar voluntarios:', error);
            toast.error('Error al cargar voluntarios del evento');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditUser = (user: User) => {
        setEditingUser({ ...user });
        setShowEditModal(true);
    };

    const handleSaveUser = async () => {
        if (!editingUser) return;

        try {
            await mockApi.updateUser(editingUser);
            toast.success('Usuario actualizado correctamente');
            setShowEditModal(false);
            setEditingUser(null);
            fetchVolunteers();
        } catch (error: any) {
            toast.error(error.message || 'Error al actualizar usuario');
        }
    };

    const exportToCSV = () => {
        const headers = ['DNI', 'Nombre', 'Email', 'Teléfono', 'Rol', 'Turnos Asignados', 'Estado'];
        const rows = filteredVolunteers.map(v => {
            const userBookings = bookings.filter(b => b.userId === v.id);
            return [
                v.dni,
                v.fullName,
                v.email,
                v.phone,
                getRoleLabel(v.role),
                userBookings.length.toString(),
                v.status || 'active'
            ];
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `voluntarios_evento_${eventId}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        toast.success('Exportación completada');
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
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Voluntarios del Evento</h3>
                    <p className="text-sm text-gray-600">
                        Total de voluntarios registrados: <span className="font-semibold text-gray-900">{volunteers.length}</span>
                    </p>
                </div>
                <button
                    onClick={exportToCSV}
                    disabled={filteredVolunteers.length === 0}
                    className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download size={18} />
                    Exportar CSV
                </button>
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

            {/* Volunteers Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Voluntario
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Contacto
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Rol
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Turnos
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Estado
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredVolunteers.map((volunteer) => {
                            const userBookings = bookings.filter(b => b.userId === volunteer.id);
                            return (
                                <tr key={volunteer.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                                                <span className="text-primary-700 font-semibold">
                                                    {volunteer.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                </span>
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{volunteer.fullName}</div>
                                                <div className="text-sm text-gray-500">DNI: {volunteer.dni}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-sm text-gray-900 mb-1">
                                            <Mail size={14} className="text-gray-400" />
                                            {volunteer.email}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <Phone size={14} className="text-gray-400" />
                                            {volunteer.phone}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getRoleBadge(volunteer.role)}`}>
                                            {getRoleLabel(volunteer.role)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 font-semibold">{userBookings.length} turnos</div>
                                        <div className="text-xs text-gray-500">
                                            {userBookings.length > 0 ? 'Asignado' : 'Sin turnos'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${(volunteer.status || 'active') === 'active'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {(volunteer.status || 'active') === 'active' ? 'Activo' : 'Suspendido'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleEditUser(volunteer)}
                                            className="text-primary-600 hover:text-primary-900 p-2 hover:bg-primary-50 rounded-lg transition-colors"
                                            title="Editar usuario"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
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
                            </div>

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
                    <p className="text-gray-500">No se encontraron voluntarios con los filtros seleccionados</p>
                </div>
            )}
        </div>
    );
};

export default EventVolunteersList;
