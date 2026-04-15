
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Printer, User } from 'lucide-react';
import { supabaseApi as mockApi } from '../services/supabaseApiService';
import type { Event } from '../types';
import { toast } from 'react-hot-toast';
const baseUrl = import.meta.env.BASE_URL || '/';
const voluntarioImg = `${baseUrl}VOLUNTARIO.png`;
const coordinadorImg = `${baseUrl}COORDINADOR.png`;

interface VolunteerBadgesProps {
    eventId: string;
    onClose: () => void;
}

interface BadgeData {
    id: string;
    volunteerName: string;
    roleName: string;
}

const VolunteerBadges: React.FC<VolunteerBadgesProps> = ({ eventId, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [badges, setBadges] = useState<BadgeData[]>([]);
    const [event, setEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [eventId]);

    // Update selected IDs when badges change (initially select all)
    useEffect(() => {
        if (badges.length > 0 && selectedIds.size === 0) {
            setSelectedIds(new Set(badges.map(b => b.id)));
        }
    }, [badges]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [eventData, bookings, allShifts] = await Promise.all([
                mockApi.getEventById(eventId),
                mockApi.getBookingsByEvent(eventId),
                mockApi.getShiftsByEvent(eventId)
            ]);

            setEvent(eventData);

            // Fetch all users to get names
            const allUsers = await mockApi.getAllUsers();

            // Set to keep track of unique UserID-Role combinations
            const uniqueEntries = new Set<string>();
            const badgeList: BadgeData[] = [];

            // 1. Process Bookings (Volunteers)
            // If they have confirmed bookings, they get a 'Voluntario' badge
            bookings.filter(b => b.status === 'confirmed').forEach(b => {
                const user = allUsers.find(u => u.id === b.userId);
                if (user) {
                    const key = `${user.id}|Voluntario`;
                    if (!uniqueEntries.has(key)) {
                        uniqueEntries.add(key);
                        badgeList.push({
                            id: key,
                            volunteerName: user.fullName,
                            roleName: 'Voluntario'
                        });
                    }
                }
            });

            // 2. Process Coordinators
            // If they are assigned as coordinators in any shift, they get a 'Coordinador' badge
            allShifts.forEach(shift => {
                if (shift.coordinatorIds) {
                    shift.coordinatorIds.forEach(coordId => {
                        const user = allUsers.find(u => u.id === coordId);
                        if (user) {
                            const key = `${user.id}|Coordinador`;
                            if (!uniqueEntries.has(key)) {
                                uniqueEntries.add(key);
                                badgeList.push({
                                    id: key,
                                    volunteerName: user.fullName,
                                    roleName: 'Coordinador'
                                });
                            }
                        }
                    });
                }
            });

            badgeList.sort((a, b) => a.volunteerName.localeCompare(b.volunteerName));
            setBadges(badgeList);
        } catch (error) {
            console.error('Error fetching badge data:', error);
            toast.error('Error al cargar datos para credenciales');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrint = () => {
        if (selectedIds.size === 0) {
            toast.error('No hay credenciales seleccionadas para imprimir');
            return;
        }
        window.print();
    };

    const toggleSelectAll = () => {
        const filtered = badges.filter(b => 
            b.volunteerName.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(b => b.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const filteredBadges = badges.filter(b => 
        b.volunteerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8CB83E]"></div>
                <p className="mt-4 text-gray-500 font-medium">Preparando credenciales...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20 print:bg-white print:pb-0 print:min-h-0">
            {/* Header - Hidden on print */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-50 print:hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 leading-tight">Credenciales</h2>
                                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">{event?.nombre}</p>
                            </div>
                        </div>

                        <div className="flex flex-1 max-w-md">
                            <div className="relative w-full">
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8CB83E] focus:border-transparent outline-none"
                                />
                                <div className="absolute left-3 top-2.5 text-gray-400">
                                    <User size={18} />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-right mr-2">
                                <p className="text-sm font-bold text-gray-900">{selectedIds.size} seleccionadas</p>
                                <button 
                                    onClick={toggleSelectAll}
                                    className="text-xs text-[#8CB83E] font-semibold hover:underline"
                                >
                                    {selectedIds.size === filteredBadges.length ? 'Deseleccionar todas' : 'Seleccionar visibles'}
                                </button>
                            </div>
                            <button
                                onClick={handlePrint}
                                disabled={selectedIds.size === 0}
                                className="flex items-center justify-center gap-2 bg-[#8CB83E] text-white px-6 py-2.5 rounded-xl hover:bg-[#7cb342] font-bold shadow-lg shadow-green-100 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
                            >
                                <Printer size={20} />
                                Imprimir Selección
                            </button>
                        </div>
                    </div>
                </div>
            </div>



            {/* Badges Container */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 print:p-0 print:m-0 print:max-w-none">
                {/* Mosaic and Styles */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                        @media print {
                            @page {
                                size: A4 portrait;
                                margin: 10mm;
                            }
                            /* Force everything to white background except cards */
                            html, body, #root, .min-h-screen, .bg-gray-50, .max-w-7xl, .badge-mosaic {
                                background-color: white !important;
                                background-image: none !important;
                            }
                            body {
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            .print-container {
                                display: block !important;
                                padding: 0 !important;
                                margin: 0 !important;
                                width: 100% !important;
                                max-width: none !important;
                                background-color: white !important;
                            }
                            .badge-mosaic {
                                display: grid !important;
                                grid-template-columns: repeat(2, 90mm) !important;
                                gap: 0 !important; 
                                row-gap: 0 !important;
                                justify-content: center !important;
                                align-content: start !important;
                                margin: 0 auto !important;
                                padding: 0 !important;
                                background-color: white !important;
                            }
                            .badge-card {
                                display: none !important;
                            }
                            .badge-card.selected {
                                display: flex !important;
                                width: 90mm !important;
                                height: 110mm !important;
                                border: 0.1mm solid #eee !important;
                                margin: 0 !important;
                                box-shadow: none !important;
                                break-inside: avoid;
                                page-break-inside: avoid;
                                background-size: cover !important;
                                background-position: center !important;
                                background-repeat: no-repeat !important;
                                transform: none !important;
                                box-sizing: border-box !important;
                                background-color: white !important; /* Ensure card background is white */
                            }
                            .no-print {
                                display: none !important;
                            }
                        }

                    .badge-mosaic {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, 90mm);
                        gap: 20px;
                        justify-content: center;
                    }

                    .badge-card {
                        width: 90mm;
                        height: 110mm;
                        background: white;
                        background-size: cover;
                        background-position: center;
                        background-repeat: no-repeat;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                        position: relative;
                        transition: all 0.2s;
                        flex-shrink: 0;
                        cursor: pointer;
                    }

                    .badge-card.selected {
                        border-color: #8CB83E;
                        border-width: 4px;
                        box-shadow: 0 0 0 4px rgba(140, 184, 62, 0.2);
                        transform: scale(1.02);
                    }

                    .name-container {
                        position: absolute;
                        top: calc(48% - 7px);
                        left: 0;
                        right: 0;
                        transform: translateY(-50%);
                        text-align: center;
                        padding: 0 10mm;
                        pointer-events: none;
                    }

                    .selection-overlay {
                        position: absolute;
                        top: 10px;
                        left: 10px;
                        z-index: 20;
                    }

                    .custom-checkbox {
                        width: 24px;
                        height: 24px;
                        border: 2px solid #8CB83E;
                        border-radius: 6px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: white;
                        transition: all 0.2s;
                    }
                `}} />

                <div className="badge-mosaic print-container">
                    {filteredBadges.map((badge) => {
                        const isSelected = selectedIds.has(badge.id);
                        return (
                            <div 
                                key={badge.id} 
                                className={`badge-card ${isSelected ? 'selected' : ''}`}
                                id={`badge-${badge.id}`}
                                onClick={() => toggleSelect(badge.id)}
                                style={{ 
                                    backgroundImage: `url("${badge.roleName === 'Coordinador' ? coordinadorImg : voluntarioImg}")` 
                                }}
                            >
                                {/* Selection Indicator */}
                                <div className="selection-overlay print:hidden">
                                    <div className={`custom-checkbox ${isSelected ? 'checked' : ''}`}>
                                        {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                                    </div>
                                </div>

                                {/* Volunteer Name centered in the card */}
                                <div className="name-container">
                                    <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tight leading-tight break-words">
                                        {badge.volunteerName}
                                    </h2>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredBadges.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                        <User size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-gray-900">Sin resultados</h3>
                        <p className="text-gray-500">No se encontraron voluntarios que coincidan con su búsqueda.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VolunteerBadges;
