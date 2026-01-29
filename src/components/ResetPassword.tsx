
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            toast.error(error.message);
            setLoading(false);
        } else {
            toast.success('Contraseña actualizada correctamente');
            navigate('/');
        }
    };

    return (
        <div className="max-w-md mx-auto mt-16 px-4">
            <div className="bg-white p-10 rounded-lg shadow-card border border-fs-border text-center">
                <div className="mb-6">
                    <h2 className="text-2xl font-serif text-fs-text mb-2">Establecer Nueva Contraseña</h2>
                    <p className="text-gray-500 text-sm">Ingresa tu nueva contraseña para acceder al portal.</p>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-6">
                    <div className="relative">
                        <label className="sr-only">Nueva Contraseña</label>
                        <Lock className="absolute left-4 top-3.5 text-gray-400" size={20} />
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-fs-border rounded-fs focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-xl text-center text-fs-text placeholder-gray-400"
                            placeholder="Nueva Contraseña"
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary shadow-sm hover:shadow-md flex justify-center items-center"
                    >
                        {loading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : 'ACTUALIZAR CONTRASEÑA'}
                    </button>
                </form>
                <p className="mt-8 text-xs text-gray-400">
                    © 2026 Hecho con ❤️ para proveer apoyo al usuario
                </p>
            </div>
        </div>
    );
};

export default ResetPassword;
