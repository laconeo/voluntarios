import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Calendar, AlertCircle, Clock, PieChart } from 'lucide-react';
import { mockApi } from '../services/mockApiService';
import type { DashboardMetrics, Event } from '../types';
import { toast } from 'react-hot-toast';

interface MetricsDashboardProps {
    eventId: string;
}

const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ eventId }) => {
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [event, setEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchMetrics();
    }, [eventId]);

    const fetchMetrics = async () => {
        setIsLoading(true);
        try {
            const [metricsData, eventData] = await Promise.all([
                mockApi.getDashboardMetrics(eventId),
                mockApi.getEventById(eventId)
            ]);
            setMetrics(metricsData);
            setEvent(eventData);
        } catch (error) {
            toast.error('Error al cargar métricas');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (!metrics || !event) {
        return <div className="text-center py-12 text-gray-500">No hay datos disponibles</div>;
    }

    const getOccupationColor = (percentage: number) => {
        if (percentage >= 80) return 'text-primary-600 bg-primary-100';
        if (percentage >= 50) return 'text-yellow-600 bg-yellow-100';
        return 'text-red-600 bg-red-100';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-6 rounded-lg shadow-card border border-fs-border">
                <h2 className="text-2xl font-serif text-fs-text mb-2">{event.nombre}</h2>
                <p className="text-sm text-fs-meta">
                    Dashboard de métricas y seguimiento de convocatoria
                </p>
            </div>

            {/* KPIs Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-card border border-fs-border">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-primary-100 rounded-lg">
                            <TrendingUp className="text-primary-600" size={24} />
                        </div>
                        <span className={`text-2xl font-bold px-3 py-1 rounded-full ${getOccupationColor(metrics.occupationPercentage)}`}>
                            {metrics.occupationPercentage}%
                        </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">Ocupación General</p>
                    <p className="text-lg font-bold text-gray-900">
                        {metrics.occupiedVacancies} / {metrics.totalVacancies}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">vacantes ocupadas</p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-card border border-fs-border">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <Users className="text-blue-600" size={24} />
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">Voluntarios Únicos</p>
                    <p className="text-3xl font-bold text-gray-900">{metrics.uniqueVolunteers}</p>
                    <p className="text-xs text-gray-500 mt-1">
                        Promedio: {metrics.avgShiftsPerVolunteer} turnos por voluntario
                    </p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-card border border-fs-border">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-green-100 rounded-lg">
                            <Calendar className="text-green-600" size={24} />
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">Turnos Disponibles</p>
                    <p className="text-3xl font-bold text-gray-900">{metrics.availableVacancies}</p>
                    <p className="text-xs text-gray-500 mt-1">de {metrics.totalVacancies} totales</p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-card border border-fs-border">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-yellow-100 rounded-lg">
                            <AlertCircle className="text-yellow-600" size={24} />
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">Pendientes</p>
                    <div className="flex items-baseline gap-3">
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{metrics.pendingCancellations}</p>
                            <p className="text-xs text-gray-500">bajas</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{metrics.waitlistCount}</p>
                            <p className="text-xs text-gray-500">en espera</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ocupación por Horario */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-card border border-fs-border">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock size={20} className="text-gray-600" />
                        <h3 className="font-serif text-lg text-fs-text">Ocupación por Horario</h3>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-700">Turno Tarde (13-16hs)</span>
                                <span className="text-sm font-bold text-gray-900">{metrics.shiftOccupation.morning}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className="bg-primary-500 h-3 rounded-full transition-all duration-500"
                                    style={{ width: `${metrics.shiftOccupation.morning}%` }}
                                ></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-700">Turno Noche (16-22hs)</span>
                                <span className="text-sm font-bold text-gray-900">{metrics.shiftOccupation.afternoon}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                                    style={{ width: `${metrics.shiftOccupation.afternoon}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-card border border-fs-border">
                    <div className="flex items-center gap-2 mb-4">
                        <PieChart size={20} className="text-gray-600" />
                        <h3 className="font-serif text-lg text-fs-text">Distribución por Rol</h3>
                    </div>
                    <div className="space-y-2">
                        {metrics.roleDistribution.slice(0, 5).map((role, index) => {
                            const percentage = (role.count / metrics.occupiedVacancies) * 100;
                            const colors = ['bg-primary-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'];
                            return (
                                <div key={role.roleName} className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`}></div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-gray-700">{role.roleName}</span>
                                            <span className="text-gray-600">{role.count} ({percentage.toFixed(0)}%)</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Ocupación Diaria */}
            <div className="bg-white p-6 rounded-lg shadow-card border border-fs-border">
                <h3 className="font-serif text-lg text-fs-text mb-6">Ocupación por Día</h3>
                <div className="space-y-3">
                    {metrics.dailyOccupation.map((day) => {
                        const date = new Date(day.date);
                        const dayName = date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

                        return (
                            <div key={day.date} className="flex items-center gap-4">
                                <span className="text-sm font-medium text-gray-700 w-24 capitalize">{dayName}</span>
                                <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                                    <div
                                        className={`h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-2 ${day.occupation >= 80 ? 'bg-primary-500' :
                                                day.occupation >= 50 ? 'bg-yellow-500' :
                                                    'bg-red-500'
                                            }`}
                                        style={{ width: `${day.occupation}%` }}
                                    >
                                        {day.occupation > 15 && (
                                            <span className="text-xs font-bold text-white">{day.occupation}%</span>
                                        )}
                                    </div>
                                    {day.occupation <= 15 && (
                                        <span className="absolute left-2 top-1 text-xs font-bold text-gray-700">{day.occupation}%</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Alertas */}
            {(metrics.occupationPercentage < 30 || metrics.pendingCancellations > 5) && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-semibold text-yellow-800 mb-2">Alertas del Sistema</h4>
                            <ul className="text-sm text-yellow-700 space-y-1">
                                {metrics.occupationPercentage < 30 && (
                                    <li>• La ocupación general está por debajo del 30%. Considera promover más la convocatoria.</li>
                                )}
                                {metrics.pendingCancellations > 5 && (
                                    <li>• Hay {metrics.pendingCancellations} solicitudes de baja pendientes de validación.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MetricsDashboard;