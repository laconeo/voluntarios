import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { pcControlService } from '../services/pcControlService';
import type { PCStatus } from '../types';
import { Clock, CheckSquare, Save, PlusCircle, Laptop } from 'lucide-react';
import { toast } from 'react-hot-toast';

/** Returns true if the session time has run out (or if there is no time limit). */
function isTimeExpired(pc: PCStatus): boolean {
    if (!pc.tiempo_limite) return true;
    try {
        const limit = new Date(pc.tiempo_limite).getTime();
        return Date.now() >= limit;
    } catch {
        return true;
    }
}

const AvailablePCView: React.FC<{ pc: PCStatus, onStartSession: () => void }> = ({ pc, onStartSession }) => {
    const [volunteers, setVolunteers] = useState<{ id: string, fullName: string }[]>([]);
    const [selectedUser, setSelectedUser] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        pcControlService.getActiveVolunteers().then(setVolunteers).catch(console.error);
    }, []);

    const handleStart = async () => {
        if (!selectedUser) {
            toast.error('Selecciona tu nombre');
            return;
        }
        setLoading(true);
        try {
            await pcControlService.startSession(pc.id, selectedUser, 20);
            toast.success('¡Sesión Iniciada!');
            onStartSession(); // Refresh parent to see new status
        } catch (error) {
            console.error(error);
            toast.error('Error al iniciar sesión');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckSquare size={40} className="text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">PC {pc.id} Disponible</h1>
                <p className="text-gray-600 mb-8">Selecciona tu nombre para comenzar a usar esta computadora.</p>

                <div className="space-y-4">
                    <div className="text-left">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Voluntario</label>
                        <select
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 p-3 border"
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                        >
                            <option value="">-- Buscar Nombre --</option>
                            {volunteers.map(v => (
                                <option key={v.id} value={v.id}>{v.fullName}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleStart}
                        disabled={loading}
                        className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Iniciando...' : 'Iniciar Sesión (20 min)'}
                    </button>

                    <div className="pt-4 text-xs text-gray-400">
                        Si no encuentras tu nombre, contacta al coordinador.
                    </div>
                </div>
            </div>
        </div>
    );
};

const PCOverlay: React.FC = () => {
    const { pcId } = useParams<{ pcId: string }>();
    const [pc, setPc] = useState<PCStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [actions, setActions] = useState('');
    const [peopleCount, setPeopleCount] = useState(0);
    const [extensionsCount, setExtensionsCount] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (pcId) {
            fetchPcStatus();
        }
    }, [pcId]);

    const fetchPcStatus = async () => {
        try {
            const data = await pcControlService.getPcStatus(parseInt(pcId!));
            setPc(data);
        } catch (error) {
            console.error('Error fetching PC:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSnooze = async () => {
        if (!pc) return;
        setSubmitting(true);
        try {
            await pcControlService.snoozePc(pc.id);
            setExtensionsCount(prev => prev + 1);
            toast.success('¡Tiempo extendido 5 minutos!');
            // Wait a moment for Python to pick up the change and hide the window
            setTimeout(() => {
                window.location.reload(); // Refresh or wait
            }, 2000);
        } catch (error) {
            toast.error('Error al extender tiempo');
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!pc || !pc.voluntario_id) return;
        if (!actions.trim()) {
            toast.error('Por favor selecciona una actividad.');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Save Report
            await pcControlService.createBitacora({
                pc_id: pc.id,
                voluntario_id: pc.voluntario_id,
                acciones_reportadas: {
                    description: actions,
                    people_helped: peopleCount,
                    extensions: extensionsCount
                },
                duracion_total: 20 + (extensionsCount * 5) // Approx duration
            });

            // 2. Free PC
            await pcControlService.resetPc(pc.id);

            toast.success('¡Reporte guardado! Gracias.');
            // Reload to show "Disponible" state
            setTimeout(() => {
                fetchPcStatus();
                setSubmitting(false);
                setActions('');
                setPeopleCount(0);
                setExtensionsCount(0);
            }, 1000);

        } catch (error) {
            console.error(error);
            toast.error('Error al guardar reporte');
            setSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100">Cargando...</div>;

    if (!pc) return <div className="min-h-screen flex items-center justify-center bg-red-100 text-red-600">PC no encontrada</div>;

    // If PC is available, show Login prompt
    if (pc.estado === 'disponible') {
        return <AvailablePCView pc={pc} onStartSession={() => fetchPcStatus()} />;
    }

    // If PC is occupied but time has NOT expired yet, show a neutral in-session screen.
    // The Python script will hide this window automatically; this is just a fallback.
    if (pc.estado === 'ocupada' && !isTimeExpired(pc)) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Laptop size={40} className="text-indigo-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Sesión en Curso</h1>
                    <p className="text-gray-500 text-sm">
                        {pc.voluntario?.fullName
                            ? `${pc.voluntario.fullName.split(' ')[0]} está usando esta PC.`
                            : 'Esta PC está siendo utilizada.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                <div className="bg-primary-600 p-6 text-white text-center">
                    <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                        <Clock size={32} />
                    </div>
                    <h1 className="text-2xl font-bold">¡Tiempo Completado!</h1>
                    <p className="opacity-90 mt-1">
                        Hola {pc.voluntario?.fullName?.split(' ')[0] || 'Voluntario'}, tu sesión de 20 minutos ha terminado.
                    </p>
                </div>

                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Reporte de Actividad</h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ¿Qué actividad realizaste?
                            </label>
                            <select
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 p-3 border"
                                value={actions}
                                onChange={(e) => setActions(e.target.value)}
                            >
                                <option value="">-- Selecciona una actividad --</option>
                                <option value="Crear cuenta FamilySearch">Crear cuenta FamilySearch</option>
                                <option value="Árbol Familiar / Recuerdos">Árbol Familiar / Recuerdos</option>
                                <option value="Indexación / Revisión">Indexación / Revisión</option>
                                <option value="Participa">Participa</option>
                                <option value="Otros">Otros</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ¿A cuántas personas ayudaste/acompañaste?
                            </label>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setPeopleCount(Math.max(0, peopleCount - 1))}
                                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600"
                                >
                                    -
                                </button>
                                <span className="text-2xl font-bold text-primary-600 w-12 text-center">{peopleCount}</span>
                                <button
                                    onClick={() => setPeopleCount(peopleCount + 1)}
                                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button
                            onClick={handleSnooze}
                            disabled={submitting}
                            className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
                        >
                            <PlusCircle size={20} />
                            +5 Minutos
                        </button>

                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                        >
                            <Save size={20} />
                            Finalizar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PCOverlay;
