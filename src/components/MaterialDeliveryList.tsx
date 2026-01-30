import React, { useState, useEffect, useMemo } from 'react';
import { Search, Printer, CheckCircle, Circle, Package, ArrowLeft } from 'lucide-react';
import { mockApi } from '../services/mockApiService';
import type { User, Material } from '../types';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MaterialDeliveryListProps {
    eventId: string;
    onClose: () => void;
}

const MaterialDeliveryList: React.FC<MaterialDeliveryListProps> = ({ eventId, onClose }) => {
    const [volunteers, setVolunteers] = useState<User[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Filters
    const [selectedMaterialId, setSelectedMaterialId] = useState<string>('all');
    const [selectedSize, setSelectedSize] = useState<string>('all');

    // Delivery Status State
    const [deliveredMaterials, setDeliveredMaterials] = useState<Record<string, Record<string, boolean>>>({});

    useEffect(() => {
        loadData();
    }, [eventId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [usersData, materialsData, bookingsData, deliveryData] = await Promise.all([
                mockApi.getAllUsers(),
                mockApi.getMaterialsByEvent(eventId),
                mockApi.getBookingsByEvent(eventId),
                (mockApi as any).getUserMaterials(eventId) // Cast to any until type is updated globally
            ]);

            const userIdsInEvent = new Set(bookingsData.map(b => b.userId));
            const eventVolunteers = usersData.filter(u => userIdsInEvent.has(u.id));

            setVolunteers(eventVolunteers);
            // Filter out 'food' category materials (requests user)
            const setupMaterials = materialsData.filter(m => m.category !== 'food');
            setMaterials(setupMaterials);

            // Initialize delivered state
            const initialDelivered: Record<string, Record<string, boolean>> = {};
            eventVolunteers.forEach(u => {
                initialDelivered[u.id] = {};
                materialsData.forEach(m => {
                    initialDelivered[u.id][m.id] = false;
                });
            });

            // Map DB results
            if (Array.isArray(deliveryData)) {
                deliveryData.forEach((d: any) => {
                    if (initialDelivered[d.user_id]) {
                        initialDelivered[d.user_id][d.material_id] = true;
                    }
                });
            }

            setDeliveredMaterials(initialDelivered);

        } catch (error) {
            console.error(error);
            toast.error('Error cargando datos');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleDelivery = async (userId: string, materialId: string) => {
        const currentStatus = deliveredMaterials[userId]?.[materialId];
        const newStatus = !currentStatus;

        // Optimistic update
        setDeliveredMaterials(prev => ({
            ...prev,
            [userId]: {
                ...prev[userId],
                [materialId]: newStatus
            }
        }));

        try {
            await (mockApi as any).toggleUserMaterial(eventId, userId, materialId, newStatus);
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar estado');
            // Revert on error
            setDeliveredMaterials(prev => ({
                ...prev,
                [userId]: {
                    ...prev[userId],
                    [materialId]: currentStatus // revert
                }
            }));
        }
    };

    // Derived Data & Filtering
    const availableSizes = useMemo(() => {
        const sizes = new Set(volunteers.map(v => v.tshirtSize).filter(Boolean));
        return Array.from(sizes).sort();
    }, [volunteers]);

    const filteredVolunteers = useMemo(() => {
        return volunteers.filter(v => {
            const matchesSearch = v.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || v.dni.includes(searchTerm);
            const matchesSize = selectedSize === 'all' || v.tshirtSize === selectedSize;
            return matchesSearch && matchesSize;
        });
    }, [volunteers, searchTerm, selectedSize]);

    const visibleMaterials = useMemo(() => {
        return materials.filter(m => selectedMaterialId === 'all' || m.id === selectedMaterialId);
    }, [materials, selectedMaterialId]);

    const stats = useMemo(() => {
        let totalItems = filteredVolunteers.length * visibleMaterials.length;
        let deliveredItems = 0;

        filteredVolunteers.forEach(u => {
            visibleMaterials.forEach(m => {
                if (deliveredMaterials[u.id]?.[m.id]) deliveredItems++;
            });
        });

        return {
            totalMaterials: totalItems,
            delivered: deliveredItems,
            percentage: totalItems > 0 ? Math.round((deliveredItems / totalItems) * 100) : 0
        };
    }, [filteredVolunteers, visibleMaterials, deliveredMaterials]);

    const handlePrint = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text('Entrega de Materiales', 14, 22);

        // Subtitle with filters info
        doc.setFontSize(10);
        let filterText = `Filtros: ${selectedMaterialId !== 'all' ? materials.find(m => m.id === selectedMaterialId)?.name : 'Todos los materiales'}`;
        if (selectedSize !== 'all') filterText += `, Talle: ${selectedSize}`;
        doc.text(filterText, 14, 28);

        const tableData = filteredVolunteers.map(v => {
            const row: string[] = [v.fullName, v.tshirtSize || '-', ...visibleMaterials.map(m => {
                return '(__)';
            })];
            return row;
        });

        autoTable(doc, {
            head: [['Voluntario', 'Talle', ...visibleMaterials.map(m => m.name)]],
            body: tableData,
            startY: 35,
        });

        doc.save(`entrega-materiales-${selectedMaterialId !== 'all' ? 'filtrado' : 'completo'}.pdf`);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 min-h-screen">
            {/* Header Sticky */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                                <Package className="text-[#8CB83E]" size={24} />
                                Control de Materiales
                            </h1>
                            <p className="text-sm text-gray-500 hidden sm:block">Registra la entrega de items a voluntarios</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="max-w-7xl mx-auto flex items-center gap-4">
                    <div className="flex-1">
                        <div className="flex justify-between text-sm font-medium mb-1">
                            <span className="text-gray-600">Progreso Total</span>
                            <span className="text-[#8CB83E]">{stats.percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                                className="bg-[#8CB83E] h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${stats.percentage}%` }}
                            ></div>
                        </div>
                    </div>
                    <div className="hidden sm:flex text-sm text-gray-500 gap-4">
                        <div className="flex flex-col items-center">
                            <span className="font-bold text-gray-900">{stats.delivered}</span>
                            <span className="text-xs uppercase">Entregados</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="font-bold text-gray-900">{stats.totalMaterials}</span>
                            <span className="text-xs uppercase">Total Items</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls & Filters */}
            <div className="px-4 py-4 max-w-7xl mx-auto w-full flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar voluntario..."
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#8CB83E] focus:border-[#8CB83E]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handlePrint}
                        className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className='block text-xs font-medium text-gray-500 mb-1'>Filtrar por Material</label>
                        <select
                            value={selectedMaterialId}
                            onChange={(e) => setSelectedMaterialId(e.target.value)}
                            className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-[#8CB83E] focus:border-[#8CB83E] sm:text-sm"
                        >
                            <option value="all">Todos los Materiales</option>
                            {materials.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className='block text-xs font-medium text-gray-500 mb-1'>Filtrar por Talle</label>
                        <select
                            value={selectedSize}
                            onChange={(e) => setSelectedSize(e.target.value)}
                            className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-[#8CB83E] focus:border-[#8CB83E] sm:text-sm"
                        >
                            <option value="all">Todos los Talles</option>
                            {availableSizes.map(size => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto px-4 pb-20 max-w-7xl mx-auto w-full">
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8CB83E]"></div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredVolunteers.map(volunteer => (
                            <div key={volunteer.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-medium text-gray-900">{volunteer.fullName}</h3>
                                    <div className="text-sm text-gray-500 flex gap-3 mt-1">
                                        <span>Talle: <span className="font-semibold text-gray-700">{volunteer.tshirtSize || 'N/A'}</span></span>
                                        <span>|</span>
                                        <span>DNI: {volunteer.dni}</span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {visibleMaterials.map(material => {
                                        const isDelivered = deliveredMaterials[volunteer.id]?.[material.id];
                                        return (
                                            <button
                                                key={material.id}
                                                onClick={() => toggleDelivery(volunteer.id, material.id)}
                                                className={`
                                                    flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors border
                                                    ${isDelivered
                                                        ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}
                                                `}
                                            >
                                                {isDelivered ? (
                                                    <CheckCircle size={16} className="text-green-600" />
                                                ) : (
                                                    <Circle size={16} className="text-gray-400" />
                                                )}
                                                {material.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        {filteredVolunteers.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                No se encontraron voluntarios con los filtros seleccionados.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MaterialDeliveryList;
