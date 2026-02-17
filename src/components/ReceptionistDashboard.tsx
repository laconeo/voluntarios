import React, { useState } from 'react';
import type { User } from '../types';
import { LogOut, Monitor } from 'lucide-react';
import PCMonitor from './PCMonitor';

interface ReceptionistDashboardProps {
    user: User;
    onLogout: () => void;
}

const ReceptionistDashboard: React.FC<ReceptionistDashboardProps> = ({ user, onLogout }) => {
    const [currentView, setCurrentView] = useState<'home' | 'monitor'>('home');

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">Panel de Recepción</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-600">Hola, {user.fullName}</span>
                        <button
                            onClick={onLogout}
                            className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800 transition-colors"
                        >
                            <LogOut size={16} />
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {currentView === 'home' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <button
                            onClick={() => setCurrentView('monitor')}
                            className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all flex flex-col items-center justify-center gap-4 group"
                        >
                            <div className="p-4 bg-indigo-50 rounded-full group-hover:bg-indigo-100 transition-colors">
                                <Monitor size={48} className="text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Monitor de Stand</h3>
                            <p className="text-sm text-gray-500 text-center">Ver estado y disponibilidad de PCs</p>
                        </button>
                    </div>
                )}

                {currentView === 'monitor' && (
                    <div>
                        <button
                            onClick={() => setCurrentView('home')}
                            className="mb-4 text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-2"
                        >
                            &larr; Volver al Inicio
                        </button>
                        <PCMonitor />
                    </div>
                )}
            </main>
        </div>
    );
};

export default ReceptionistDashboard;
