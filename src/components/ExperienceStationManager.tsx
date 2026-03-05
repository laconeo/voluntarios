import React, { useEffect, useState } from 'react';
import { experienceService, type ExperienceStation } from '../services/experienceService';
import { Plus, Trash2, Copy, Check, ExternalLink, Edit2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ExperienceStationManagerProps {
    eventId: string;
    eventSlug: string;
    eventName: string;
}

const ExperienceStationManager: React.FC<ExperienceStationManagerProps> = ({
    eventId,
    eventSlug,
    eventName,
}) => {
    const [stations, setStations] = useState<ExperienceStation[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [copiedGeneral, setCopiedGeneral] = useState(false);

    const baseUrl = window.location.href.split('#')[0].replace(/\/$/, '');

    const getStationUrl = (station: ExperienceStation) =>
        `${baseUrl}/#/${eventSlug}/registro/${station.id}`;

    const getGeneralUrl = () =>
        `${baseUrl}/#/${eventSlug}/registro`;

    useEffect(() => {
        load();
    }, [eventId]);

    const load = async () => {
        setLoading(true);
        try {
            const data = await experienceService.getStations(eventId);
            setStations(data);
        } catch {
            toast.error('Error al cargar puestos');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setAdding(true);
        try {
            const st = await experienceService.createStation(eventId, newName.trim());
            setStations(prev => [...prev, st]);
            setNewName('');
            toast.success(`✅ Puesto "${st.nombre}" creado`);
        } catch (e: any) {
            toast.error(e.message || 'Error al crear puesto');
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (st: ExperienceStation) => {
        if (!window.confirm(`¿Eliminar el puesto "${st.nombre}"? Se borrarán todos sus registros.`)) return;
        try {
            await experienceService.deleteStation(st.id);
            setStations(prev => prev.filter(s => s.id !== st.id));
            toast.success('Puesto eliminado');
        } catch {
            toast.error('Error al eliminar');
        }
    };

    const handleEdit = async (st: ExperienceStation) => {
        if (!editName.trim() || editName.trim() === st.nombre) {
            setEditingId(null);
            return;
        }
        try {
            const updated = await experienceService.updateStation(st.id, editName.trim());
            setStations(prev => prev.map(s => s.id === updated.id ? updated : s));
            setEditingId(null);
            toast.success('Nombre actualizado');
        } catch {
            toast.error('Error al actualizar');
        }
    };

    const copyUrl = (station: ExperienceStation) => {
        navigator.clipboard.writeText(getStationUrl(station));
        setCopiedId(station.id);
        setTimeout(() => setCopiedId(null), 2000);
        toast.success('URL copiada');
    };

    const copyGeneral = () => {
        navigator.clipboard.writeText(getGeneralUrl());
        setCopiedGeneral(true);
        setTimeout(() => setCopiedGeneral(false), 2000);
        toast.success('URL general copiada');
    };

    // Sugerencias rápidas de nombres
    const SUGGESTIONS = ['Apellidos 1', 'Apellidos 2', 'Apellidos 3', 'Rincón de tus Abuelos 1', 'Rincón de tus Abuelos 2'];
    const unusedSuggestions = SUGGESTIONS.filter(s =>
        !stations.some(st => st.nombre.toLowerCase() === s.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header + URL general */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="font-semibold text-indigo-800 flex items-center gap-2">
                            🔗 URL General del Evento
                        </h3>
                        <p className="text-xs text-indigo-600 mt-0.5">
                            Compartí esta URL y el voluntario elige su puesto al abrirla.
                        </p>
                        <code className="text-xs text-indigo-700 mt-1 block font-mono break-all">
                            {getGeneralUrl()}
                        </code>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={copyGeneral}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                        >
                            {copiedGeneral ? <Check size={14} /> : <Copy size={14} />}
                            {copiedGeneral ? 'Copiada' : 'Copiar'}
                        </button>
                        <a
                            href={getGeneralUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-100 text-sm transition-colors"
                        >
                            <ExternalLink size={14} />
                            Ver
                        </a>
                    </div>
                </div>
            </div>

            {/* Lista de puestos */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800">
                        Puestos de {eventName}
                        <span className="ml-2 text-sm font-normal text-gray-500">({stations.length} puestos)</span>
                    </h3>
                </div>

                {loading ? (
                    <div className="text-center py-8 text-gray-400">Cargando puestos...</div>
                ) : stations.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                        <p className="font-medium">Todavía no hay puestos.</p>
                        <p className="text-sm mt-1">Agregá el primero abajo.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {stations.map(st => (
                            <div
                                key={st.id}
                                className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow"
                            >
                                {/* Nombre / edición */}
                                <div className="flex-1 min-w-0">
                                    {editingId === st.id ? (
                                        <div className="flex gap-2">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') handleEdit(st); if (e.key === 'Escape') setEditingId(null); }}
                                                className="flex-1 border border-indigo-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <button onClick={() => handleEdit(st)} className="text-indigo-600 hover:text-indigo-800">
                                                <Check size={16} />
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="font-medium text-gray-800 text-sm">{st.nombre}</span>
                                    )}
                                    <code className="text-xs text-gray-400 font-mono block mt-0.5 truncate">
                                        .../{eventSlug}/registro/{st.id.slice(0, 8)}...
                                    </code>
                                </div>

                                {/* Acciones */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => { setEditingId(st.id); setEditName(st.nombre); }}
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="Editar nombre"
                                    >
                                        <Edit2 size={15} />
                                    </button>
                                    <button
                                        onClick={() => copyUrl(st)}
                                        className={`p-2 rounded-lg transition-colors ${copiedId === st.id ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                        title="Copiar URL del puesto"
                                    >
                                        {copiedId === st.id ? <Check size={15} /> : <Copy size={15} />}
                                    </button>
                                    <a
                                        href={getStationUrl(st)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="Abrir página del puesto"
                                    >
                                        <ExternalLink size={15} />
                                    </a>
                                    <button
                                        onClick={() => handleDelete(st)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar puesto"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Agregar nuevo puesto */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Agregar puesto</h4>

                {/* Sugerencias rápidas */}
                {unusedSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {unusedSuggestions.map(s => (
                            <button
                                key={s}
                                onClick={() => setNewName(s)}
                                className="text-xs bg-white border border-gray-300 hover:border-indigo-400 hover:text-indigo-700 text-gray-600 px-3 py-1 rounded-full transition-colors"
                            >
                                + {s}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        placeholder="Nombre del puesto (ej: Apellidos 1)"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={adding}
                    />
                    <button
                        onClick={handleAdd}
                        disabled={adding || !newName.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <Plus size={16} />
                        {adding ? 'Creando...' : 'Crear'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExperienceStationManager;
