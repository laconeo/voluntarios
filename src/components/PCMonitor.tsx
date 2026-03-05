import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { pcControlService } from '../services/pcControlService';
import { supabaseApi as mockApi } from '../services/supabaseApiService';
import type { PCStatus, Event } from '../types';
import { Monitor, User, Clock, AlertTriangle, Unlock, Settings, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useParams } from 'react-router-dom';

interface PCMonitorProps {
    // Cuando se renderiza desde un dashboard (sin cambio de URL),
    // se pueden pasar el slug/id del evento directamente.
    eventSlugProp?: string;
    eventIdProp?: string;
}

const PCMonitor: React.FC<PCMonitorProps> = ({ eventSlugProp, eventIdProp }) => {
    const [pcs, setPcs] = useState<PCStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const params = useParams<{ eventSlug: string }>();
    // Props tienen prioridad sobre la URL
    const eventSlug = eventSlugProp ?? params.eventSlug;
    const [eventData, setEventData] = useState<Event | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    // Local draft for the settings panel (not yet saved)
    const [draftCount, setDraftCount] = useState<number>(20);
    const [savingConfig, setSavingConfig] = useState(false);

    // Derived: how many PCs this event has (from the event record itself, or localStorage fallback)
    const cantidadPCs = eventData?.cantidadPCs ?? null;

    const fetchPcs = useCallback(async (evId?: string) => {
        try {
            const data = await pcControlService.getAllPcsStatus(evId);
            const sorted = data.sort((a, b) => a.id - b.id);
            setPcs(sorted);
        } catch (error) {
            console.error('Error fetching PCs:', error);
            toast.error('Error al cargar estado de PCs');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            if (eventSlug) {
                const data = await mockApi.getEventBySlug(eventSlug);
                if (data) {
                    // Fallback: si la BD no devuelve cantidadPCs (columna no existe aún / migración pendiente),
                    // leemos el valor guardado en localStorage para este slug.
                    const lsKey = `pc_monitor_config_${eventSlug}`;
                    let localCount: number | undefined;
                    try {
                        const saved = localStorage.getItem(lsKey);
                        if (saved) {
                            const parsed = JSON.parse(saved);
                            localCount = typeof parsed?.count === 'number' ? parsed.count : undefined;
                        }
                    } catch { /* ignore */ }

                    if (data.cantidadPCs == null && localCount != null) {
                        data.cantidadPCs = localCount;
                    }

                    setEventData(data);
                    setDraftCount(data.cantidadPCs ?? localCount ?? 20);
                    await fetchPcs(data.id);
                } else {
                    await fetchPcs();
                }
            } else {
                await fetchPcs();
            }
        };
        init();

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
    }, [eventSlug]);

    const handleRealtimeUpdate = (payload: any) => {
        if (payload.eventType === 'UPDATE') {
            setPcs((prev) =>
                prev.map((pc) =>
                    pc.id === payload.new.id ? { ...pc, ...payload.new } : pc
                )
            );
        } else if (payload.eventType === 'INSERT') {
            // Only add if it belongs to the current event (or no event filter)
            if (!eventData || payload.new.evento_id === eventData.id) {
                setPcs((prev) => {
                    const exists = prev.find(p => p.id === payload.new.id);
                    if (exists) return prev;
                    return [...prev, payload.new].sort((a, b) => a.id - b.id);
                });
            }
        }
        // Refresh to get joined volunteer info when voluntario_id changes
        if (payload.new?.voluntario_id) {
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

    const handleSaveConfig = async () => {
        if (!eventData) return;
        if (draftCount < 1 || draftCount > 100) {
            toast.error('La cantidad de PCs debe estar entre 1 y 100');
            return;
        }
        setSavingConfig(true);
        try {
            // Siempre guardamos en localStorage como fallback (por si la migración SQL no se ejecutó)
            if (eventSlug) {
                localStorage.setItem(`pc_monitor_config_${eventSlug}`, JSON.stringify({ count: draftCount }));
            }

            // Intentamos guardar en la BD
            try {
                const updated = await mockApi.updateEvent(eventData.id, { cantidadPCs: draftCount });
                setEventData({ ...updated, cantidadPCs: draftCount }); // forzamos el valor por si la col no existe
                toast.success(`✅ ${draftCount} PCs configuradas para ${updated.nombre}`);
            } catch (dbError: any) {
                // Si la BD falla (columna no existe), el localStorage ya tiene el valor
                // Actualizamos el eventData local manualmente
                setEventData(prev => prev ? { ...prev, cantidadPCs: draftCount } : prev);
                console.warn('[PCMonitor] BD no aceptó cantidadPCs (¿migración SQL pendiente?):', dbError.message);
                toast.success(`✅ ${draftCount} PCs configuradas (guardado localmente)`);
                toast('⚠️ Para persistir en la BD ejecutá la migración SQL en Supabase.', { icon: '⚠️', duration: 6000 });
            }

            setShowSettings(false);
        } finally {
            setSavingConfig(false);
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
            if (limit) {
                const now = new Date();
                const end = new Date(limit);
                const diffMinutes = (end.getTime() - now.getTime()) / 60000;
                if (diffMinutes < 2 && diffMinutes > 0) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
                if (diffMinutes <= 0) return 'bg-red-100 border-red-300 text-red-800 animate-pulse';
            }
            return 'bg-blue-100 border-blue-300 text-blue-800';
        }
        if (status === 'bloqueada') return 'bg-gray-200 border-gray-400 text-gray-600';
        if (status === 'mantenimiento') return 'bg-orange-100 border-orange-300 text-orange-800';
        return 'bg-white border-gray-200';
    };

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

    // ------------------------------------------------------------------
    // Render: PCs que se muestran en el grid
    // Si hay cantidadPCs configurada → mostramos ese rango (sin importar si
    //   la PC está o no en la BD aún); las faltantes aparecen como "disponible".
    // Si no hay cantidadPCs como fuente de verdad:
    //   - Si hay PCs en la BD filtradas → las mostramos todas
    //   - Si no hay ninguna → mostramos placeholder de configuración
    // ------------------------------------------------------------------
    const renderGrid = () => {
        if (cantidadPCs !== null && cantidadPCs > 0) {
            // IDs de la BD para este evento (las que ya se registraron)
            const registeredIds = new Set(pcs.map(p => p.id));
            // Crear lista de IDs desde 1 hasta cantidadPCs
            // Los IDs reales en BD los usamos directamente; los restantes son fantasmas "disponible"
            const allIds = Array.from({ length: cantidadPCs }, (_, i) => i + 1);
            return allIds.map(id => {
                const pc = pcs.find(p => p.id === id) || { id, estado: 'disponible' } as PCStatus;
                return <PCCard key={id} pc={pc} />;
            });
        }

        if (pcs.length > 0) {
            return pcs.map(pc => <PCCard key={pc.id} pc={pc} />);
        }

        // No hay config ni PCs aún
        return (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <AlertTriangle size={48} className="text-amber-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    Sin computadoras configuradas
                </h3>
                <p className="text-gray-500 text-sm max-w-sm">
                    Configurá la cantidad de PCs para este evento usando el botón{' '}
                    <strong>Configurar PCs</strong> de arriba.
                </p>
            </div>
        );
    };

    if (loading) return <div className="text-center p-10">Cargando monitor...</div>;

    const configButtonLabel = cantidadPCs
        ? `${cantidadPCs} PCs configuradas`
        : 'Configurar PCs del evento';

    return (
        <div className="p-4">
            {/* Header */}
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
                            {cantidadPCs !== null && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                                    {cantidadPCs} PCs
                                </span>
                            )}
                        </p>
                    ) : (
                        <p className="text-gray-600 text-sm mt-1">Control de tiempo y disponibilidad de computadoras</p>
                    )}
                </div>

                <div className="flex flex-col gap-3 items-end">
                    {/* Leyenda de estados */}
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

                    {/* Botón de configuración (solo si hay evento) */}
                    {eventData && (
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="text-sm flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors bg-white border border-gray-300 px-3 py-1.5 rounded-md shadow-sm"
                        >
                            <Settings size={16} />
                            {showSettings ? 'Ocultar Configuración' : configButtonLabel}
                        </button>
                    )}
                </div>
            </div>

            {/* Panel de configuración */}
            {showSettings && eventData && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-inner animate-fade-in-down">
                    <h3 className="font-semibold text-blue-800 mb-1 flex items-center gap-2">
                        <Settings size={16} />
                        Configuración de PCs — {eventData.nombre}
                    </h3>
                    <p className="text-xs text-blue-600 mb-4">
                        La cantidad queda guardada en el evento y se aplica a todos los monitores de este stand.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Cantidad de Computadoras
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                ¿Cuántas PCs tiene el stand de <strong>{eventData.nombre}</strong>?
                            </p>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={draftCount}
                                onChange={(e) => setDraftCount(Number(e.target.value) || 1)}
                                className="w-full border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setDraftCount(eventData.cantidadPCs ?? 20); setShowSettings(false); }}
                                className="px-4 py-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors text-sm font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveConfig}
                                disabled={savingConfig}
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-60 text-sm"
                            >
                                <Save size={16} />
                                {savingConfig ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>

                    {cantidadPCs !== null && (
                        <p className="mt-3 text-xs text-blue-600">
                            ✓ Actualmente configurado: <strong>{cantidadPCs} PCs</strong> para este evento.
                        </p>
                    )}
                </div>
            )}

            {/* Grid de PCs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {renderGrid()}
            </div>
        </div>
    );
};

export default PCMonitor;
