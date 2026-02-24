import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { pcControlService } from '../services/pcControlService';
import type { PCStatus } from '../types';
import { Monitor, User, Clock, AlertTriangle, RefreshCw, Unlock, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { supabaseApi as mockApi } from '../services/supabaseApiService';
import type { Event } from '../types';

const PCMonitor: React.FC = () => {
    const [pcs, setPcs] = useState<PCStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const { eventSlug } = useParams<{ eventSlug: string }>();
    const [eventData, setEventData] = useState<Event | null>(null);

    useEffect(() => {
        fetchPcs();

        if (eventSlug) {
            mockApi.getEventBySlug(eventSlug).then(data => {
                if (data) setEventData(data);
            });
        }

        // Subscribe to realtime changes
        const channel = supabase
            .channel('public:pcs_status')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'pcs_status' },
                (payload) => {
                    handleRealtimeUpdate(payload);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchPcs = async () => {
        try {
            const data = await pcControlService.getAllPcsStatus();
            // Ensure we have 20 PCs in the state even if DB returns fewer or unordered
            const sorted = data.sort((a, b) => a.id - b.id);
            setPcs(sorted);
        } catch (error) {
            console.error('Error fetching PCs:', error);
            toast.error('Error al cargar estado de PCs');
        } finally {
            setLoading(false);
        }
    };

    const handleRealtimeUpdate = (payload: any) => {
        if (payload.eventType === 'UPDATE') {
            setPcs((prev) =>
                prev.map((pc) =>
                    pc.id === payload.new.id ? { ...pc, ...payload.new } : pc
                )
            );
        } else if (payload.eventType === 'INSERT') {
            setPcs((prev) => {
                const exists = prev.find(p => p.id === payload.new.id);
                if (exists) return prev;
                return [...prev, payload.new].sort((a, b) => a.id - b.id);
            });
        }
        // Note: We might need to refresh the "volunteer" joined data if only the ID changed in the payload
        // Ideally, we would fetch the single PC again to get the joined volunteer info.
        if (payload.new.voluntario_id) {
            pcControlService.getPcStatus(payload.new.id).then(updatedPc => {
                if (updatedPc) {
                    setPcs(prev => prev.map(p => p.id === updatedPc.id ? updatedPc : p));
                }
            });
        }
    };

    const handleReset = async (id: number) => {
        if (!window.confirm(`¿Estás seguro de resetear la PC ${id}? Esto cerrará la sesión actual.`)) return;
        try {
            await pcControlService.resetPc(id);
            toast.success(`PC ${id} reseteada`);
        } catch (error) {
            toast.error('Error al resetear PC');
        }
    };

    const calculateTimeRemaining = (limit: string) => {
        const now = new Date();
        const end = new Date(limit);
        const diffMs = end.getTime() - now.getTime();
        if (diffMs <= 0) return '00:00';
        const minutes = Math.floor(diffMs / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getStatusColor = (status: string, limit?: string) => {
        if (status === 'disponible') return 'bg-green-100 border-green-300 text-green-800';
        if (status === 'ocupada') {
            // Check if near limit (less than 2 mins)
            if (limit) {
                const now = new Date();
                const end = new Date(limit);
                const diffMinutes = (end.getTime() - now.getTime()) / 60000;
                if (diffMinutes < 2 && diffMinutes > 0) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
                if (diffMinutes <= 0) return 'bg-red-100 border-red-300 text-red-800 animate-pulse'; // Time's up
            }
            return 'bg-blue-100 border-blue-300 text-blue-800';
        }
        if (status === 'bloqueada') return 'bg-gray-200 border-gray-400 text-gray-600';
        if (status === 'mantenimiento') return 'bg-orange-100 border-orange-300 text-orange-800';
        return 'bg-white border-gray-200';
    };

    // Component to render individual PC Card
    const PCCard = ({ pc }: { pc: PCStatus }) => {
        const [timeLeft, setTimeLeft] = useState(pc.tiempo_limite ? calculateTimeRemaining(pc.tiempo_limite) : '--:--');

        useEffect(() => {
            if (pc.estado === 'ocupada' && pc.tiempo_limite) {
                const interval = setInterval(() => {
                    setTimeLeft(calculateTimeRemaining(pc.tiempo_limite!));
                }, 1000);
                return () => clearInterval(interval);
            } else {
                setTimeLeft('--:--');
            }
        }, [pc.estado, pc.tiempo_limite]);

        return (
            <div className={`border rounded-lg p-4 shadow-sm flex flex-col justify-between h-40 transition-colors duration-300 ${getStatusColor(pc.estado, pc.tiempo_limite)}`}>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <Monitor size={20} />
                        <span className="font-bold text-lg">PC {pc.id}</span>
                    </div>
                    <div className="text-xs font-semibold px-2 py-1 rounded-full bg-white/50 border border-white/20 uppercase">
                        {pc.estado}
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-center gap-1 my-2">
                    {pc.estado === 'ocupada' && (
                        <>
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <User size={16} />
                                <span className="truncate" title={pc.voluntario?.fullName || 'Desconocido'}>
                                    {pc.voluntario?.fullName || 'Voluntario'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-lg font-bold font-mono">
                                <Clock size={16} />
                                <span>{timeLeft}</span>
                            </div>
                        </>
                    )}
                    {pc.estado === 'disponible' && (
                        <span className="text-sm italic opacity-75">Esperando usuario...</span>
                    )}
                </div>

                <div className="flex justify-end pt-2 border-t border-black/5">
                    {pc.estado !== 'disponible' && (
                        <button
                            onClick={() => handleReset(pc.id)}
                            className="bg-white/80 hover:bg-white text-gray-700 hover:text-red-600 p-1.5 rounded transition-colors"
                            title="Resetear / Liberar"
                        >
                            <Unlock size={16} />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    if (loading) return <div className="text-center p-10">Cargando monitor...</div>;

    return (
        <div className="p-4">
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Monitor className="text-primary-600" />
                        Monitor de Stand
                    </h2>
                    {eventData ? (
                        <p className="text-gray-600 font-medium flex items-center gap-1 mt-1">
                            {eventData.nombre}
                            <span className="text-gray-400 text-sm ml-2 font-normal">
                                {eventData.fechaInicio ? new Date(eventData.fechaInicio).toLocaleDateString() : ''}
                            </span>
                        </p>
                    ) : (
                        <p className="text-gray-600 text-sm mt-1">Control de tiempo y disponibilidad de computadoras</p>
                    )}
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-1 text-xs">
                        <div className="w-3 h-3 bg-green-200 border border-green-400 rounded"></div> Libre
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                        <div className="w-3 h-3 bg-blue-200 border border-blue-400 rounded"></div> Ocupada
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                        <div className="w-3 h-3 bg-yellow-200 border border-yellow-400 rounded"></div> &lt; 2 min
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                        <div className="w-3 h-3 bg-red-200 border border-red-400 rounded"></div> Tiempo Agotado
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from({ length: 20 }, (_, i) => i + 1).map(id => {
                    const pc = pcs.find(p => p.id === id) || { id, estado: 'disponible' } as PCStatus;
                    return <PCCard key={id} pc={pc} />;
                })}
            </div>
        </div>
    );
};

export default PCMonitor;
