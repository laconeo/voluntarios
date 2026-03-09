import React, { useState, useEffect, useRef } from 'react';
import { Users, Search, Filter, Download, Edit2, Ban, CheckCircle, X, Save, Upload, Trash2, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
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
    const [filterNoEvents, setFilterNoEvents] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    // --- Import CSV State ---
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<{
        toCreate: Partial<User>[];
        toUpdate: Partial<User>[];
        errors: { row: number; message: string }[];
    } | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // ==================== IMPORT CSV ====================
    const parseCSVRow = (row: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if ((char === ',' || char === '\t') && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    };

    const parseRolValue = (val: string): User['role'] => {
        const map: Record<string, User['role']> = {
            'superadmin': 'superadmin', 'super admin': 'superadmin', 'super_admin': 'superadmin',
            'admin': 'admin', 'administrador': 'admin', 'administrator': 'admin',
            'coordinator': 'coordinator', 'coordinador': 'coordinator',
            'volunteer': 'volunteer', 'voluntario': 'volunteer',
            'receptionist': 'receptionist', 'recepcionista': 'receptionist',
        };
        return map[val.toLowerCase()] || 'volunteer';
    };

    const parseBoolValue = (val: string): boolean => {
        return ['si', 'sí', 'yes', 'true', '1'].includes(val.toLowerCase());
    };

    const parseStatusValue = (val: string): User['status'] => {
        const map: Record<string, User['status']> = {
            'active': 'active', 'activo': 'active', 'activa': 'active',
            'suspended': 'suspended', 'suspendido': 'suspended',
            'deleted': 'deleted', 'eliminado': 'deleted',
        };
        return map[val.toLowerCase()] || 'active';
    };

    const handleFileSelect = (file: File) => {
        if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
            toast.error('Por favor selecciona un archivo CSV válido');
            return;
        }
        setImportFile(file);
        parseCSVPreview(file);
    };

    const parseCSVPreview = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
            if (lines.length < 2) {
                setImportPreview({ toCreate: [], toUpdate: [], errors: [{ row: 0, message: 'El archivo está vacío o no tiene datos' }] });
                return;
            }

            const headerLine = lines[0];
            const headers = parseCSVRow(headerLine).map(h => h.toLowerCase().trim());

            // Expected: DNI, Nombre, Email, Teléfono, Rol, Estado, Miembro, Experiencia, Fecha Registro
            const dniIdx = headers.findIndex(h => h === 'dni');
            const nameIdx = headers.findIndex(h => ['nombre', 'name', 'fullname', 'full_name'].includes(h));
            const emailIdx = headers.findIndex(h => h === 'email');
            const phoneIdx = headers.findIndex(h => ['teléfono', 'telefono', 'phone'].includes(h));
            const rolIdx = headers.findIndex(h => ['rol', 'role'].includes(h));
            const statusIdx = headers.findIndex(h => ['estado', 'status'].includes(h));
            const memberIdx = headers.findIndex(h => ['miembro', 'member', 'ismember'].includes(h));
            const expIdx = headers.findIndex(h => ['experiencia', 'experience', 'attendedprevious'].includes(h));

            if (dniIdx === -1 || nameIdx === -1 || emailIdx === -1) {
                setImportPreview({ toCreate: [], toUpdate: [], errors: [{ row: 0, message: 'El CSV debe tener columnas: DNI, Nombre, Email (al menos)' }] });
                return;
            }

            const existingDnis = new Set(users.map(u => u.dni));
            const toCreate: Partial<User>[] = [];
            const toUpdate: Partial<User>[] = [];
            const errors: { row: number; message: string }[] = [];

            for (let i = 1; i < lines.length; i++) {
                const cols = parseCSVRow(lines[i]);
                const dni = dniIdx >= 0 ? cols[dniIdx]?.trim() : '';
                const fullName = nameIdx >= 0 ? cols[nameIdx]?.trim() : '';
                const email = emailIdx >= 0 ? cols[emailIdx]?.trim() : '';

                if (!dni || !fullName || !email) {
                    errors.push({ row: i + 1, message: `Fila ${i + 1}: DNI, Nombre o Email vacío` });
                    continue;
                }

                const parsed: Partial<User> = {
                    dni,
                    fullName,
                    email,
                    phone: phoneIdx >= 0 ? (cols[phoneIdx]?.trim() || '') : '',
                    role: rolIdx >= 0 ? parseRolValue(cols[rolIdx]?.trim() || '') : 'volunteer',
                    status: statusIdx >= 0 ? parseStatusValue(cols[statusIdx]?.trim() || '') : 'active',
                    isMember: memberIdx >= 0 ? parseBoolValue(cols[memberIdx]?.trim() || '') : false,
                    attendedPrevious: expIdx >= 0 ? parseBoolValue(cols[expIdx]?.trim() || '') : false,
                    isOver18: true,
                    tshirtSize: 'M',
                    howTheyHeard: 'Importación CSV',
                };

                if (existingDnis.has(dni)) {
                    // Find the existing user's ID
                    const existingUser = users.find(u => u.dni === dni);
                    if (existingUser) {
                        parsed.id = existingUser.id;
                    }
                    toUpdate.push(parsed);
                } else {
                    toCreate.push(parsed);
                }
            }

            setImportPreview({ toCreate, toUpdate, errors });
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleImportConfirm = async () => {
        if (!importPreview) return;
        const { toCreate, toUpdate } = importPreview;
        if (toCreate.length === 0 && toUpdate.length === 0) {
            toast.error('No hay datos válidos para importar');
            return;
        }

        setIsImporting(true);
        let created = 0, updated = 0, failed = 0;
        const errors: string[] = [];

        // Actualizar usuarios existentes (por DNI)
        for (const u of toUpdate) {
            try {
                const existingUser = users.find(eu => eu.dni === u.dni);
                if (existingUser) {
                    await mockApi.updateUser({
                        ...existingUser,
                        fullName: u.fullName ?? existingUser.fullName,
                        email: u.email ?? existingUser.email,
                        phone: u.phone ?? existingUser.phone,
                        role: u.role ?? existingUser.role,
                        status: u.status ?? existingUser.status,
                        isMember: u.isMember ?? existingUser.isMember,
                        attendedPrevious: u.attendedPrevious ?? existingUser.attendedPrevious,
                    });
                    updated++;
                }
            } catch (err: any) {
                console.error('Error actualizando', u.dni, err);
                errors.push(u.email || u.dni || '?');
                failed++;
            }
        }

        // Crear nuevos usuarios — usa importUserProfile (NO supabase.auth.signUp)
        // para evitar que la sesión del admin cambie durante la importación.
        for (const u of toCreate) {
            try {
                await mockApi.importUserProfile(u);
                created++;
            } catch (err: any) {
                console.error('Error importando', u.email, err);
                errors.push(`${u.email || u.dni}: ${err.message}`);
                failed++;
            }
        }

        setIsImporting(false);
        setShowImportModal(false);
        setImportFile(null);
        setImportPreview(null);

        // Refrescar lista ANTES del toast para que los usuarios ya estén visibles
        await fetchData();

        const parts = [];
        if (created > 0) parts.push(`${created} creado${created > 1 ? 's' : ''}`);
        if (updated > 0) parts.push(`${updated} actualizado${updated > 1 ? 's' : ''}`);
        if (failed > 0) parts.push(`${failed} con error`);

        if (failed > 0 && created === 0 && updated === 0) {
            toast.error(`Importación fallida. Errores:\n${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
        } else if (failed > 0) {
            toast(`Importación parcial: ${parts.join(', ')}`, { icon: '⚠️' });
        } else {
            toast.success(`Importación exitosa: ${parts.join(', ')}`);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
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
        const matchStatus = filterStatus === 'todos' || (user.status || 'active') === filterStatus;
        const matchNoEvent = !filterNoEvents || !userEventsMap[user.id] || userEventsMap[user.id].length === 0;
        const matchEvent = filterEvent === 'todos' || (userEventsMap[user.id]?.some(e => e.id === filterEvent) ?? false);

        return matchSearch && matchRole && matchStatus && matchNoEvent && matchEvent;
    });

    // Count users without any event (for the badge)
    const usersWithoutEventCount = users.filter(u =>
        !userEventsMap[u.id] || userEventsMap[u.id].length === 0
    ).length;

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
                                onClick={() => { setImportPreview(null); setImportFile(null); setShowImportModal(true); }}
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
                    onClick={() => { setImportPreview(null); setImportFile(null); setShowImportModal(true); }}
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
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-5 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Filter size={20} className="text-gray-600" />
                        <h3 className="font-semibold text-gray-900">Filtros y Búsqueda</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar usuario</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Nombre, DNI o email..."
                                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Evento</label>
                            <select
                                value={filterEvent}
                                onChange={(e) => { setFilterEvent(e.target.value); if (e.target.value !== 'todos') setFilterNoEvents(false); }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-sm"
                            >
                                <option value="todos">Todos los eventos</option>
                                {events.map(ev => (
                                    <option key={ev.id} value={ev.id}>{ev.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Rol</label>
                            <select
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-sm"
                            >
                                <option value="todos">Todos los roles</option>
                                <option value="superadmin">Super Admin</option>
                                <option value="admin">Administrador</option>
                                <option value="coordinator">Coordinador</option>
                                <option value="volunteer">Voluntario</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-sm"
                            >
                                <option value="todos">Todos</option>
                                <option value="active">Activos</option>
                                <option value="suspended">Suspendidos</option>
                                <option value="deleted">Eliminados</option>
                            </select>
                        </div>
                    </div>

                    {/* Filtros rápidos / acceso directo */}
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-200">
                        <span className="text-xs font-medium text-gray-500 mr-1">Acceso rápido:</span>
                        <button
                            onClick={() => setFilterNoEvents(prev => !prev)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filterNoEvents
                                ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-50'
                                }`}
                        >
                            <span className={`h-2 w-2 rounded-full ${filterNoEvents ? 'bg-white' : 'bg-orange-400'}`} />
                            Sin eventos asignados
                            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold ${filterNoEvents ? 'bg-orange-400 text-white' : 'bg-orange-100 text-orange-700'
                                }`}>
                                {usersWithoutEventCount}
                            </span>
                        </button>
                        {(filterNoEvents || filterRole !== 'todos' || filterStatus !== 'todos' || filterEvent !== 'todos' || searchTerm) && (
                            <button
                                onClick={() => { setFilterNoEvents(false); setFilterRole('todos'); setFilterStatus('todos'); setFilterEvent('todos'); setSearchTerm(''); }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-all"
                            >
                                <X size={12} /> Limpiar filtros
                            </button>
                        )}
                        <span className="ml-auto text-xs text-gray-500">
                            <span className="font-semibold text-gray-900">{filteredUsers.length}</span> de {users.length} usuarios
                        </span>
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
                            {/* Desktop Table View — sin scroll horizontal */}
                            <div className="hidden sm:block">
                                <table className="w-full table-fixed">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '30%' }}>
                                                Usuario
                                            </th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '11%' }}>
                                                Rol
                                            </th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>
                                                Estado
                                            </th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '34%' }}>
                                                Eventos
                                            </th>
                                            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '15%' }}>
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredUsers.map((user) => (
                                            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                                {/* Usuario: avatar + nombre + email + DNI + fecha registro */}
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="flex-shrink-0 h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                                                            <span className="text-primary-700 font-semibold text-xs">
                                                                {user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                            </span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-semibold text-gray-900 truncate" title={user.fullName}>{user.fullName}</div>
                                                            <div className="text-xs text-gray-400 truncate" title={user.email}>{user.email}</div>
                                                            <div className="text-xs text-gray-400 flex gap-2">
                                                                <span>DNI: {user.dni}</span>
                                                                {user.createdAt && <span className="text-gray-300">·</span>}
                                                                {user.createdAt && <span>{new Date(user.createdAt).toLocaleDateString('es-ES')}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Rol */}
                                                <td className="px-3 py-2.5">
                                                    <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full border ${getRoleBadge(user.role)}`}>
                                                        {getRoleLabel(user.role)}
                                                    </span>
                                                </td>
                                                {/* Estado */}
                                                <td className="px-3 py-2.5">
                                                    <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${(user.status || 'active') === 'active'
                                                        ? 'bg-green-100 text-green-800'
                                                        : user.status === 'deleted' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-800'
                                                        }`}>
                                                        {(user.status || 'active') === 'active' ? 'Activo' : user.status === 'deleted' ? 'Eliminado' : 'Suspendido'}
                                                    </span>
                                                </td>
                                                {/* Eventos */}
                                                <td className="px-3 py-2.5">
                                                    <div className="flex flex-wrap gap-1 overflow-hidden" style={{ maxHeight: '3.6rem' }}>
                                                        {userEventsMap[user.id]?.map(e => (
                                                            <span key={e.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 truncate" style={{ maxWidth: '100%' }} title={e.nombre}>
                                                                {e.nombre}
                                                            </span>
                                                        ))}
                                                        {(!userEventsMap[user.id] || userEventsMap[user.id].length === 0) && (
                                                            <span className="text-xs text-orange-500 italic font-medium">Sin eventos</span>
                                                        )}
                                                    </div>
                                                </td>
                                                {/* Acciones */}
                                                <td className="px-3 py-2.5 text-right">
                                                    <div className="flex justify-end items-center gap-0.5">
                                                        <button
                                                            onClick={() => handleEditUser(user)}
                                                            className="text-primary-600 hover:text-primary-900 p-1.5 hover:bg-primary-50 rounded transition-colors"
                                                            title="Editar usuario"
                                                        >
                                                            <Edit2 size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenEnrollModal(user)}
                                                            className="text-indigo-600 hover:text-indigo-900 p-1.5 hover:bg-indigo-50 rounded transition-colors"
                                                            title="Inscribir en Evento"
                                                        >
                                                            <Users size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleStatus(user)}
                                                            className={`p-1.5 rounded transition-colors ${(user.status || 'active') === 'active'
                                                                ? 'text-yellow-600 hover:bg-yellow-50'
                                                                : 'text-green-600 hover:bg-green-50'
                                                                }`}
                                                            title={(user.status || 'active') === 'active' ? 'Suspender' : 'Activar'}
                                                        >
                                                            {(user.status || 'active') === 'active' ? <Ban size={15} /> : <CheckCircle size={15} />}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(user)}
                                                            className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors"
                                                            title="Eliminar usuario"
                                                        >
                                                            <Trash2 size={15} />
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

            {/* ========== MODAL DE IMPORTACIÓN CSV ========== */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary-100 rounded-lg">
                                    <Upload className="text-primary-600" size={22} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Importar Usuarios desde CSV</h3>
                                    <p className="text-sm text-gray-500">Usa el mismo formato que exporta el sistema</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Format info */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start gap-2">
                                    <FileText className="text-blue-500 mt-0.5 flex-shrink-0" size={16} />
                                    <div>
                                        <p className="text-sm font-semibold text-blue-800 mb-1">Formato esperado de columnas:</p>
                                        <p className="text-xs text-blue-700 font-mono bg-blue-100 px-2 py-1 rounded">
                                            DNI · Nombre · Email · Teléfono · Rol · Estado · Miembro · Experiencia · Fecha Registro
                                        </p>
                                        <p className="text-xs text-blue-600 mt-1.5">Los valores de <strong>Rol</strong> aceptados: volunteer, coordinator, admin, superadmin.<br />Los valores de <strong>Estado</strong>: active / activo, suspended / suspendido.<br />Los valores de <strong>Miembro/Experiencia</strong>: Sí / No.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Drop zone */}
                            {!importFile ? (
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                    onDragLeave={() => setIsDragOver(false)}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${isDragOver
                                        ? 'border-primary-500 bg-primary-50'
                                        : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                                        }`}
                                >
                                    <Upload className="mx-auto mb-3 text-gray-400" size={36} />
                                    <p className="text-gray-700 font-semibold">Arrastra el archivo CSV aquí</p>
                                    <p className="text-sm text-gray-500 mt-1">o haz clic para seleccionar</p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv,text/csv"
                                        className="hidden"
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <FileText className="text-green-600 flex-shrink-0" size={20} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-green-800 truncate">{importFile.name}</p>
                                        <p className="text-xs text-green-600">{(importFile.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <button
                                        onClick={() => { setImportFile(null); setImportPreview(null); }}
                                        className="text-gray-400 hover:text-gray-600 p-1"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}

                            {/* Preview results */}
                            {importPreview && (
                                <div className="space-y-3">
                                    {/* Summary */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-green-700">{importPreview.toCreate.length}</div>
                                            <div className="text-xs text-green-600 font-medium mt-0.5">Nuevos a crear</div>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-blue-700">{importPreview.toUpdate.length}</div>
                                            <div className="text-xs text-blue-600 font-medium mt-0.5">A actualizar</div>
                                        </div>
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-red-700">{importPreview.errors.length}</div>
                                            <div className="text-xs text-red-600 font-medium mt-0.5">Con errores</div>
                                        </div>
                                    </div>

                                    {/* Errors */}
                                    {importPreview.errors.length > 0 && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-28 overflow-y-auto">
                                            <p className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
                                                <AlertCircle size={13} /> Filas con problemas (serán omitidas):
                                            </p>
                                            {importPreview.errors.map((err, i) => (
                                                <p key={i} className="text-xs text-red-600">• {err.message}</p>
                                            ))}
                                        </div>
                                    )}

                                    {/* Preview table */}
                                    {(importPreview.toCreate.length > 0 || importPreview.toUpdate.length > 0) && (
                                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                                            <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">
                                                Vista previa (primeros 5 registros)
                                            </div>
                                            <div className="overflow-x-auto max-h-40">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left text-gray-500 font-medium">Acción</th>
                                                            <th className="px-3 py-2 text-left text-gray-500 font-medium">DNI</th>
                                                            <th className="px-3 py-2 text-left text-gray-500 font-medium">Nombre</th>
                                                            <th className="px-3 py-2 text-left text-gray-500 font-medium">Email</th>
                                                            <th className="px-3 py-2 text-left text-gray-500 font-medium">Rol</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {[...importPreview.toCreate.slice(0, 5).map(u => ({ ...u, _action: 'crear' })),
                                                        ...importPreview.toUpdate.slice(0, Math.max(0, 5 - importPreview.toCreate.length)).map(u => ({ ...u, _action: 'actualizar' }))]
                                                            .map((u, i) => (
                                                                <tr key={i} className="hover:bg-gray-50">
                                                                    <td className="px-3 py-1.5">
                                                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${u._action === 'crear' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                                                            }`}>
                                                                            {u._action === 'crear' ? '+ Crear' : '↻ Actualizar'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-1.5 text-gray-700 font-mono">{u.dni}</td>
                                                                    <td className="px-3 py-1.5 text-gray-700">{u.fullName}</td>
                                                                    <td className="px-3 py-1.5 text-gray-500 truncate max-w-[150px]">{u.email}</td>
                                                                    <td className="px-3 py-1.5 text-gray-500">{u.role}</td>
                                                                </tr>
                                                            ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Warning for new users */}
                                    {importPreview.toCreate.length > 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                            <p className="text-xs text-amber-700">
                                                <strong>⚠ Atención:</strong> Los {importPreview.toCreate.length} usuario{importPreview.toCreate.length > 1 ? 's' : ''} nuevo{importPreview.toCreate.length > 1 ? 's' : ''} recibirá{importPreview.toCreate.length > 1 ? 'n' : ''} un email de bienvenida con su contraseña generada automáticamente.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer actions */}
                        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
                                disabled={isImporting}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleImportConfirm}
                                disabled={!importPreview || (importPreview.toCreate.length === 0 && importPreview.toUpdate.length === 0) || isImporting}
                                className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isImporting ? (
                                    <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importando...</>
                                ) : (
                                    <><CheckCircle2 size={16} /> Confirmar Importación</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
