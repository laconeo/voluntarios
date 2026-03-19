import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Edit2, Shirt, Tag, Coffee } from 'lucide-react';
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
    const [tshirtSizes, setTshirtSizes] = useState<Record<string, number>>({});

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
            const [data, sizesData] = await Promise.all([
                supabaseApi.getMaterialsByEvent(eventId),
                supabaseApi.getEventTshirtSizes(eventId)
            ]);
            setMaterials(data);
            setTshirtSizes(sizesData);
        } catch (error) {
            console.error('Error loading materials:', error);
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
        setCurrentMaterial({ name: '', description: '', quantity: 0, category: 'general', isRequired: true });
        setIsEditing(false);
    };

    const totalVolunteers = Object.values(tshirtSizes).reduce((a, b) => a + b, 0);

    const SIZE_ORDER: Record<string, number> = { 'S': 1, 'M': 2, 'L': 3, 'XL': 4, 'XXL': 5, '3XL': 6 };
    const allSizes = Array.from(new Set(['S', 'M', 'L', 'XL', 'XXL', ...Object.keys(tshirtSizes)]))
        .sort((a, b) => (SIZE_ORDER[a] || 99) - (SIZE_ORDER[b] || 99));

    const getCategoryStyle = (category: string) => {
        switch (category) {
            case 'access': return { bg: 'bg-purple-100', text: 'text-purple-600' };
            case 'food': return { bg: 'bg-orange-100', text: 'text-orange-600' };
            case 'clothing': return { bg: 'bg-pink-100', text: 'text-pink-600' };
            default: return { bg: 'bg-emerald-100', text: 'text-emerald-600' };
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'access': return <Tag size={20} />;
            case 'food': return <Coffee size={20} />;
            case 'clothing': return <Shirt size={20} />;
            default: return <Package size={20} />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-medium text-gray-900">Materiales y Entregables</h2>
                    <p className="text-sm text-gray-500">Gestiona los materiales que se deben entregar a los voluntarios</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#8CB83E] hover:bg-[#7cb342]"
                >
                    <Plus size={20} className="mr-2" />
                    Nuevo Material
                </button>
            </div>

            {/* ─── Sección: Talles de Remeras ─── */}
            {!isLoading && (
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-card border border-fs-border">
                    <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-pink-100 rounded-lg">
                            <Shirt className="text-pink-600" size={22} />
                        </div>
                        <div>
                            <h3 className="font-serif text-lg text-fs-text">Remeras por Talle</h3>
                            <p className="text-xs text-gray-500">
                                Total de voluntarios: <span className="font-bold text-gray-800">{totalVolunteers}</span>
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {allSizes.map(size => (
                            <div key={size} className="bg-white p-4 rounded-lg shadow-card border border-fs-border text-center">
                                <div className="p-2 bg-pink-100 rounded-lg w-fit mx-auto mb-3">
                                    <Shirt className="text-pink-600" size={20} />
                                </div>
                                <p className="text-sm text-gray-500 mb-1 font-semibold">{size}</p>
                                <p className="text-3xl font-bold text-gray-900">{tshirtSizes[size] || 0}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Sección: Otros Materiales ─── */}
            {!isLoading && materials.length > 0 && (
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-card border border-fs-border">
                    <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <Package className="text-emerald-600" size={22} />
                        </div>
                        <h3 className="font-serif text-lg text-fs-text">Totales por Material</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {materials.map(material => {
                            const count = material.isRequired ? totalVolunteers : (material.quantity || 0);
                            const style = getCategoryStyle(material.category);
                            return (
                                <div key={material.id} className="bg-white p-4 sm:p-5 rounded-lg shadow-card border border-fs-border">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className={`p-2 ${style.bg} rounded-lg`}>
                                            <span className={style.text}>{getCategoryIcon(material.category)}</span>
                                        </div>
                                        {material.isRequired && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                                                Para todos
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 mb-1">{material.name}</p>
                                    <p className="text-3xl font-bold text-gray-900">{count}</p>
                                    {material.description && (
                                        <p className="text-xs text-gray-400 mt-2 truncate" title={material.description}>
                                            {material.description}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ─── Formulario ─── */}
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
                                    placeholder="Ej. Camiseta Oficial, Gafete, Botella de Agua"
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
                                    placeholder="Detalles sobre el item..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Cantidad fija (si no es para todos)</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={currentMaterial.quantity ?? 0}
                                    onChange={e => setCurrentMaterial({ ...currentMaterial, quantity: Number(e.target.value) })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
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
                                <span>Para todos los voluntarios (muestra total de inscriptos)</span>
                            </label>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                                Cancelar
                            </button>
                            <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#8CB83E] hover:bg-[#7cb342]">
                                {isEditing ? 'Guardar Cambios' : 'Crear Material'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ─── Lista de Materiales ─── */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Lista de Materiales Configurados</h4>
                </div>
                <ul className="divide-y divide-gray-200">
                    {materials.length === 0 && !isLoading ? (
                        <li className="px-6 py-12 text-center text-gray-500">
                            <Package size={48} className="mx-auto text-gray-300 mb-2" />
                            <p>No hay materiales definidos. Hacé click en "Nuevo Material" para añadir uno.</p>
                        </li>
                    ) : (
                        materials.map((material) => {
                            const style = getCategoryStyle(material.category);
                            return (
                                <li key={material.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 ${style.bg} ${style.text} rounded-lg`}>
                                                {getCategoryIcon(material.category)}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-900">{material.name}</h4>
                                                <p className="text-sm text-gray-500">{material.description}</p>
                                                <div className="flex gap-2 mt-1">
                                                    {material.isRequired ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                            Para todos
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                            Stock: {material.quantity ?? 0}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => startEdit(material)} className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                                                <Edit2 size={18} />
                                            </button>
                                            <button onClick={() => handleDelete(material.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })
                    )}
                </ul>
            </div>
        </div>
    );
};

export default MaterialManagement;
