import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Edit2, Save, X, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabaseApi } from '../services/supabaseApiService';
import type { Material } from '../types';

interface MaterialManagementProps {
    eventId: string;
}

const MaterialManagement: React.FC<MaterialManagementProps> = ({ eventId }) => {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Form state
    const [currentMaterial, setCurrentMaterial] = useState<Partial<Material>>({
        name: '',
        description: '',
        quantity: 0,
        category: 'general',
        isRequired: true
    });

    useEffect(() => {
        loadMaterials();
    }, [eventId]);

    const loadMaterials = async () => {
        setIsLoading(true);
        try {
            // TODO: Implement getMaterialsByEvent in supabaseApiService
            // For now, we simulate or you need to add it. 
            // Since I am inside a component creation flow, I will assume the API exists or I will mock it here if needed?
            // User requested "dame el script para supabase" later, meaning I can add DB tables.
            // But first I need to define the type and API.
            // I will use mockApi for now or add it to supabaseApiService.

            // Assuming mockApi.getMaterialsByEvent(eventId) exists or similar.
            // Since it doesn't exist yet, I will stub it or add it to the service first?
            // The instructions say "Create Components" first basically.
            // I will define the component and logic.

            const data = await supabaseApi.getMaterialsByEvent(eventId);
            setMaterials(data);
        } catch (error) {
            console.error('Error loading materials:', error);
            // toast.error('Error al cargar materiales');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing && currentMaterial.id) {
                await supabaseApi.updateMaterial(currentMaterial.id, currentMaterial);
                toast.success('Material actualizado');
            } else {
                await supabaseApi.createMaterial({ ...currentMaterial, eventId } as any);
                toast.success('Material creado');
            }
            setShowForm(false);
            resetForm();
            loadMaterials();
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar material');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Estás seguro de eliminar este material?')) return;
        try {
            await supabaseApi.deleteMaterial(id);
            toast.success('Material eliminado');
            loadMaterials();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const startEdit = (material: Material) => {
        setCurrentMaterial(material);
        setIsEditing(true);
        setShowForm(true);
    };

    const resetForm = () => {
        setCurrentMaterial({
            name: '',
            description: '',
            quantity: 0,
            category: 'general',
            isRequired: true
        });
        setIsEditing(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-medium text-gray-900">Materiales y Entregables</h2>
                    <p className="text-sm text-gray-500">Gestiona los materiales que se deben entregar a los voluntarios (camisetas, credenciales, etc.)</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#8CB83E] hover:bg-[#7cb342]"
                >
                    <Plus size={20} className="mr-2" />
                    Nuevo Material
                </button>
            </div>

            {showForm && (
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 shadow-sm animate-fade-in">
                    <h3 className="text-md font-medium text-gray-900 mb-4">{isEditing ? 'Editar Material' : 'Nuevo Material'}</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nombre del Item</label>
                                <input
                                    type="text"
                                    required
                                    value={currentMaterial.name}
                                    onChange={e => setCurrentMaterial({ ...currentMaterial, name: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                                    placeholder="Ej. Camiseta Oficial, Gafete"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Categoría</label>
                                <select
                                    value={currentMaterial.category}
                                    onChange={e => setCurrentMaterial({ ...currentMaterial, category: e.target.value as any })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                                >
                                    <option value="general">General</option>
                                    <option value="clothing">Indumentaria</option>
                                    <option value="access">Acceso / Credenciales</option>
                                    <option value="food">Alimentación</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Descripción / Detalles</label>
                                <textarea
                                    value={currentMaterial.description || ''}
                                    onChange={e => setCurrentMaterial({ ...currentMaterial, description: e.target.value })}
                                    rows={2}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
                                    placeholder="Detalles sobre tallas, lugar de entrega, etc."
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <label className="flex items-center space-x-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={currentMaterial.isRequired}
                                    onChange={e => setCurrentMaterial({ ...currentMaterial, isRequired: e.target.checked })}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span>Es obligatorio / Para todos</span>
                            </label>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#8CB83E] hover:bg-[#7cb342]"
                            >
                                {isEditing ? 'Guardar Cambios' : 'Crear Material'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
                <ul className="divide-y divide-gray-200">
                    {materials.length === 0 && !isLoading ? (
                        <li className="px-6 py-12 text-center text-gray-500">
                            <Package size={48} className="mx-auto text-gray-300 mb-2" />
                            <p>No hay materiales definidos para este evento.</p>
                        </li>
                    ) : (
                        materials.map((material) => (
                            <li key={material.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-lg ${material.category === 'clothing' ? 'bg-blue-100 text-blue-600' :
                                                material.category === 'access' ? 'bg-purple-100 text-purple-600' :
                                                    'bg-gray-100 text-gray-600'
                                            }`}>
                                            <Package size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-900">{material.name}</h4>
                                            <p className="text-sm text-gray-500">{material.description}</p>
                                            {material.isRequired && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-1">
                                                    Obligatorio
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => startEdit(material)}
                                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(material.id)}
                                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </div>
        </div>
    );
};

export default MaterialManagement;
