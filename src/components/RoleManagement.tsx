import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Briefcase, Youtube, Info, AlertCircle, Shield, Eye, EyeOff } from 'lucide-react';
import { mockApi } from '../services/mockApiService';
import type { Role } from '../types';
import { toast } from 'react-hot-toast';

interface RoleManagementProps {
    eventId: string;
}

const RoleManagement: React.FC<RoleManagementProps> = ({ eventId }) => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        detailedTasks: '',
        youtubeUrl: '',
        experienceLevel: 'nueva' as 'nueva' | 'intermedia' | 'avanzada',
        requiresApproval: false,
        isVisible: true, // Default visible
    });

    useEffect(() => {
        fetchRoles();
    }, [eventId]);

    const fetchRoles = async () => {
        setIsLoading(true);
        try {
            const data = await mockApi.getRolesByEvent(eventId);
            setRoles(data);
        } catch (error) {
            console.error('Error al cargar roles:', error);
            toast.error('Error al cargar roles');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: checked }));
    };

    const openCreateModal = () => {
        setEditingRole(null);
        setFormData({
            name: '',
            description: '',
            detailedTasks: '',
            youtubeUrl: '',
            experienceLevel: 'nueva',
            requiresApproval: false,
            isVisible: true,
        });
        setShowModal(true);
    };

    const openEditModal = (role: Role) => {
        setEditingRole(role);
        setFormData({
            name: role.name,
            description: role.description,
            detailedTasks: role.detailedTasks,
            youtubeUrl: role.youtubeUrl || '',
            experienceLevel: role.experienceLevel,
            requiresApproval: role.requiresApproval || false,
            isVisible: role.isVisible !== undefined ? role.isVisible : true,
        });
        setShowModal(true);
    };

    const handleToggleVisibility = async (role: Role) => {
        try {
            const newVisibility = !role.isVisible; // Toggle
            // If undefined, assume true -> false
            const isVisible = role.isVisible === undefined ? false : !role.isVisible;

            await mockApi.updateRole(role.id, { isVisible });
            toast.success(`Rol ${isVisible ? 'visible' : 'oculto'} para voluntarios`);
            fetchRoles();
        } catch (error: any) {
            toast.error(error.message || 'Error al cambiar visibilidad');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.description || !formData.detailedTasks) {
            toast.error('Por favor completa los campos obligatorios');
            return;
        }

        try {
            if (editingRole) {
                await mockApi.updateRole(editingRole.id, formData);
                toast.success('Rol actualizado exitosamente');
            } else {
                await mockApi.createRole({
                    eventId,
                    ...formData
                });
                toast.success('Rol creado exitosamente');
            }
            setShowModal(false);
            fetchRoles();
        } catch (error: any) {
            toast.error(error.message || 'Error al guardar rol');
        }
    };

    const handleDelete = async (roleId: string) => {
        if (!confirm('¿Estás seguro de eliminar este rol? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            await mockApi.deleteRole(roleId);
            toast.success('Rol eliminado');
            fetchRoles();
        } catch (error: any) {
            toast.error(error.message || 'Error al eliminar rol');
        }
    };

    const getExperienceLabel = (level: string) => {
        switch (level) {
            case 'nueva': return 'Experiencia Nueva';
            case 'intermedia': return 'Experiencia Intermedia';
            case 'avanzada': return 'Experiencia Avanzada';
            default: return level;
        }
    };

    const getExperienceColor = (level: string) => {
        switch (level) {
            case 'nueva': return 'bg-green-100 text-green-800';
            case 'intermedia': return 'bg-blue-100 text-blue-800';
            case 'avanzada': return 'bg-purple-100 text-purple-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                <span className="ml-3 text-gray-600">Cargando roles...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Gestión de Roles</h3>
                    <p className="text-sm text-gray-600">
                        Define los roles y responsabilidades para los voluntarios en este evento.
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium shadow-md"
                >
                    <Plus size={18} />
                    Crear Nuevo Rol
                </button>
            </div>

            {/* Roles List */}
            {roles.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Briefcase size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-2">No hay roles definidos para este evento</p>
                    <p className="text-sm text-gray-400">Haz clic en "Crear Nuevo Rol" para comenzar</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {roles.map(role => (
                        <div key={role.id} className={`bg-white rounded-lg border p-6 hover:shadow-md transition-shadow relative overflow-hidden ${(role.isVisible ?? true) ? 'border-gray-200' : 'border-gray-300 bg-gray-50'
                            }`}>
                            {!(role.isVisible ?? true) && (
                                <div className="absolute top-0 right-0 bg-gray-200 text-gray-600 px-3 py-1 text-xs font-bold rounded-bl-lg z-10">
                                    OCULTO
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                                        {role.name}
                                        <span className={`text-xs px-2 py-1 rounded-full ${getExperienceColor(role.experienceLevel)}`}>
                                            {getExperienceLabel(role.experienceLevel)}
                                        </span>
                                        {role.requiresApproval && (
                                            <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full flex items-center gap-1 border border-orange-200">
                                                <Shield size={12} />
                                                Requiere Aprobación
                                            </span>
                                        )}
                                    </h4>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleToggleVisibility(role)}
                                        className={`p-2 rounded-lg transition-colors ${(role.isVisible ?? true)
                                                ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                                                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'
                                            }`}
                                        title={(role.isVisible ?? true) ? "Ocultar rol a voluntarios" : "Hacer visible a voluntarios"}
                                    >
                                        {(role.isVisible ?? true) ? <Eye size={18} /> : <EyeOff size={18} />}
                                    </button>
                                    <button
                                        onClick={() => openEditModal(role)}
                                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                        title="Editar rol"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(role.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar rol"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <p className="text-gray-600 mb-4">{role.description}</p>

                            <div className="bg-gray-50 p-4 rounded-lg mb-4">
                                <h5 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <Info size={16} />
                                    Tareas Detalladas
                                </h5>
                                <p className="text-sm text-gray-600 whitespace-pre-line">{role.detailedTasks}</p>
                            </div>

                            {role.youtubeUrl && (
                                <div className="flex items-center gap-2 text-sm text-red-600">
                                    <Youtube size={16} />
                                    <a href={role.youtubeUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                        Ver video de capacitación
                                    </a>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-serif font-bold text-gray-900 mb-6">
                            {editingRole ? 'Editar Rol' : 'Crear Nuevo Rol'}
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre del Rol *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Coordinador de Ingreso"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción Corta *</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Breve descripción de las responsabilidades..."
                                    rows={2}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Tareas Detalladas *</label>
                                <textarea
                                    name="detailedTasks"
                                    value={formData.detailedTasks}
                                    onChange={handleInputChange}
                                    placeholder="Lista detallada de tareas y procedimientos..."
                                    rows={5}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nivel de Experiencia *</label>
                                    <select
                                        name="experienceLevel"
                                        value={formData.experienceLevel}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="nueva">Nueva (Sin experiencia previa)</option>
                                        <option value="intermedia">Intermedia (Alguna experiencia)</option>
                                        <option value="avanzada">Avanzada (Requiere capacitación)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">URL Video Capacitación (Opcional)</label>
                                    <div className="relative">
                                        <Youtube className="absolute left-3 top-3.5 text-gray-400" size={20} />
                                        <input
                                            type="url"
                                            name="youtubeUrl"
                                            value={formData.youtubeUrl}
                                            onChange={handleInputChange}
                                            placeholder="https://youtube.com/..."
                                            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Flags Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-lg border border-orange-100">
                                    <div className="flex items-center h-5">
                                        <input
                                            type="checkbox"
                                            id="requiresApproval"
                                            name="requiresApproval"
                                            checked={formData.requiresApproval}
                                            onChange={handleCheckboxChange}
                                            className="h-5 w-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                        />
                                    </div>
                                    <label htmlFor="requiresApproval" className="flex flex-col cursor-pointer">
                                        <span className="font-semibold text-gray-900 flex items-center gap-2">
                                            <Shield size={16} className="text-orange-600" />
                                            Requiere Aprobación
                                        </span>
                                        <span className="text-xs text-gray-600 mt-1">
                                            Los inscritos necesitarán validación.
                                        </span>
                                    </label>
                                </div>

                                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                                    <div className="flex items-center h-5">
                                        <input
                                            type="checkbox"
                                            id="isVisible"
                                            name="isVisible"
                                            checked={formData.isVisible}
                                            onChange={handleCheckboxChange}
                                            className="h-5 w-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                        />
                                    </div>
                                    <label htmlFor="isVisible" className="flex flex-col cursor-pointer">
                                        <span className="font-semibold text-gray-900 flex items-center gap-2">
                                            {formData.isVisible ? <Eye size={16} className="text-blue-600" /> : <EyeOff size={16} className="text-gray-400" />}
                                            Visible para Voluntarios
                                        </span>
                                        <span className="text-xs text-gray-600 mt-1">
                                            Si se desmarca, este rol y sus turnos quedarán ocultos.
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold shadow-lg"
                                >
                                    {editingRole ? 'Guardar Cambios' : 'Crear Rol'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoleManagement;
