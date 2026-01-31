
import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, CheckCircle, XCircle, ChevronLeft, Download, AlertCircle } from 'lucide-react';
import { supabaseApi as mockApi } from '../services/supabaseApiService';
import type { User, Stake } from '../types';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface EcclesiasticalPermissionProps {
    eventId: string;
    onClose: () => void;
}

const EcclesiasticalPermission: React.FC<EcclesiasticalPermissionProps> = ({ eventId, onClose }) => {
    const [volunteers, setVolunteers] = useState<User[]>([]);
    const [stakes, setStakes] = useState<Stake[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStake, setSelectedStake] = useState<string>('all');
    const [filterPermission, setFilterPermission] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');

    useEffect(() => {
        fetchData();
    }, [eventId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [usersData, stakesData] = await Promise.all([
                mockApi.getVolunteersByEventStakes(eventId),
                mockApi.getStakesByEvent(eventId)
            ]);
            setVolunteers(usersData);
            setStakes(stakesData);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Error al cargar voluntarios');
        } finally {
            setIsLoading(false);
        }
    };

    const updatePermission = async (user: User, status: 'pending' | 'verified' | 'rejected') => {
        if (user.ecclesiasticalPermission === status) return;

        try {
            const updatedUser: User = {
                ...user,
                ecclesiasticalPermission: status
            };
            await mockApi.updateUser(updatedUser);
            setVolunteers(volunteers.map(v => v.id === user.id ? updatedUser : v));

            const message = status === 'verified' ? 'verificado' :
                status === 'rejected' ? 'rechazado' : 'marcado como pendiente';

            toast.success(`Permiso ${message} para ${user.fullName}`);
        } catch (error) {
            toast.error('Error al actualizar permiso');
        }
    };

    const exportToExcel = () => {
        try {
            const dataToExport = filteredVolunteers.map(v => ({
                'Nombre Completo': v.fullName,
                'DNI': v.dni,
                'Estaca': getStakeName(v.stakeId),
                'Email': v.email,
                'Teléfono': v.phone,
                'Estado Permiso': v.ecclesiasticalPermission === 'verified' ? 'VERIFICADO' :
                    v.ecclesiasticalPermission === 'rejected' ? 'RECHAZADO' : 'PENDIENTE',
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Voluntarios");

            const fileName = `Permisos_Eclesiasticos_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            toast.success('Excel generado correctamente');
        } catch (error) {
            console.error('Error exporting:', error);
            toast.error('Error al exportar a Excel');
        }
    };

    const filteredVolunteers = volunteers.filter(v => {
        const matchesSearch = v.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.dni.includes(searchTerm);
        const matchesStake = selectedStake === 'all' || v.stakeId === selectedStake;
        const matchesPermission = filterPermission === 'all' || v.ecclesiasticalPermission === filterPermission;

        return matchesSearch && matchesStake && matchesPermission;
    });

    const getStakeName = (stakeId?: string) => {
        return stakes.find(s => s.id === stakeId)?.name || 'Sin Estaca';
    };

    const stats = {
        total: volunteers.length,
        verified: volunteers.filter(v => v.ecclesiasticalPermission === 'verified').length,
        pending: volunteers.filter(v => v.ecclesiasticalPermission === 'pending' || !v.ecclesiasticalPermission).length,
        rejected: volunteers.filter(v => v.ecclesiasticalPermission === 'rejected').length
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8CB83E]"></div>
                <p className="mt-4 text-gray-500">Cargando listado de voluntarios...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <button
                        onClick={onClose}
                        className="mb-4 flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
                    >
                        <ChevronLeft size={20} />
                        Volver al menú de eventos
                    </button>
                    <h2 className="text-3xl font-sans font-bold text-gray-900">Permiso Eclesiástico</h2>
                    <p className="text-gray-500 mt-1">Valida la autorización de los voluntarios por estaca.</p>
                </div>

                <div className="flex gap-3">
                    <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm flex items-center gap-4">
                        <div className="text-center">
                            <p className="text-xs text-gray-400 uppercase font-bold">Total</p>
                            <p className="text-lg font-bold text-gray-900">{stats.total}</p>
                        </div>
                        <div className="h-8 border-l border-gray-100"></div>
                        <div className="text-center">
                            <p className="text-xs text-green-500 uppercase font-bold">Verificados</p>
                            <p className="text-lg font-bold text-green-600">{stats.verified}</p>
                        </div>
                        <div className="h-8 border-l border-gray-100"></div>
                        <div className="text-center">
                            <p className="text-xs text-orange-400 uppercase font-bold">Pendientes</p>
                            <p className="text-lg font-bold text-orange-500">{stats.pending}</p>
                        </div>
                        <div className="h-8 border-l border-gray-100"></div>
                        <div className="text-center">
                            <p className="text-xs text-red-400 uppercase font-bold">Rechazados</p>
                            <p className="text-lg font-bold text-red-500">{stats.rejected}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o DNI..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8CB83E]/20 focus:border-[#8CB83E]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="text-gray-400" size={18} />
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#8CB83E]/20"
                            value={selectedStake}
                            onChange={(e) => setSelectedStake(e.target.value)}
                        >
                            <option value="all">Todas las Estacas</option>
                            {stakes.map(stake => (
                                <option key={stake.id} value={stake.id}>{stake.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <CheckCircle className="text-gray-400" size={18} />
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#8CB83E]/20"
                            value={filterPermission}
                            onChange={(e) => setFilterPermission(e.target.value as any)}
                        >
                            <option value="all">Todos los Estados</option>
                            <option value="verified">Verificados</option>
                            <option value="pending">Pendientes</option>
                            <option value="rejected">Rechazados</option>
                        </select>
                    </div>

                    <button
                        onClick={exportToExcel}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-[#8CB83E]/20 bg-[#8CB83E]/10 text-[#7cb342] rounded-lg hover:bg-[#8CB83E]/20 transition-colors"
                    >
                        <Download size={18} />
                        Exportar Excel
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Voluntario</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">DNI</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Estaca</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contacto</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Permiso</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredVolunteers.length > 0 ? (
                                filteredVolunteers.map((volunteer) => (
                                    <tr key={volunteer.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{volunteer.fullName}</div>
                                            <div className="text-xs text-gray-500 capitalize">{volunteer.role}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {volunteer.dni}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                {getStakeName(volunteer.stakeId)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            <div>{volunteer.email}</div>
                                            <div className="text-xs">{volunteer.phone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {volunteer.ecclesiasticalPermission === 'verified' ? (
                                                <span className="inline-flex items-center gap-1 text-green-600 font-medium text-sm">
                                                    <CheckCircle size={16} />
                                                    Verificado
                                                </span>
                                            ) : volunteer.ecclesiasticalPermission === 'rejected' ? (
                                                <span className="inline-flex items-center gap-1 text-red-600 font-medium text-sm">
                                                    <XCircle size={16} />
                                                    Rechazado
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-orange-500 font-medium text-sm">
                                                    <AlertCircle size={16} />
                                                    Pendiente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => updatePermission(volunteer, 'rejected')}
                                                    className={`p-2 rounded-lg transition-all ${volunteer.ecclesiasticalPermission === 'rejected'
                                                        ? 'bg-red-50 text-red-600 border border-red-100 shadow-sm'
                                                        : 'text-gray-300 hover:bg-gray-50 hover:text-gray-500'
                                                        }`}
                                                    title="Marcar como Rechazado"
                                                >
                                                    <XCircle size={22} />
                                                </button>
                                                <button
                                                    onClick={() => updatePermission(volunteer, 'pending')}
                                                    className={`p-2 rounded-lg transition-all ${volunteer.ecclesiasticalPermission === 'pending' || !volunteer.ecclesiasticalPermission
                                                        ? 'bg-orange-50 text-orange-600 border border-orange-100 shadow-sm'
                                                        : 'text-gray-300 hover:bg-gray-50 hover:text-gray-500'
                                                        }`}
                                                    title="Marcar como Pendiente"
                                                >
                                                    <AlertCircle size={22} />
                                                </button>
                                                <button
                                                    onClick={() => updatePermission(volunteer, 'verified')}
                                                    className={`p-2 rounded-lg transition-all ${volunteer.ecclesiasticalPermission === 'verified'
                                                        ? 'bg-green-50 text-green-600 border border-green-100 shadow-sm'
                                                        : 'text-gray-300 hover:bg-gray-50 hover:text-gray-500'
                                                        }`}
                                                    title="Marcar como Verificado"
                                                >
                                                    <CheckCircle size={22} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <Users size={40} className="mx-auto text-gray-200 mb-4" />
                                        No se encontraron voluntarios para los filtros seleccionados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default EcclesiasticalPermission;
