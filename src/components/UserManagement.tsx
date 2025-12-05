import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, Download, Edit2, Ban, CheckCircle, X, Save } from 'lucide-react';
import { mockApi } from '../services/mockApiService';
import type { User, Event, Booking } from '../types';
import { toast } from 'react-hot-toast';

interface UserManagementProps {
    user: User;
    onBack: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ user: currentUser, onBack }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('todos');
    const [filterEvent, setFilterEvent] = useState('todos');
    const [filterStatus, setFilterStatus] = useState('todos');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');
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

            setUsers(usersData);
            setEvents(eventsData);
        } catch (error) {
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
        setNewPassword(''); // Reset password field
        setShowEditModal(true);
    };

    const handleSaveUser = async () => {
        if (!editingUser) return;

        try {
            const userToUpdate = { ...editingUser };
            if (newPassword.trim()) {
                userToUpdate.password = newPassword;
            }
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

    const exportToCSV = () => {
        const headers = ['DNI', 'Nombre', 'Email', 'Teléfono', 'Rol', 'Estado', 'Miembro', 'Fecha Registro'];
        const rows = filteredUsers.map(u => [
            u.dni,
            u.fullName,
            u.email,
            u.phone,
            u.role,
            u.status || 'active',
            u.isMember ? 'Sí' : 'No',
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

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-6">
                <div className="max-w-7xl mx-auto">
                    <button
                        onClick={onBack}
                        className="text-primary-600 hover:text-primary-700 mb-4 flex items-center gap-2 font-medium"
                    >
                        ← Volver al dashboard
                    </button>
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">
                                Gestión de Usuarios
                            </h1>
                            <p className="text-gray-600">
                                Administra todos los usuarios del sistema
                            </p>
                        </div>
                        <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 font-semibold shadow-lg"
                        >
                            <Download size={20} />
                            Exportar CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-md border-l-4 border-blue-500 p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <Users className="text-blue-600" size={28} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Total Usuarios</p>
                                <p className="text-3xl font-bold text-gray-900">{users.length}</p>
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
                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                    {isLoading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Usuario
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Contacto
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Rol
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Estado
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Registro
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                                                        <span className="text-primary-700 font-semibold">
                                                            {user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                        </span>
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                                                        <div className="text-sm text-gray-500">DNI: {user.dni}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{user.email}</div>
                                                <div className="text-sm text-gray-500">{user.phone}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getRoleBadge(user.role)}`}>
                                                    {getRoleLabel(user.role)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${(user.status || 'active') === 'active'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {(user.status || 'active') === 'active' ? 'Activo' : 'Suspendido'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES') : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEditUser(user)}
                                                        className="text-primary-600 hover:text-primary-900 p-2 hover:bg-primary-50 rounded-lg transition-colors"
                                                        title="Editar usuario"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleStatus(user)}
                                                        className={`p-2 rounded-lg transition-colors ${(user.status || 'active') === 'active'
                                                            ? 'text-red-600 hover:text-red-900 hover:bg-red-50'
                                                            : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                                                            }`}
                                                        title={(user.status || 'active') === 'active' ? 'Suspender' : 'Activar'}
                                                    >
                                                        {(user.status || 'active') === 'active' ? <Ban size={18} /> : <CheckCircle size={18} />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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
                                            // Admin can only see 'admin' if they are superadmin, wait.
                                            // Requirement: "solo el super admin puede generar administradores"
                                            // So Admin should NOT be able to select 'admin' or 'superadmin'
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
                                        Nueva Contraseña {currentUser.role === 'admin' && editingUser.role === 'admin' && '(No permitido)'}
                                    </label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Dejar en blanco para mantener actual"
                                        disabled={currentUser.role === 'admin' && (editingUser.role === 'admin' || editingUser.role === 'superadmin')}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
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
                                        <strong>Nota:</strong> Los cambios en el rol afectarán los permisos del usuario en el sistema.
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
                </div>
            )}
        </div>
    );
};

export default UserManagement;
