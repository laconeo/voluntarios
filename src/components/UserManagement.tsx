import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, Download, Edit2, Ban, CheckCircle, X, Save, Upload, Trash2 } from 'lucide-react';
import { supabaseApi as mockApi } from '../services/supabaseApiService';
import type { User, Event, Booking } from '../types';
import { toast } from 'react-hot-toast';

interface UserManagementProps {
    user: User;
    onBack: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ user: currentUser, onBack }) => {
    // ... existing state ...
    const [users, setUsers] = useState<User[]>([]);

    const [events, setEvents] = useState<Event[]>([]);
    const [userEventsMap, setUserEventsMap] = useState<Record<string, Event[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [showEnrollModal, setShowEnrollModal] = useState(false);
    const [userToEnroll, setUserToEnroll] = useState<User | null>(null);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('todos');
    const [filterEvent, setFilterEvent] = useState('todos');
    const [filterStatus, setFilterStatus] = useState('todos');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Cargar usuarios, eventos y bookings
            const [usersData, eventsData] = await Promise.all([
                mockApi.getAllUsers(),
                mockApi.getAllEvents(),
            ]);

            setUsers(usersData.sort((a, b) => a.fullName.localeCompare(b.fullName)));
            setEvents(eventsData);

            // Fetch events for each user (inefficient for large N, but ok for now)
            // Better: fetch all CONFIRMED bookings with events
            // We can add a method 'getAllBookingsWithEvents'
            // For now, let's just do bulk fetch if possible, or iterating.
            // Let's iterate but optimizing? No, let's use a new helper or existing logic.
            // We need to know for EACH user what events they are in.
            // Let's assume we can fetch all bookings globally?
            // mockApi.getAllBookings() doesn't exist?
            // We can iterate users - NO.
            // Let's just create a quick map by fetching all confirmed bookings? 
            // We don't have a 'getAllBookings' method.
            // Let's add 'getAllActiveBookings' to API?
            // Or we can use `userEventsMap` and fetch on demand or lazy load?
            // Easiest for UI is to fetch for *displayed* users, but filtering depends on it? No.
            // Let's fetch for all users in parallel? No.

            // Let's try to fetch all bookings from supabase directly if we could? 
            // I'll add getAllBookings to API?
            // Alternatively, since I just added getUserEvents(userId), I can call it for visible users?
            // Let's just batch fetch for now.
            const map: Record<string, Event[]> = {};
            // Parallel fetch for top 50?
            // This is going to be slow if many users.
            // Let's skip pre-loading events for everyone column for now to avoid perf hit?
            // User asked: "que pueda ver en que eventos esta registrado cada usuario".
            // So we MUST show it.

            // I'll use a hack: fetch all bookings by iterating all ACTIVE events.
            const allBookingsPromises = eventsData.map(e => mockApi.getBookingsByEvent(e.id).then(bs => ({ event: e, bookings: bs })));
            const results = await Promise.all(allBookingsPromises);

            results.forEach(({ event, bookings }) => {
                // Filter out general enrollments (shift_id: null) - they're just internal markers
                const realBookings = bookings.filter(b => b.shiftId !== null);

                realBookings.forEach(b => {
                    if (!map[b.userId]) map[b.userId] = [];
                    // Avoid dups
                    if (!map[b.userId].find(e => e.id === event.id)) {
                        map[b.userId].push(event);
                    }
                });
            });

            setUserEventsMap(map);

        } catch (error) {
            console.error(error);
            toast.error('Error al cargar datos');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditUser = (user: User) => {
        // Validation: Admin cannot edit other Admins or SuperAdmins
        if (currentUser.role === 'admin' && (user.role === 'admin' || user.role === 'superadmin')) {
            toast.error('No tienes permisos para editar a este usuario');
            return;
        }
        setEditingUser({ ...user });
        setShowEditModal(true);
    };

    const handleSaveUser = async () => {
        if (!editingUser) return;

        try {
            const userToUpdate = { ...editingUser };
            await mockApi.updateUser(userToUpdate);
            toast.success('Usuario actualizado correctamente');
            setShowEditModal(false);
            setEditingUser(null);
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Error al actualizar usuario');
        }
    };

    const handleToggleStatus = async (user: User) => {
        const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
        try {
            await mockApi.updateUser({ ...user, status: newStatus });
            toast.success(`Usuario ${newStatus === 'suspended' ? 'suspendido' : 'activado'} correctamente`);
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Error al cambiar estado');
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (!confirm(`¿Estás seguro de eliminar al usuario ${user.fullName}? Esta acción no se puede deshacer.`)) {
            return;
        }

        // Additional safety check for Admin deleting SuperAdmin
        if (user.role === 'superadmin') {
            toast.error('No puedes eliminar a un Super Administrador');
            return;
        }

        try {
            await mockApi.deleteUser(user.id);
            toast.success('Usuario eliminado correctamente');
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Error al eliminar usuario');
        }
    };

    const exportToCSV = () => {
        // ... existing export logic ...
        const headers = ['DNI', 'Nombre', 'Email', 'Teléfono', 'Rol', 'Estado', 'Miembro', 'Experiencia', 'Fecha Registro'];
        const rows = filteredUsers.map(u => [
            u.dni,
            u.fullName,
            u.email,
            u.phone,
            u.role,
            u.status || 'active',
            u.isMember ? 'Sí' : 'No',
            u.attendedPrevious ? 'Sí' : 'No',
            u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `usuarios_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        toast.success('Exportación completada');
    };

    const filteredUsers = users.filter(user => {
        const matchSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.dni.includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchRole = filterRole === 'todos' || user.role === filterRole;

        // Show deleted users logic
        const matchStatus = filterStatus === 'todos' || (user.status || 'active') === filterStatus;

        return matchSearch && matchRole && matchStatus;
    });

    const getRoleBadge = (role: string) => {
        const badges = {
            superadmin: 'bg-purple-100 text-purple-700 border-purple-200',
            admin: 'bg-blue-100 text-blue-700 border-blue-200',
            coordinator: 'bg-green-100 text-green-700 border-green-200',
            volunteer: 'bg-gray-100 text-gray-700 border-gray-200'
        };
        return badges[role as keyof typeof badges] || badges.volunteer;
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

    const handleOpenEnrollModal = (user: User) => {
        setUserToEnroll(user);
        setSelectedEventId('');
        setShowEnrollModal(true);
    };

    const handleEnrollUser = async () => {
        if (!userToEnroll || !selectedEventId) return;

        try {
            await mockApi.enrollUserInEvent(userToEnroll.id, selectedEventId);
            toast.success(`Usuario inscripto en ${events.find(e => e.id === selectedEventId)?.nombre}`);
            setShowEnrollModal(false);
            fetchData(); // Refresh map
        } catch (error: any) {
            toast.error(error.message || 'Error al inscribir');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-6">
                <div className="max-w-7xl mx-auto">
                    <button
                        onClick={onBack}
                        className="text-primary-600 hover:text-primary-700 mb-4 flex items-center gap-2 font-medium"
                    >
                        ← Volver al dashboard
                    </button>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">
                                Gestión de Usuarios
                            </h1>
                            <p className="text-gray-600">
                                Administra todos los usuarios del sistema
                            </p>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto hidden sm:flex">
                            <button
                                onClick={() => toast.success('Funcionalidad de importación próximamente')}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                            >
                                <Upload size={16} />
                                Importar
                            </button>
                            <button
                                onClick={exportToCSV}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-semibold shadow-lg text-sm"
                            >
                                <Download size={16} />
                                Exportar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 sm:hidden z-50 flex gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <button
                    onClick={() => toast.success('Funcionalidad de importación próximamente')}
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-gray-50 text-gray-700 py-2 rounded-lg border border-gray-200 active:bg-gray-100"
                >
                    <Upload size={20} />
                    <span className="text-xs font-semibold">Importar</span>
                </button>
                <button
                    onClick={exportToCSV}
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-primary-600 text-white py-2 rounded-lg active:bg-primary-700 shadow-md"
                >
                    <Download size={20} />
                    <span className="text-xs font-semibold">Exportar CSV</span>
                </button>
            </div>

            {/* Stats */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    {/* ... stats content same as before ... */}
                    <div className="bg-white rounded-lg shadow-md border-l-4 border-blue-500 p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <Users className="text-blue-600" size={28} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Total Usuarios</p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {users.filter(u => u.status !== 'deleted').length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md border-l-4 border-green-500 p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-100 rounded-lg">
                                <CheckCircle className="text-green-600" size={28} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Activos</p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {users.filter(u => (u.status || 'active') === 'active').length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md border-l-4 border-purple-500 p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-100 rounded-lg">
                                <Users className="text-purple-600" size={28} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Administradores</p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {users.filter(u => u.role === 'admin' || u.role === 'superadmin').length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md border-l-4 border-gray-500 p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gray-100 rounded-lg">
                                <Users className="text-gray-600" size={28} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Voluntarios</p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {users.filter(u => u.role === 'volunteer').length}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filtros */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Filter size={20} className="text-gray-600" />
                        <h3 className="font-semibold text-gray-900">Filtros y Búsqueda</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Buscar usuario
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Rol
                            </label>
                            <select
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                            >
                                <option value="todos">Todos los roles</option>
                                <option value="superadmin">Super Admin</option>
                                <option value="admin">Administrador</option>
                                <option value="coordinator">Coordinador</option>
                                <option value="volunteer">Voluntario</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Estado
                            </label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                            >
                                <option value="todos">Todos</option>
                                <option value="active">Activos</option>
                                <option value="suspended">Suspendidos</option>
                                <option value="deleted">Eliminados</option>
                            </select>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                            Mostrando <span className="font-semibold text-gray-900">{filteredUsers.length}</span> de {users.length} usuarios
                        </p>
                    </div>
                </div>

                {/* Tabla de usuarios */}
                <div className="bg-transparent sm:bg-white sm:rounded-lg sm:shadow-md sm:border sm:border-gray-200 overflow-hidden">
                    {isLoading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                                                Usuario
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Contacto
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Rol
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Estado
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                                                ¿Feria Anterior?
                                            </th>
                                            {/* Adjusted Register column visibility could be done if needed, keeping for now with less padding */}
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Eventos en los que participa
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Registro
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredUsers.map((user) => (
                                            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-2.5 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0 h-9 w-9 bg-primary-100 rounded-full flex items-center justify-center text-sm">
                                                            <span className="text-primary-700 font-semibold">
                                                                {user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                            </span>
                                                        </div>
                                                        <div className="ml-3 truncate max-w-[180px]" title={user.fullName}>
                                                            <div className="text-sm font-medium text-gray-900 truncate">{user.fullName}</div>
                                                            <div className="text-xs text-gray-500">DNI: {user.dni}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900 truncate max-w-[150px]" title={user.email}>{user.email}</div>
                                                    <div className="text-xs text-gray-500">{user.phone}</div>
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap">
                                                    <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full border ${getRoleBadge(user.role)}`}>
                                                        {getRoleLabel(user.role)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap">
                                                    <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${(user.status || 'active') === 'active'
                                                        ? 'bg-green-100 text-green-800'
                                                        : (user.status === 'deleted' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800')
                                                        }`}>
                                                        {(user.status || 'active') === 'active' ? 'Activo' : (user.status === 'deleted' ? 'Eliminado' : 'Suspendido')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-sm text-gray-500 max-w-[200px]">
                                                    <div className="flex flex-wrap gap-1">
                                                        {userEventsMap[user.id]?.map(e => (
                                                            <span key={e.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 truncate max-w-full">
                                                                {e.nombre}
                                                            </span>
                                                        ))}
                                                        {(!userEventsMap[user.id] || userEventsMap[user.id].length === 0) && (
                                                            <span className="text-xs text-gray-400 italic">Sin eventos</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-center">
                                                    {user.attendedPrevious ? (
                                                        <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">SI</span>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">NO</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-500">
                                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES') : '-'}
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex justify-end gap-1">
                                                        <button
                                                            onClick={() => handleEditUser(user)}
                                                            className="text-primary-600 hover:text-primary-900 p-1.5 hover:bg-primary-50 rounded transition-colors"
                                                            title="Editar usuario"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenEnrollModal(user)}
                                                            className="text-indigo-600 hover:text-indigo-900 p-1.5 hover:bg-indigo-50 rounded transition-colors"
                                                            title="Inscribir en Evento"
                                                        >
                                                            <Users size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleStatus(user)}
                                                            className={`p-1.5 rounded transition-colors ${(user.status || 'active') === 'active'
                                                                ? 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50'
                                                                : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                                                                }`}
                                                            title={(user.status || 'active') === 'active' ? 'Suspender' : 'Activar'}
                                                        >
                                                            {(user.status || 'active') === 'active' ? <Ban size={16} /> : <CheckCircle size={16} />}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(user)}
                                                            className="text-red-600 hover:text-red-900 p-1.5 hover:bg-red-50 rounded transition-colors ml-1"
                                                            title="Eliminar usuario permanentemente"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="sm:hidden space-y-4">
                                {filteredUsers.map((user) => (
                                    <div key={user.id} className="p-4 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col gap-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                                                    <span className="text-primary-700 font-semibold">
                                                        {user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-gray-900 text-lg">{user.fullName}</div>
                                                    <div className="text-sm text-gray-500">DNI: {user.dni}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleEditUser(user)}
                                                    className="p-2 text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={20} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(user)}
                                                    className={`p-2 rounded-lg ${(user.status || 'active') === 'active'
                                                        ? 'text-red-600 bg-red-50'
                                                        : 'text-green-600 bg-green-50'
                                                        }`}
                                                    title={(user.status || 'active') === 'active' ? 'Suspender' : 'Activar'}
                                                >
                                                    {(user.status || 'active') === 'active' ? <Ban size={20} /> : <CheckCircle size={20} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm bg-gray-50 p-3 rounded-md">
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Rol</div>
                                                <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${getRoleBadge(user.role)}`}>
                                                    {getRoleLabel(user.role)}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Estado</div>
                                                <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${(user.status || 'active') === 'active'
                                                    ? 'bg-green-100 text-green-800'
                                                    : (user.status === 'deleted' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800')
                                                    }`}>
                                                    {(user.status || 'active') === 'active' ? 'Activo' : (user.status === 'deleted' ? 'Eliminado' : 'Suspendido')}
                                                </span>
                                            </div>
                                            <div className="col-span-2">
                                                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Email</div>
                                                <div className="truncate font-medium text-gray-700">{user.email}</div>
                                            </div>
                                            <div className="col-span-2">
                                                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Teléfono</div>
                                                <div className="font-medium text-gray-700">{user.phone}</div>
                                            </div>
                                            <div className="col-span-2">
                                                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Experiencia previa</div>
                                                <div className="font-medium text-gray-700">
                                                    {user.attendedPrevious ? (
                                                        <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs font-semibold">Participó anteriormente</span>
                                                    ) : (
                                                        <span className="text-gray-500">Sin experiencia previa</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Modal de Edición */}
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
                                        {(currentUser.role === 'superadmin' || currentUser.role === 'admin') && (
                                            currentUser.role === 'superadmin' && (
                                                <>
                                                    <option value="admin">Administrador</option>
                                                    <option value="superadmin">Super Admin</option>
                                                </>
                                            )
                                        )}
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

                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded text-sm text-yellow-700">
                                <strong>Nota:</strong> Los cambios en el rol afectarán los permisos del usuario en el sistema.
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
                </div>
            )}
            {/* Modal de Inscripción Manual */}
            {showEnrollModal && userToEnroll && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-gray-900">
                                Inscribir en Evento
                            </h3>
                            <button
                                onClick={() => setShowEnrollModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-2">
                                Selecciona el evento al que deseas inscribir a <strong>{userToEnroll.fullName}</strong>.
                            </p>

                            <select
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="">Seleccionar evento...</option>
                                {events
                                    .filter(e => e.estado === 'Activo' || e.estado === 'Inactivo') // Solo activos o inactivos, no archivados?
                                    .filter(e => !userEventsMap[userToEnroll.id]?.some(ue => ue.id === e.id)) // Filtrar los que ya tiene
                                    .map(e => (
                                        <option key={e.id} value={e.id}>
                                            {e.nombre}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowEnrollModal(false)}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleEnrollUser}
                                disabled={!selectedEventId}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
                            >
                                Inscribir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
