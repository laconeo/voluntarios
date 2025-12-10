import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Calendar, AlertCircle, Clock, PieChart, CheckCircle, XCircle, Star } from 'lucide-react';
import { mockApi } from '../services/mockApiService';
import type { DashboardMetrics, Event, Booking } from '../types';
import { toast } from 'react-hot-toast';
import EventVolunteersList from './EventVolunteersList';
import Modal from './Modal';

interface MetricsDashboardProps {
    eventId: string;
}

const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ eventId }) => {
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [event, setEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showCancellationsModal, setShowCancellationsModal] = useState(false);
    const [pendingCancellations, setPendingCancellations] = useState<any[]>([]);

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

    const handleViewCancellations = async () => {
        try {
            const cancellations = await mockApi.getPendingCancellations(eventId);
            setPendingCancellations(cancellations);
            setShowCancellationsModal(true);
        } catch (error) {
            toast.error('Error al cargar solicitudes de baja');
        }
    };

    const handleApproveCancellation = async (bookingId: string) => {
        try {
            await mockApi.approveCancellation(bookingId);
            toast.success('Baja confirmada exitosamente');
            // Refresh list and metrics
            const updatedCancellations = await mockApi.getPendingCancellations(eventId);
            setPendingCancellations(updatedCancellations);
            fetchMetrics();
            if (updatedCancellations.length === 0) setShowCancellationsModal(false);
        } catch (error) {
            toast.error('Error al confirmar baja');
        }
    };

    const handleRejectCancellation = async (bookingId: string) => {
        try {
            await mockApi.rejectCancellation(bookingId);
            toast.success('Baja rechazada exitosamente');
            // Refresh list and metrics
            const updatedCancellations = await mockApi.getPendingCancellations(eventId);
            setPendingCancellations(updatedCancellations);
            fetchMetrics();
            if (updatedCancellations.length === 0) setShowCancellationsModal(false);
        } catch (error) {
            toast.error('Error al rechazar baja');
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
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-card border border-fs-border">
                <h2 className="text-2xl font-serif text-fs-text mb-2">{event.nombre}</h2>
                <p className="text-sm text-fs-meta">
                    Dashboard de métricas y seguimiento de convocatoria
                </p>
            </div>

            {/* KPIs Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-card border border-fs-border">
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

                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-card border border-fs-border">
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

                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-card border border-fs-border">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-green-100 rounded-lg">
                            <Calendar className="text-green-600" size={24} />
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">Turnos Disponibles</p>
                    <p className="text-3xl font-bold text-gray-900">{metrics.availableVacancies}</p>
                    <p className="text-xs text-gray-500 mt-1">de {metrics.totalVacancies} totales</p>
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-card border border-fs-border">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-indigo-100 rounded-lg">
                            <CheckCircle className="text-indigo-600" size={24} />
                        </div>
                        <span className={`text-2xl font-bold px-3 py-1 rounded-full ${(metrics.attendancePercentage || 0) >= 80 ? 'text-green-600 bg-green-100' :
                            (metrics.attendancePercentage || 0) >= 50 ? 'text-yellow-600 bg-yellow-100' :
                                'text-red-600 bg-red-100'
                            }`}>
                            {metrics.attendancePercentage || 0}%
                        </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">Asistencia Real</p>
                    <p className="text-xs text-gray-500 mt-1">base a reportes</p>
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-card border border-fs-border">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-100 rounded-lg">
                            <Star className="text-purple-600" size={24} />
                        </div>
                        <span className="text-2xl font-bold px-3 py-1 rounded-full text-purple-600 bg-purple-100">
                            {metrics.previousExperiencePercentage || 0}%
                        </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">Con Experiencia</p>
                    <p className="text-xs text-gray-500 mt-1">participaron anteriormente</p>
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-card border border-fs-border">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-yellow-100 rounded-lg">
                            <AlertCircle className="text-yellow-600" size={24} />
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">Pendientes</p>
                    <div className="flex items-baseline gap-3">
                        <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={handleViewCancellations} role="button">
                            <p className="text-2xl font-bold text-gray-900 underline decoration-dotted">{metrics.pendingCancellations}</p>
                            <p className="text-xs text-gray-500">bajas (ver)</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{metrics.waitlistCount}</p>
                            <p className="text-xs text-gray-500">en espera</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ocupación por Horario y Roles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-card border border-fs-border">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock size={20} className="text-gray-600" />
                        <h3 className="font-serif text-lg text-fs-text">Ocupación por Horario</h3>
                    </div>
                    <div className="space-y-4">
                        {Object.entries(metrics.shiftOccupation).map(([timeSlot, percentage]) => (
                            <div key={timeSlot}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-gray-700">{timeSlot}</span>
                                    <span className="text-sm font-bold text-gray-900">{percentage}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                    <div
                                        className={`h-3 rounded-full transition-all duration-500 ${percentage >= 80 ? 'bg-primary-500' :
                                            percentage >= 50 ? 'bg-yellow-500' :
                                                'bg-blue-500'
                                            }`}
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {Object.keys(metrics.shiftOccupation).length === 0 && (
                            <p className="text-sm text-gray-500">No hay turnos configurados.</p>
                        )}
                    </div>
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-card border border-fs-border">
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
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-card border border-fs-border">
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
            {(metrics.occupationPercentage < 30 || metrics.pendingCancellations > 0) && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 sm:p-6 rounded-lg">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-semibold text-yellow-800 mb-2">Alertas del Sistema</h4>
                            <ul className="text-sm text-yellow-700 space-y-1">
                                {metrics.occupationPercentage < 30 && (
                                    <li>• La ocupación general está por debajo del 30%. Considera promover más la convocatoria.</li>
                                )}
                                {metrics.pendingCancellations > 0 && (
                                    <li>
                                        • Hay {metrics.pendingCancellations} solicitudes de baja pendientes.{' '}
                                        <button onClick={handleViewCancellations} className="underline font-semibold hover:text-yellow-900">
                                            Revisar ahora
                                        </button>
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Event Volunteers List */}
            <EventVolunteersList eventId={eventId} />

            <Modal
                isOpen={showCancellationsModal}
                onClose={() => setShowCancellationsModal(false)}
                title="Solicitudes de Baja Pendientes"
            >
                <div>
                    {pendingCancellations.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No hay solicitudes de baja pendientes.</p>
                    ) : (
                        <div className="space-y-4">
                            {pendingCancellations.map((cancellation) => (
                                <div key={cancellation.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <h4 className="font-bold text-gray-900">{cancellation.user?.fullName}</h4>
                                        <div className="text-sm text-gray-600 space-y-1 mt-1">
                                            <p><strong>Rol:</strong> {cancellation.shift?.role?.name}</p>
                                            <p><strong>Turno:</strong> {new Date(cancellation.shift?.date).toLocaleDateString()} - {cancellation.shift?.timeSlot}</p>
                                            <p><strong>Motivo:</strong> Solicitada el {new Date(cancellation.cancelledAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button
                                            onClick={() => handleRejectCancellation(cancellation.id)}
                                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium"
                                        >
                                            <XCircle size={18} />
                                            Rechazar
                                        </button>
                                        <button
                                            onClick={() => handleApproveCancellation(cancellation.id)}
                                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors font-medium"
                                        >
                                            <CheckCircle size={18} />
                                            Confirmar Baja
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default MetricsDashboard;