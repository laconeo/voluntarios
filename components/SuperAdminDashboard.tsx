import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Plus, Edit2, Archive, Trash2, CheckCircle, XCircle, Filter, Search, TrendingUp, Users, Copy } from 'lucide-react';
import { mockApi } from '../services/mockApiService';
import type { Event, User } from '../types';
import { toast } from 'react-hot-toast';

interface SuperAdminDashboardProps {
    user: User;
    onLogout: () => void;
    onViewMetrics?: (eventIdOrView: string) => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ user, onViewMetrics }) => {
    const [vistaActual, setVistaActual] = useState<'listado' | 'crear' | 'editar'>('listado');
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
        const url = `${window.location.origin}/${formData.slug}`;
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

    const confirmarAccion = (accion: string, evento: Event | null = null) => {
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
        if (estado === 'Activo') return 'bg-primary-100 text-primary-700 border border-primary-200';
        if (estado === 'Inactivo') return 'bg-gray-100 text-gray-700 border border-gray-300';
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

    if (vistaActual === 'listado') {
        return (
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-primary-500 text-white px-6 py-8">
                    <div className="max-w-7xl mx-auto flex justify-between items-start">
                        <div>
                            <h1 className="text-4xl font-serif mb-3">Gestión de eventos</h1>
                            <p className="text-lg opacity-90">Administra eventos de voluntariado multi-organización</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    console.log('Gestionar Usuarios clicked', onViewMetrics);
                                    if (onViewMetrics) {
                                        onViewMetrics('users');
                                    } else {
                                        console.error('onViewMetrics is not defined');
                                    }
                                }}
                                className="flex items-center gap-2 bg-white text-primary-600 px-6 py-3 rounded-lg hover:bg-gray-50 shadow-lg font-semibold"
                            >
                                <Users size={20} />
                                Gestionar Usuarios
                            </button>
                            <button
                                onClick={iniciarCrearEvento}
                                className="flex items-center gap-2 bg-white text-primary-600 px-6 py-3 rounded-lg hover:bg-gray-50 shadow-lg font-semibold"
                            >
                                <Plus size={20} />
                                Crear nuevo evento
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="max-w-7xl mx-auto px-6 -mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white rounded-lg shadow-md border-l-4 border-primary-500 p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary-100 rounded-lg">
                                    <CheckCircle className="text-primary-600" size={28} />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Eventos activos</p>
                                    <p className="text-3xl font-bold text-gray-900">
                                        {eventos.filter(e => e.estado === 'Activo').length}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-md border-l-4 border-gray-400 p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-gray-100 rounded-lg">
                                    <XCircle className="text-gray-600" size={28} />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Eventos inactivos</p>
                                    <p className="text-3xl font-bold text-gray-900">
                                        {eventos.filter(e => e.estado === 'Inactivo').length}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-md border-l-4 border-blue-500 p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-100 rounded-lg">
                                    <Archive className="text-blue-600" size={28} />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Eventos archivados</p>
                                    <p className="text-3xl font-bold text-gray-900">
                                        {eventos.filter(e => e.estado === 'Archivado').length}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="max-w-7xl mx-auto px-6 mb-8">
                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Filter size={20} className="text-gray-600" />
                            <h3 className="font-semibold text-gray-900">Filtros</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Estado del evento</label>
                                <select
                                    value={filtroEstado}
                                    onChange={e => setFiltroEstado(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                                >
                                    <option value="todos">Todos los estados</option>
                                    <option value="Activo">Activos</option>
                                    <option value="Inactivo">Inactivos</option>
                                    <option value="Archivado">Archivados</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">País</label>
                                <select
                                    value={filtroPais}
                                    onChange={e => setFiltroPais(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                                >
                                    {paises.map(p => (
                                        <option key={p} value={p}>
                                            {p === 'todos' ? 'Todos los países' : p}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Año</label>
                                <select
                                    value={filtroFecha}
                                    onChange={e => setFiltroFecha(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                                >
                                    <option value="todos">Todos los años</option>
                                    <option value="2026">2026</option>
                                    <option value="2025">2025</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <p className="text-sm text-gray-600">
                                Mostrando <span className="font-semibold text-gray-900">{eventosFiltrados.length}</span> de {eventos.length} eventos
                            </p>
                        </div>
                    </div>
                </div>

                {/* Event List */}
                <div className="max-w-7xl mx-auto px-6 pb-12">
                    {isLoading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {eventosFiltrados.map(evento => (
                                <div key={evento.id} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
                                    <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-6 text-white relative">
                                        <div className="absolute top-4 right-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getBadgeColor(evento.estado)} bg-white`}>{evento.estado}</span>
                                        </div>
                                        <div className="mb-2">
                                            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mb-3">
                                                <Calendar className="text-white" size={24} />
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-serif mb-2">{evento.nombre}</h3>
                                        <div className="flex items-center gap-2 text-sm opacity-90">
                                            <MapPin size={14} />
                                            <span>{evento.ubicacion}</span>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <div className="space-y-3 mb-5">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Calendar size={16} className="text-gray-400" />
                                                <span>{evento.fechaInicio} al {evento.fechaFin}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{evento.descripcion}</p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 py-4 mb-5 border-y border-gray-200">
                                            <div className="text-center">
                                                <p className="text-2xl font-bold text-gray-900">{evento.voluntarios}</p>
                                                <p className="text-xs text-gray-500 mt-1">Voluntarios</p>
                                            </div>
                                            <div className="text-center border-x border-gray-200">
                                                <p className="text-2xl font-bold text-gray-900">{evento.turnos}</p>
                                                <p className="text-xs text-gray-500 mt-1">Turnos</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-2xl font-bold text-primary-600">{evento.ocupacion}%</p>
                                                <p className="text-xs text-gray-500 mt-1">Ocupación</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => iniciarEditarEvento(evento)}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 font-medium"
                                            >
                                                <Edit2 size={16} />
                                                Editar
                                            </button>
                                            {onViewMetrics && (
                                                <button
                                                    onClick={() => onViewMetrics(evento.id)}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium"
                                                >
                                                    <TrendingUp size={16} />
                                                    Métricas
                                                </button>
                                            )}
                                            {evento.estado !== 'Archivado' && (
                                                <button
                                                    onClick={() => confirmarAccion('archivar', evento)}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
                                                >
                                                    <Archive size={16} />
                                                    Archivar
                                                </button>
                                            )}
                                            {evento.voluntarios === 0 && (
                                                <button
                                                    onClick={() => confirmarAccion('eliminar', evento)}
                                                    className="px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {eventosFiltrados.length === 0 && !isLoading && (
                        <div className="text-center py-12">
                            <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
                                <Search size={32} className="text-gray-400" />
                            </div>
                            <p className="text-gray-600 text-lg">No se encontraron eventos con los filtros seleccionados</p>
                        </div>
                    )}
                </div>

                {/* Confirmation Modal */}
                {mostrarModal && eventoSeleccionado && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                            <h3 className="text-xl font-serif font-bold text-gray-900 mb-4">
                                Confirmar {accionModal === 'archivar' ? 'archivado' : 'eliminación'}
                            </h3>
                            <p className="text-gray-600 mb-6 leading-relaxed">
                                {accionModal === 'archivar'
                                    ? `¿Estás seguro que deseas archivar "${eventoSeleccionado.nombre}"? Los datos se conservarán en modo solo lectura.`
                                    : `¿Estás seguro que deseas eliminar "${eventoSeleccionado.nombre}"? Esta acción no se puede deshacer.`}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setMostrarModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={ejecutarAccion}
                                    className={`flex-1 px-4 py-2.5 rounded-lg text-white font-medium ${accionModal === 'archivar' ? 'bg-primary-600 hover:bg-primary-700' : 'bg-red-600 hover:bg-red-700'}`}
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Crear / Editar view
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white border-b border-gray-200 px-6 py-6">
                <div className="max-w-3xl mx-auto">
                    <button
                        onClick={() => setVistaActual('listado')}
                        className="text-primary-600 hover:text-primary-700 mb-4 flex items-center gap-2 font-medium"
                    >
                        ← Volver al listado
                    </button>
                    <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">
                        {vistaActual === 'crear' ? 'Crear nuevo evento' : 'Editar evento'}
                    </h1>
                    <p className="text-gray-600">
                        {vistaActual === 'crear'
                            ? 'Completa la información del nuevo evento de voluntariado'
                            : 'Modifica los datos del evento existente'}
                    </p>
                </div>
            </div>
            <div className="max-w-3xl mx-auto px-6 py-8">
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre del evento *</label>
                            <input
                                type="text"
                                name="nombre"
                                value={formData.nombre}
                                onChange={handleInputChange}
                                placeholder="Ej: Feria del Libro Buenos Aires 2026"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">URL del evento *</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    name="slug"
                                    value={formData.slug}
                                    onChange={handleInputChange}
                                    placeholder="feriadellibrobuenosaires"
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={generateSlug}
                                    className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium whitespace-nowrap"
                                >
                                    Auto-generar
                                </button>
                            </div>
                            {formData.slug && (
                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1">
                                            <p className="text-xs text-blue-600 font-semibold mb-1">URL de acceso público:</p>
                                            <p className="text-sm text-blue-900 font-mono break-all">
                                                {window.location.origin}/{formData.slug}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={copyEventUrl}
                                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm whitespace-nowrap flex items-center gap-2"
                                        >
                                            <Copy size={16} />
                                            Copiar
                                        </button>
                                    </div>
                                </div>
                            )}
                            <p className="text-sm text-gray-500 mt-2">
                                Esta URL será utilizada para que los voluntarios accedan al evento. Solo letras minúsculas sin espacios.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Ciudad *</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3.5 text-gray-400" size={20} />
                                    <input
                                        type="text"
                                        name="ubicacion"
                                        value={formData.ubicacion}
                                        onChange={handleInputChange}
                                        placeholder="Buenos Aires"
                                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">País *</label>
                                <input
                                    type="text"
                                    name="pais"
                                    value={formData.pais}
                                    onChange={handleInputChange}
                                    placeholder="Argentina"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha de inicio *</label>
                                <input
                                    type="date"
                                    name="fechaInicio"
                                    value={formData.fechaInicio}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha de fin *</label>
                                <input
                                    type="date"
                                    name="fechaFin"
                                    value={formData.fechaFin}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción</label>
                            <textarea
                                name="descripcion"
                                value={formData.descripcion}
                                onChange={handleInputChange}
                                placeholder="Describe brevemente el evento..."
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Estado del evento *</label>
                            <select
                                name="estado"
                                value={formData.estado}
                                onChange={handleInputChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="Activo">Activo (visible para voluntarios)</option>
                                <option value="Inactivo">Inactivo (oculto, en preparación)</option>
                                <option value="Archivado">Archivado (solo lectura)</option>
                            </select>
                            <p className="text-sm text-gray-500 mt-2">
                                Solo eventos activos son visibles para voluntarios en el registro
                            </p>
                        </div>

                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                            <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                                <span>⚠️</span> Reglas importantes
                            </h4>
                            <ul className="text-sm text-yellow-700 space-y-1 ml-6 list-disc">
                                <li>Solo puedes tener máximo 5 eventos activos simultáneos</li>
                                <li>La fecha de fin debe ser posterior a la fecha de inicio</li>
                                <li>No se pueden eliminar eventos con voluntarios registrados</li>
                            </ul>
                        </div>
                    </div>
                    <div className="flex gap-4 pt-6">
                        <button
                            type="button"
                            onClick={() => setVistaActual('listado')}
                            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={guardarEvento}
                            className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold shadow-lg"
                        >
                            {vistaActual === 'crear' ? 'Crear evento' : 'Guardar cambios'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
