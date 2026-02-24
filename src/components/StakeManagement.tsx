import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { mockApi } from '../services/mockApiService';
import type { Stake } from '../types';
import { toast } from 'react-hot-toast';

interface StakeManagementProps {
    eventId: string;
}

const StakeManagement: React.FC<StakeManagementProps> = ({ eventId }) => {
    const [stakes, setStakes] = useState<Stake[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newStakeName, setNewStakeName] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        fetchStakes();
    }, [eventId]);

    const fetchStakes = async () => {
        setIsLoading(true);
        try {
            const data = await mockApi.getStakesByEvent(eventId);
            setStakes(data);
        } catch (error) {
            toast.error('Error al cargar estacas/barrios');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddStake = async () => {
        if (!newStakeName.trim()) {
            toast.error('El nombre de la estaca/barrio es requerido');
            return;
        }

        setIsAdding(true);
        try {
            await mockApi.createStake({
                eventId,
                name: newStakeName.trim(),
            });
            toast.success('Estaca/Barrio agregada exitosamente');
            setNewStakeName('');
            fetchStakes();
        } catch (error: any) {
            toast.error(error.message || 'Error al agregar estaca/barrio');
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteStake = async (stakeId: string) => {
        if (!confirm('¿Estás seguro de eliminar esta estaca/barrio?')) {
            return;
        }

        try {
            await mockApi.deleteStake(stakeId);
            toast.success('Estaca/Barrio eliminada');
            fetchStakes();
        } catch (error: any) {
            toast.error(error.message || 'Error al eliminar estaca/barrio');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isAdding) {
            handleAddStake();
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Gestión de Estacas / Barrios</h3>
                <p className="text-sm text-gray-500">
                    Agrega las estacas/barrios involucrados en este evento.
                </p>
            </div>

            {/* Add New Stake */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agregar Nueva Estaca / Barrio
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newStakeName}
                        onChange={(e) => setNewStakeName(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Nombre de la estaca/barrio"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-[#8CB83E] focus:border-[#8CB83E]"
                        disabled={isAdding}
                    />
                    <button
                        onClick={handleAddStake}
                        disabled={isAdding || !newStakeName.trim()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#8CB83E] hover:bg-[#7cb342] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar
                    </button>
                </div>
            </div>

            {/* Stakes List */}
            <div>
                {stakes.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <h3 className="text-sm font-medium text-gray-900 mb-1">
                            No hay estacas/barrios registrados
                        </h3>
                        <p className="text-sm text-gray-500">
                            Comienza agregando la primera estaca/barrio para este evento.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Nombre
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Fecha de Creación
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {stakes.map((stake) => (
                                    <tr key={stake.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {stake.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-500">
                                                {stake.createdAt
                                                    ? new Date(stake.createdAt).toLocaleDateString('es-ES', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })
                                                    : '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleDeleteStake(stake.id)}
                                                className="text-red-600 hover:text-red-900 inline-flex items-center gap-1 px-3 py-1 rounded-md hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Summary */}
            {stakes.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                        <div>
                            <h4 className="text-sm font-medium text-blue-900">
                                Total de estacas/barrios: {stakes.length}
                            </h4>
                            <p className="text-sm text-blue-700 mt-1">
                                Estas estacas/barrios están asociadas a este evento.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StakeManagement;
