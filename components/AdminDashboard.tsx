import React, { useState } from 'react';
import SuperAdminDashboard from './SuperAdminDashboard';
import MetricsDashboard from './MetricsDashboard';
import type { User } from '../types';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  if (selectedEventId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4 mb-6">
          <button
            onClick={() => setSelectedEventId(null)}
            className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-2"
          >
            ← Volver al listado de eventos
          </button>
        </div>
        <div className="max-w-7xl mx-auto px-6">
          <MetricsDashboard eventId={selectedEventId} />
        </div>
      </div>
    );
  }

  return (
    <SuperAdminDashboard
      user={user}
      onLogout={onLogout}
      onViewMetrics={(eventId) => setSelectedEventId(eventId)}
    />
  );
};

export default AdminDashboard;