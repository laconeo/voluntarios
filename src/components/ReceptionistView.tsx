import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Monitor, Clock, Users, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabaseApi as mockApi } from '../services/supabaseApiService';
import { pcControlService } from '../services/pcControlService';
import { supabase } from '../lib/supabaseClient';
import { parseSafeDate } from '../lib/utils';
import type { PCStatus, Event } from '../types';

const FS_GREEN = '#8CB83E';
const FS_BLUE = '#005994';
const FS_DARK = '#282829';
const FS_BORDER = '#dcdcdc';

const ReceptionistView: React.FC = () => {
    const { eventSlug } = useParams<{ eventSlug: string }>();
    const [event, setEvent] = useState<Event | null>(null);
    const [pcs, setPcs] = useState<PCStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const navigate = useNavigate();

    const fetchPcs = useCallback(async (eventId: string) => {
        try {
            const data = await pcControlService.getAllPcsStatus(eventId);
            const sorted = (data || []).sort((a, b) => a.id - b.id);
            setPcs(sorted);
            setLastUpdate(new Date());
        } catch (err) {
            console.error('Error fetching PCs:', err);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            try {
                if (eventSlug) {
                    const found = await mockApi.getEventBySlug(eventSlug);
                    if (found && isMounted) {
                        setEvent(found);
                        await fetchPcs(found.id);

                        // Suscripción en tiempo real
                        const channel = supabase
                            .channel(`receptionist-${found.id}`)
                            .on('postgres_changes', {
                                event: '*',
                                schema: 'public',
                                table: 'pcs_status',
                                filter: `evento_id=eq.${found.id}`
                            }, () => {
                                if (isMounted) fetchPcs(found.id);
                            })
                            .subscribe();

                        return () => {
                            supabase.removeChannel(channel);
                        };
                    }
                }
            } catch (err) {
                console.error('Receptionist Init Error:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        init();
        return () => { isMounted = false; };
    }, [eventSlug, fetchPcs]);

    // Polling de respaldo cada 10s por si falla el realtime
    useEffect(() => {
        if (!event) return;
        const interval = setInterval(() => fetchPcs(event.id), 10000);
        return () => clearInterval(interval);
    }, [event, fetchPcs]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F3F3F3] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#8CB83E]"></div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-[#F3F3F3] flex items-center justify-center p-6 text-center">
                <div>
                    <h2 className="text-2xl font-bold text-[#282829] mb-2">Evento no encontrado</h2>
                    <p className="text-[#575757]">La URL ingresada no es válida.</p>
                </div>
            </div>
        );
    }

    const availablePcs = pcs.filter(pc => pc.estado === 'disponible');
    const occupiedPcs = pcs
        .filter(pc => pc.estado === 'ocupada' || pc.estado === 'pausa')
        .sort((a, b) => {
            const timeA = a.tiempo_limite ? new Date(a.tiempo_limite).getTime() : Infinity;
            const timeB = b.tiempo_limite ? new Date(b.tiempo_limite).getTime() : Infinity;
            return timeA - timeB;
        });

    return (
        <div className="min-h-screen bg-[#F8F9FA] font-sans flex flex-col">
            {/* Header Premium */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate(`/${eventSlug}/monitor`)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ArrowLeft size={20} className="text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">Recepcionista</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <p className="text-[#8CB83E] font-bold uppercase text-[10px] tracking-widest">{event.nombre}</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">Última actualización</div>
                        <div className="text-xs font-bold text-gray-600 flex items-center justify-end gap-1.5">
                            <Clock size={12} />
                            {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-8">
                
                {/* SECCIÓN 1: PCs DISPONIBLES (Prioridad Alta) */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-[#8CB83E]" />
                            PCs Libres para Asignar
                        </h2>
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
                            {availablePcs.length} Disponibles
                        </span>
                    </div>

                    {availablePcs.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {availablePcs.map(pc => (
                                <div 
                                    key={pc.id}
                                    className={`bg-white border-2 border-[#8CB83E] rounded-2xl p-4 flex flex-col items-center justify-center shadow-md animate-bounce-subtle animate-pulse-green`}
                                >
                                    <span className="text-3xl font-black text-[#8CB83E]">{pc.id}</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Libre</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                            <AlertCircle size={40} className="text-orange-400 mb-2" />
                            <h3 className="text-lg font-bold text-gray-800">No hay PCs libres</h3>
                            <p className="text-sm text-gray-500">Mira las próximas a liberarse abajo.</p>
                        </div>
                    )}
                </section>

                {/* SECCIÓN 2: PRÓXIMAS A LIBERARSE */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Clock size={16} className="text-[#005994]" />
                            Próximas a Liberarse
                        </h2>
                    </div>

                    <div className="space-y-3">
                        {occupiedPcs.length > 0 ? (
                            occupiedPcs.map((pc, index) => (
                                <PCListItem key={pc.id} pc={pc} isNext={index === 0} />
                            ))
                        ) : availablePcs.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <Monitor size={48} className="mx-auto mb-3 opacity-20" />
                                <p>No hay actividad en el stand actualmente.</p>
                            </div>
                        ) : null}
                    </div>
                </section>
            </main>
        </div>
    );
};

const PCListItem: React.FC<{ pc: PCStatus; isNext: boolean }> = ({ pc, isNext }) => {
    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        const update = () => {
            if (!pc.tiempo_limite) return;
            const limitDate = parseSafeDate(pc.tiempo_limite);
            const diff = Math.floor((limitDate.getTime() - Date.now()) / 1000);
            setTimeLeft(Math.max(0, diff));
        };
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [pc.tiempo_limite]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    const isPausing = pc.estado === 'pausa';
    const isExpiring = timeLeft < 60;

    return (
        <div className={`
            bg-white rounded-2xl p-4 border flex items-center justify-between transition-all
            ${isNext ? 'border-[#005994] border-l-8 shadow-md' : 'border-gray-200'}
            ${isExpiring && !isPausing ? 'border-red-200 bg-red-50' : ''}
        `}>
            <div className="flex items-center gap-4">
                <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl
                    ${isNext ? 'bg-[#005994] text-white' : 'bg-gray-100 text-gray-600'}
                `}>
                    {pc.id}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">
                            {isPausing ? 'En Pausa' : isExpiring ? 'Finalizando...' : 'Ocupada'}
                        </span>
                        {isNext && (
                            <span className="bg-[#005994] text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                Siguiente
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 truncate max-w-[120px] sm:max-w-none">
                        {pc.voluntario?.full_name || pc.voluntario_nombre_libre || 'Usuario'}
                    </p>
                </div>
            </div>

            <div className="text-right">
                <div className={`
                    text-xl font-mono font-bold leading-none
                    ${isExpiring && !isPausing ? 'text-red-600 animate-pulse' : isPausing ? 'text-purple-600' : 'text-gray-700'}
                `}>
                    {isPausing ? 'PAUSA' : formatTime(timeLeft)}
                </div>
                <p className="text-[10px] text-gray-400 font-medium uppercase mt-1">
                    {isPausing ? 'Vuelvo enseguida' : 'Restante'}
                </p>
            </div>
        </div>
    );
};

export default ReceptionistView;
