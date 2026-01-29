import React, { useState } from 'react';
import type { User } from '../types';
import { mockApi } from '../services/mockApiService';
import { toast } from 'react-hot-toast';
import { Save, User as UserIcon } from 'lucide-react';

interface UserProfileProps {
    user: User;
    onUpdate: (updatedUser: User) => void;
    onCancel: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdate, onCancel }) => {
    const [formData, setFormData] = useState<User>(user);
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const updated = await mockApi.updateUser(formData);
            onUpdate(updated);
            toast.success('Perfil actualizado correctamente');
        } catch (error) {
            toast.error('Error al actualizar perfil');
        } finally {
            setIsLoading(false);
        }
    };

    const inputClasses = "w-full px-3 py-2.5 bg-white border border-fs-border rounded-fs focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-fs-text placeholder-gray-400 transition-colors";
    const labelClasses = "block text-sm font-semibold text-gray-600 mb-1.5";

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-card border border-fs-border mt-6">
            <div className="flex items-center gap-3 mb-6 border-b border-fs-border pb-4">
                <div className="bg-primary-50 p-2 rounded-full text-primary-600">
                    <UserIcon size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-serif text-fs-text">Mi Perfil</h2>
                    <p className="text-sm text-fs-meta">Actualiza tu información de contacto</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className={labelClasses}>DNI (No editable)</label>
                        <input type="text" value={formData.dni} disabled className={`${inputClasses} bg-gray-100 text-gray-500 cursor-not-allowed`} />
                    </div>
                    <div>
                        <label className={labelClasses}>Nombre Completo</label>
                        <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required className={inputClasses} />
                    </div>
                    <div>
                        <label className={labelClasses}>Correo Electrónico</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} required className={inputClasses} />
                    </div>
                    <div>
                        <label className={labelClasses}>Teléfono</label>
                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className={inputClasses} />
                    </div>
                    <div>
                        <label className={labelClasses}>Talle de Remera</label>
                        <div className="relative">
                            <select name="tshirtSize" value={formData.tshirtSize} onChange={handleChange} className={`${inputClasses} appearance-none`}>
                                <option value="S">S</option>
                                <option value="M">M</option>
                                <option value="L">L</option>
                                <option value="XL">XL</option>
                                <option value="XXL">XXL</option>
                                <option value="3XL">3XL</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-fs-border">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 border border-fs-border rounded-fs text-fs-text hover:bg-gray-50 font-medium"
                    >
                        Volver
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="flex items-center px-4 py-2 bg-primary-500 text-white rounded-fs hover:bg-primary-600 font-bold shadow-sm"
                    >
                        {isLoading ? 'Guardando...' : <><Save size={18} className="mr-2" /> Guardar Cambios</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default UserProfile;
