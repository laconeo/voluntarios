
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Printer, User } from 'lucide-react';
import { supabaseApi as mockApi } from '../services/supabaseApiService';
import type { Event } from '../types';
import { toast } from 'react-hot-toast';

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
    const [badges, setBadges] = useState<BadgeData[]>([]);
    const [event, setEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [eventId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [eventData, bookings, allShifts, roles] = await Promise.all([
                mockApi.getEventById(eventId),
                mockApi.getBookingsByEvent(eventId),
                mockApi.getShiftsByEvent(eventId),
                mockApi.getRolesByEvent(eventId)
            ]);

            setEvent(eventData);

            // Fetch all users to get names
            const allUsers = await mockApi.getAllUsers();

            // Map to ensure uniqueness by User ID
            const uniqueVolunteers = new Map<string, { name: string, isCoordinator: boolean }>();

            // 1. Process Bookings (Volunteers)
            bookings.filter(b => b.status === 'confirmed').forEach(b => {
                const user = allUsers.find(u => u.id === b.userId);
                if (user) {
                    // Check if already exists to preserve 'isCoordinator' true if set
                    const existing = uniqueVolunteers.get(user.id);
                    if (!existing) {
                        uniqueVolunteers.set(user.id, { name: user.fullName, isCoordinator: false });
                    }
                }
            });

            // 2. Process Coordinators (Upgrade role if exists, or add)
            allShifts.forEach(shift => {
                if (shift.coordinatorIds) {
                    shift.coordinatorIds.forEach(coordId => {
                        const user = allUsers.find(u => u.id === coordId);
                        if (user) {
                            uniqueVolunteers.set(user.id, { name: user.fullName, isCoordinator: true });
                        }
                    });
                }
            });

            // Convert Map to BadgeData array
            const badgeList: BadgeData[] = Array.from(uniqueVolunteers.entries()).map(([userId, data]) => ({
                id: userId,
                volunteerName: data.name,
                roleName: data.isCoordinator ? 'Coordinador' : 'Voluntario'
            }));

            // Sort alphabetically
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
        window.print();
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8CB83E]"></div>
                <p className="mt-4 text-gray-500 font-medium">Preparando credenciales...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header - Hidden on print */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <button
                            onClick={onClose}
                            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-2"
                        >
                            <ChevronLeft size={20} />
                            Volver al dashboard
                        </button>
                        <h2 className="text-2xl font-bold text-gray-900">Credenciales de Voluntarios</h2>
                        <p className="text-sm text-gray-500">{event?.nombre} • {badges.length} credenciales únicas</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handlePrint}
                            className="flex items-center justify-center gap-2 bg-[#8CB83E] text-white px-6 py-2.5 rounded-xl hover:bg-[#7cb342] font-bold shadow-lg shadow-green-100 transition-all active:scale-95"
                        >
                            <Printer size={20} />
                            Imprimir Todas
                        </button>
                    </div>
                </div>
            </div>



            {/* Badges Container */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {/* Mosaic and Styles */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        @page {
                            size: A4;
                            margin: 10mm;
                        }
                        body {
                            background: white;
                            -webkit-print-color-adjust: exact;
                        }
                        .print-container {
                            display: block !important;
                            padding: 0 !important;
                            margin: 0 !important;
                        }
                        .badge-mosaic {
                            display: grid !important;
                            grid-template-columns: repeat(3, 59mm) !important;
                            gap: 0 !important;
                            row-gap: 5mm !important; /* Separación vertical */
                            justify-content: start !important;
                        }
                        .badge-card {
                            width: 59mm !important;
                            height: 85mm !important;
                            border: 0.2mm dashed #ccc !important; /* Borde de corte sutil */
                            margin: 0 !important;
                            box-shadow: none !important;
                            break-inside: avoid;
                            page-break-inside: avoid;
                            background: white !important;
                        }

                        /* Single Print Logic */
                        body.printing-single .badge-card:not(.to-print) {
                            display: none !important;
                        }
                        body.printing-single .badge-mosaic {
                            display: flex !important;
                            justify-content: center !important;
                            grid-template-columns: none !important;
                        }
                        
                        .no-print {
                            display: none !important;
                        }
                    }

                    .badge-mosaic {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, 59mm);
                        gap: 20px;
                        justify-content: center;
                    }

                    .badge-card {
                        width: 59mm;
                        height: 85mm;
                        background: white;
                        border: 1px solid #e5e7eb;
                        border-radius: 8px; /* Solo en pantalla */
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                        position: relative;
                        transition: transform 0.2s;
                        flex-shrink: 0; /* Evita que se encojan */
                    }

                    @media screen {
                        .badge-card:hover {
                            transform: translateY(-4px);
                            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
                        }
                    }

                    .print-individual-btn {
                        position: absolute;
                        top: 5px;
                        right: 5px;
                        background: white;
                        padding: 5px;
                        border-radius: 50%;
                        color: #8CB83E;
                        border: 1px solid #e5e7eb;
                        opacity: 0;
                        transition: all 0.2s;
                        z-index: 20;
                        cursor: pointer;
                    }

                    .badge-card:hover .print-individual-btn {
                        opacity: 1;
                    }
                `}} />

                <div className="badge-mosaic print-container">
                    {badges.map((badge) => (
                        <div key={badge.id} className="badge-card" id={`badge - ${badge.id} `}>
                            {/* Individual Print Button - Hidden on Print */}
                            <button
                                onClick={() => {
                                    const card = document.getElementById(`badge - ${badge.id} `);
                                    document.body.classList.add('printing-single');
                                    card?.classList.add('to-print');
                                    window.print();
                                    // Cleanup after print
                                    window.addEventListener('afterprint', () => {
                                        document.body.classList.remove('printing-single');
                                        card?.classList.remove('to-print');
                                    }, { once: true });
                                }}
                                className="print-individual-btn print:hidden shadow-sm hover:bg-green-50"
                                title="Imprimir solo esta credencial"
                            >
                                <Printer size={14} />
                            </button>

                            {/* Top Accent */}
                            <div className="h-3 bg-[#8CB83E]" />

                            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">

                                {/* 1. NOMBRE GIGANTE */}
                                <h2 className="text-2xl font-black text-gray-900 leading-tight mb-3 break-words w-full">
                                    {badge.volunteerName}
                                </h2>

                                {/* 2. Evento Pequeño */}
                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6 px-2">
                                    {event?.nombre || 'Evento'}
                                </div>

                                {/* 3. Rol */}
                                <span className={`inline - block px - 4 py - 1.5 text - sm font - bold rounded - lg border - 2 
                                    ${badge.roleName === 'Coordinador'
                                        ? 'bg-[#8CB83E] text-white border-[#8CB83E]'
                                        : 'bg-white text-gray-600 border-gray-200'
                                    } `}
                                >
                                    {badge.roleName.toUpperCase()}
                                </span>

                            </div>

                            {/* Bottom Decoration */}
                            <div className="h-2 bg-gray-100" />
                        </div>
                    ))}
                </div>

                {badges.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                        <Users size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-gray-900">Sin datos para imprimir</h3>
                        <p className="text-gray-500">No hay voluntarios confirmados en este evento todavía.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VolunteerBadges;
