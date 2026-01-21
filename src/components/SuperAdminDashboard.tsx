import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Calendar, MapPin, Search, Archive, TrendingUp, Copy, Users, MoreHorizontal, ChevronRight, X } from 'lucide-react';
import { mockApi } from '../services/mockApiService';
import type { Event, User } from '../types';
import { toast } from 'react-hot-toast';
import ShiftManagement from './ShiftManagement';
import RoleManagement from './RoleManagement';

interface SuperAdminDashboardProps {
    user: User;
    onLogout: () => void;
    onViewMetrics?: (eventIdOrView: string) => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ user, onViewMetrics }) => {
    const [vistaActual, setVistaActual] = useState<'listado' | 'crear' | 'editar'>('listado');
    const [activeTab, setActiveTab] = useState<'details' | 'roles' | 'shifts'>('details');
    const [eventoSeleccionado, setEventoSeleccionado] = useState<Event | null>(null);
    const [mostrarModal, setMostrarModal] = useState(false);
    const [accionModal, setAccionModal] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [filtroPais, setFiltroPais] = useState('todos');
    const [filtroFecha, setFiltroFecha] = useState('todos');
    const [eventos, setEventos] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [formData, setFormData] = useState({
        nombre: '',
        slug: '',
        ubicacion: '',
        pais: '',
        fechaInicio: '',
        fechaFin: '',
        descripcion: '',
        estado: 'Inactivo' as 'Activo' | 'Inactivo' | 'Archivado',
    });

    const nombreEventoInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (vistaActual === 'crear') {
            setTimeout(() => {
                if (nombreEventoInputRef.current) {
                    nombreEventoInputRef.current.focus();
                }
            }, 100);
        }
    }, [vistaActual]);

    useEffect(() => {
        fetchEventos();
    }, []);

    const fetchEventos = async () => {
        setIsLoading(true);
        try {
            const data = await mockApi.getAllEvents();
            setEventos(data);
        } catch (error) {
            toast.error('Error al cargar eventos');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const generateSlug = () => {
        const slug = formData.nombre
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '')
            .trim();
        setFormData(prev => ({ ...prev, slug }));
        toast.success('URL generada automáticamente');
    };

    const copyEventUrl = () => {
        const baseUrl = window.location.href.split('#')[0].replace(/\/$/, '');
        const url = `${baseUrl}/#/${formData.slug}`;
        navigator.clipboard.writeText(url);
        toast.success('URL copiada al portapapeles');
    };

    const iniciarCrearEvento = () => {
        setFormData({ nombre: '', slug: '', ubicacion: '', pais: '', fechaInicio: '', fechaFin: '', descripcion: '', estado: 'Inactivo' });
        setVistaActual('crear');
    };

    const iniciarEditarEvento = (evento: Event) => {
        setEventoSeleccionado(evento);
        setFormData({
            nombre: evento.nombre,
            slug: evento.slug,
            ubicacion: evento.ubicacion,
            pais: evento.pais,
            fechaInicio: evento.fechaInicio,
            fechaFin: evento.fechaFin,
            descripcion: evento.descripcion,
            estado: evento.estado,
        });
        setVistaActual('editar');
    };

    const confirmarAccion = (accion: string, evento: Event | null = null, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setAccionModal(accion);
        setEventoSeleccionado(evento);
        setMostrarModal(true);
    };

    const ejecutarAccion = async () => {
        if (!eventoSeleccionado) return;
        try {
            if (accionModal === 'archivar') {
                await mockApi.archiveEvent(eventoSeleccionado.id);
                toast.success('Evento archivado');
            } else if (accionModal === 'eliminar') {
                await mockApi.deleteEvent(eventoSeleccionado.id);
                toast.success('Evento eliminado');
            }
            fetchEventos();
        } catch (error: any) {
            toast.error(error.message || 'Error al ejecutar acción');
        } finally {
            setMostrarModal(false);
            setEventoSeleccionado(null);
        }
    };

    const guardarEvento = async () => {
        try {
            if (vistaActual === 'crear') {
                await mockApi.createEvent(formData);
                toast.success('Evento creado exitosamente');
            } else if (eventoSeleccionado) {
                await mockApi.updateEvent(eventoSeleccionado.id, formData);
                toast.success('Evento actualizado');
            }
            fetchEventos();
            setVistaActual('listado');
        } catch (error: any) {
            toast.error(error.message || 'Error al guardar evento');
        }
    };

    const getBadgeColor = (estado: string) => {
        if (estado === 'Activo') return 'bg-[#e8f5e9] text-[#2e7d32] border border-[#c8e6c9]'; // Green 50/800
        if (estado === 'Inactivo') return 'bg-gray-100 text-gray-700 border border-gray-200';
        return 'bg-blue-50 text-blue-700 border border-blue-200';
    };

    const eventosFiltrados = eventos.filter(e => {
        const matchEstado = filtroEstado === 'todos' || e.estado === filtroEstado;
        const matchPais = filtroPais === 'todos' || e.pais === filtroPais;
        const matchFecha =
            filtroFecha === 'todos' ||
            (filtroFecha === '2026' && e.fechaInicio.includes('2026')) ||
            (filtroFecha === '2025' && e.fechaInicio.includes('2025'));
        return matchEstado && matchPais && matchFecha;
    });

    const paises = ['todos', ...new Set(eventos.map(e => e.pais))];

    // Sub-components for cleaner render
    const StatCard = ({ title, count, icon: Icon, bgClass, iconClass }: { title: string, count: number, icon: any, bgClass: string, iconClass: string }) => (
        <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                <p className="text-3xl font-light text-gray-900">{count}</p>
            </div>
            <div className={`p-3 rounded-full ${bgClass}`}>
                <Icon size={24} className={iconClass} />
            </div>
        </div>
    );

    if (vistaActual === 'listado') {
        return (
            <div className="min-h-screen pb-20 sm:pb-10 font-sans text-gray-900 bg-[#F7F7F7]">

                {/* Modern clean header */}
                <div className="bg-white border-b border-gray-200 shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-sans font-normal text-gray-900 tracking-tight">Gestión de Eventos</h1>
                                <p className="text-gray-500 mt-1 font-light">Administra y organiza las actividades de voluntariado.</p>
                            </div>
                            <div className="hidden sm:flex items-center gap-3">
                                {onViewMetrics && (
                                    <button
                                        onClick={() => onViewMetrics('users')}
                                        className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                                    >
                                        <Users className="mr-2 h-4 w-4" />
                                        Usuarios
                                    </button>
                                )}
                                <button
                                    onClick={iniciarCrearEvento}
                                    className="inline-flex items-center justify-center px-5 py-2 border border-transparent text-sm font-medium rounded-full text-white bg-[#8CB83E] hover:bg-[#7cb342] shadow-sm transition-colors"
                                >
                                    <Plus className="mr-2 h-5 w-5" />
                                    Nuevo evento
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard
                            title="Eventos Activos"
                            count={eventos.filter(e => e.estado === 'Activo').length}
                            icon={Calendar}
                            bgClass="bg-[#def4c6]" // Softer green background
                            iconClass="text-[#3d8315]" // Darker green icon
                        />
                        <StatCard
                            title="Eventos Inactivos"
                            count={eventos.filter(e => e.estado === 'Inactivo').length}
                            icon={Calendar}
                            bgClass="bg-gray-100"
                            iconClass="text-gray-500"
                        />
                        <StatCard
                            title="Archivados"
                            count={eventos.filter(e => e.estado === 'Archivado').length}
                            icon={Archive}
                            bgClass="bg-blue-50"
                            iconClass="text-[#005994]"
                        />
                    </div>

                    {/* Filters & Search */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center text-gray-400 mr-2">
                            <Search size={20} />
                        </div>
                        <div className="flex-1 w-full sm:w-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <select
                                value={filtroEstado}
                                onChange={e => setFiltroEstado(e.target.value)}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                            >
                                <option value="todos">Todos los estados</option>
                                <option value="Activo">Activos</option>
                                <option value="Inactivo">Inactivos</option>
                                <option value="Archivado">Archivados</option>
                            </select>
                            <select
                                value={filtroPais}
                                onChange={e => setFiltroPais(e.target.value)}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                            >
                                {paises.map(p => (
                                    <option key={p} value={p}>
                                        {p === 'todos' ? 'Todos los países' : p}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={filtroFecha}
                                onChange={e => setFiltroFecha(e.target.value)}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                            >
                                <option value="todos">Todos los años</option>
                                <option value="2026">2026</option>
                                <option value="2025">2025</option>
                            </select>
                        </div>
                    </div>

                    {/* Events Grid */}
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {eventosFiltrados.map(evento => (
                                <div
                                    key={evento.id}
                                    onClick={() => iniciarEditarEvento(evento)}
                                    className="group bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col"
                                >
                                    <div className="p-6 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getBadgeColor(evento.estado)}`}>
                                                {evento.estado}
                                            </span>
                                            {onViewMetrics && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onViewMetrics(evento.id);
                                                    }}
                                                    className="text-gray-400 hover:text-[#8CB83E] transition-colors p-1"
                                                    title="Ver métricas"
                                                >
                                                    <TrendingUp size={18} />
                                                </button>
                                            )}
                                        </div>

                                        <h3 className="text-xl font-sans font-medium text-gray-900 mb-2 group-hover:text-[#8CB83E] transition-colors">
                                            {evento.nombre}
                                        </h3>

                                        <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
                                            <MapPin size={14} />
                                            <span>{evento.ubicacion}, {evento.pais}</span>
                                        </div>

                                        <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed mb-4">
                                            {evento.descripcion || "Sin descripción disponible."}
                                        </p>

                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase tracking-wider">Fecha</p>
                                                <p className="text-sm font-medium text-gray-700">{new Date(evento.fechaInicio).toLocaleDateString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase tracking-wider">Voluntarios</p>
                                                <p className="text-sm font-medium text-gray-700">{evento.voluntarios}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                                        <div className="flex gap-1">
                                            {evento.estado !== 'Archivado' && (
                                                <button
                                                    onClick={(e) => confirmarAccion('archivar', evento, e)}
                                                    className="p-2 text-gray-500 hover:text-[#005994] hover:bg-white rounded-md transition-colors"
                                                    title="Archivar"
                                                >
                                                    <Archive size={18} />
                                                </button>
                                            )}
                                            {evento.voluntarios === 0 && (
                                                <button
                                                    onClick={(e) => confirmarAccion('eliminar', evento, e)}
                                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-white rounded-md transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {onViewMetrics && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onViewMetrics(evento.id);
                                                    }}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:text-[#005994] hover:border-[#005994] transition-colors"
                                                >
                                                    <TrendingUp size={16} />
                                                    <span className="hidden sm:inline">Métricas</span>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => iniciarEditarEvento(evento)}
                                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-[#8CB83E] rounded-md hover:bg-[#7cb342] shadow-sm transition-colors"
                                            >
                                                <Edit2 size={16} />
                                                <span>Editar</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {eventosFiltrados.length === 0 && !isLoading && (
                        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
                            <Search size={48} className="mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">No se encontraron eventos</h3>
                            <p className="text-gray-500">Intenta ajustar los filtros de búsqueda.</p>
                        </div>
                    )}
                </div>

                {/* Confirmation Modal */}
                {mostrarModal && eventoSeleccionado && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                        <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-slide-up">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 mx-auto">
                                <Archive className="text-red-600" size={24} />
                            </div>
                            <h3 className="text-lg font-sans font-bold text-center text-gray-900 mb-2">
                                {accionModal === 'archivar' ? '¿Archivar evento?' : '¿Eliminar evento?'}
                            </h3>
                            <p className="text-gray-600 text-center text-sm mb-6">
                                {accionModal === 'archivar'
                                    ? `"${eventoSeleccionado.nombre}" pasará a modo solo lectura.`
                                    : `"${eventoSeleccionado.nombre}" se eliminará permanentemente.`}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setMostrarModal(false)}
                                    className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={ejecutarAccion}
                                    className={`flex-1 px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors shadow-sm ${accionModal === 'archivar' ? 'bg-[#8CB83E] hover:bg-[#7cb342]' : 'bg-red-600 hover:bg-red-700'
                                        }`}
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Mobile Bottom Floating Action Buttons - List View */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 sm:hidden z-50 flex shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] pb-safe">
                    {onViewMetrics && (
                        <button
                            onClick={() => onViewMetrics('users')}
                            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-gray-600 active:bg-gray-50 rounded-lg transition-colors"
                        >
                            <Users size={24} />
                            <span className="text-[10px] font-medium">Usuarios</span>
                        </button>
                    )}
                    <button
                        onClick={iniciarCrearEvento}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors ${!onViewMetrics ? 'w-full' : ''} text-[#8CB83E] active:bg-green-50`}
                    >
                        <Plus size={24} />
                        <span className="text-[10px] font-medium">Nuevo Evento</span>
                    </button>
                </div>
            </div>
        );
    }

    // Crear / Editar view (Simplified for clean look)
    return (
        <div className="min-h-screen pb-20 sm:pb-10 font-sans text-gray-900 bg-[#F7F7F7]">
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setVistaActual('listado')}
                                className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <X size={24} />
                            </button>
                            <div>
                                <h1 className="text-xl font-sans font-medium text-gray-900">
                                    {vistaActual === 'crear' ? 'Nuevo Evento' : eventoSeleccionado?.nombre}
                                </h1>
                                <p className="text-sm text-gray-500">
                                    {vistaActual === 'crear' ? 'Crear un nuevo evento de voluntariado' : 'Gestión y edición'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                {eventoSeleccionado && (
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-2">
                        <div className="flex space-x-6">
                            <button
                                onClick={() => setActiveTab('details')}
                                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-[#8CB83E] text-[#8CB83E]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                Detalles
                            </button>
                            <button
                                onClick={() => setActiveTab('roles')}
                                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'roles' ? 'border-[#8CB83E] text-[#8CB83E]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                Roles
                            </button>
                            <button
                                onClick={() => setActiveTab('shifts')}
                                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'shifts' ? 'border-[#8CB83E] text-[#8CB83E]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                Turnos
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {activeTab === 'roles' && eventoSeleccionado ? (
                        <div className="p-6">
                            <RoleManagement eventId={eventoSeleccionado.id} />
                        </div>
                    ) : activeTab === 'shifts' && eventoSeleccionado ? (
                        <div className="p-6">
                            <ShiftManagement
                                eventId={eventoSeleccionado.id}
                                eventStartDate={eventoSeleccionado.fechaInicio}
                                eventEndDate={eventoSeleccionado.fechaFin}
                            />
                        </div>
                    ) : (
                        <div className="p-6 sm:p-8 space-y-6">
                            {/* Form Content */}
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del evento</label>
                                    <input
                                        ref={nombreEventoInputRef}
                                        type="text"
                                        name="nombre"
                                        value={formData.nombre}
                                        onChange={handleInputChange}
                                        placeholder="Ej: Feria del Libro Buenos Aires 2026"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-[#8CB83E] focus:border-[#8CB83E] transition-shadow"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">URL amigable (Slug)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            name="slug"
                                            value={formData.slug}
                                            onChange={handleInputChange}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 text-sm font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={generateSlug}
                                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
                                        >
                                            Generar
                                        </button>
                                    </div>
                                    {formData.slug && (
                                        <div className="mt-2 flex items-center justify-between text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded border border-blue-100">
                                            <span className="truncate font-mono">
                                                {`${window.location.href.split('#')[0].replace(/\/$/, '')}/#/${formData.slug}`}
                                            </span>
                                            <button onClick={copyEventUrl} className="ml-2 hover:underline font-medium">Copiar</button>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                                        <input
                                            type="text"
                                            name="ubicacion"
                                            value={formData.ubicacion}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-[#8CB83E] focus:border-[#8CB83E]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                                        <input
                                            type="text"
                                            name="pais"
                                            value={formData.pais}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-[#8CB83E] focus:border-[#8CB83E]"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
                                        <input
                                            type="date"
                                            name="fechaInicio"
                                            value={formData.fechaInicio}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-[#8CB83E] focus:border-[#8CB83E]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
                                        <input
                                            type="date"
                                            name="fechaFin"
                                            value={formData.fechaFin}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-[#8CB83E] focus:border-[#8CB83E]"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                                    <textarea
                                        name="descripcion"
                                        value={formData.descripcion}
                                        onChange={handleInputChange}
                                        rows={4}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-[#8CB83E] focus:border-[#8CB83E]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                                    <select
                                        name="estado"
                                        value={formData.estado}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-[#8CB83E] focus:border-[#8CB83E]"
                                    >
                                        <option value="Activo">Activo</option>
                                        <option value="Inactivo">Inactivo</option>
                                        <option value="Archivado">Archivado</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setVistaActual('listado')}
                                    className="px-5 py-2 text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 font-medium text-sm transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={guardarEvento}
                                    className="px-6 py-2 text-white bg-[#8CB83E] rounded-full hover:bg-[#7cb342] font-medium text-sm shadow-sm transition-colors"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Detail Actions (Delete/Archive) */}
                {eventoSeleccionado && activeTab === 'details' && vistaActual === 'editar' && (
                    <div className="mt-8 border-t border-gray-200 pt-8">
                        <h3 className="text-sm font-bold text-gray-900 mb-4">Zona de Peligro</h3>
                        <div className="flex flex-col sm:flex-row gap-4">
                            {eventoSeleccionado.estado !== 'Archivado' && (
                                <button
                                    onClick={() => confirmarAccion('archivar', eventoSeleccionado)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                                >
                                    <Archive size={16} />
                                    Archivar Evento
                                </button>
                            )}
                            {eventoSeleccionado.voluntarios === 0 && (
                                <button
                                    onClick={() => confirmarAccion('eliminar', eventoSeleccionado)}
                                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={16} />
                                    Eliminar Evento
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Nav */}
            {eventoSeleccionado && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 sm:hidden z-40 flex justify-around">
                    <button onClick={() => setActiveTab('details')} className={`p-2 flex flex-col items-center ${activeTab === 'details' ? 'text-[#8CB83E]' : 'text-gray-400'}`}>
                        <Calendar size={20} />
                        <span className="text-[10px] mt-1">Detalles</span>
                    </button>
                    <button onClick={() => setActiveTab('roles')} className={`p-2 flex flex-col items-center ${activeTab === 'roles' ? 'text-[#8CB83E]' : 'text-gray-400'}`}>
                        <Users size={20} />
                        <span className="text-[10px] mt-1">Roles</span>
                    </button>
                    <button onClick={() => setActiveTab('shifts')} className={`p-2 flex flex-col items-center ${activeTab === 'shifts' ? 'text-[#8CB83E]' : 'text-gray-400'}`}>
                        <TrendingUp size={20} />
                        <span className="text-[10px] mt-1">Turnos</span>
                    </button>
                </div>
            )}

        </div>
    );
};

export default SuperAdminDashboard;
