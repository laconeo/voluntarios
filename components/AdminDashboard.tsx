
import React, { useState, useEffect, useCallback } from 'react';
import type { User, Booking, Role, Shift } from '../types';
import { mockApi } from '../services/mockApiService';
import { Check, X, Printer, CalendarPlus, List, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'bajas' | 'roster' | 'turnos'>('bajas');
  const [pendingCancellations, setPendingCancellations] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Roster state
  const [rosterDate, setRosterDate] = useState(new Date('2026-04-23').toISOString().split('T')[0]);
  const [rosterShift, setRosterShift] = useState<'13:00-16:00' | '16:00-22:00'>('13:00-16:00');
  const [rosterData, setRosterData] = useState<any[]>([]);

  // Shift Management State
  const [roles, setRoles] = useState<Role[]>([]);
  const [newShift, setNewShift] = useState({
    date: new Date('2026-04-23').toISOString().split('T')[0],
    timeSlot: '13:00-16:00' as '13:00-16:00' | '16:00-22:00',
    roleId: '',
    totalVacancies: 5
  });

  const fetchCancellations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await mockApi.getPendingCancellations();
      setPendingCancellations(data);
    } catch (error) {
      toast.error('Error al cargar solicitudes de baja.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCancellations();
    mockApi.getAllRoles().then(r => {
      setRoles(r);
      if (r.length > 0) setNewShift(prev => ({ ...prev, roleId: r[0].id }));
    });
  }, [fetchCancellations]);

  const handleApprove = async (bookingId: string) => {
    try {
      await mockApi.approveCancellation(bookingId);
      toast.success('Baja aprobada.');
      fetchCancellations();
    } catch (error) {
      toast.error('Error al aprobar la baja.');
    }
  };

  const handleFetchRoster = async () => {
    try {
      const data = await mockApi.getPrintableRoster(rosterDate, rosterShift);
      setRosterData(data);
    } catch (error) {
      toast.error('Error al generar el listado.');
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mockApi.createShift(newShift);
      toast.success("Turno creado exitosamente");
    } catch (error) {
      toast.error("Error al crear turno");
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('printable-roster');
    if (printContent) {
      const newWindow = window.open('', '', 'height=600,width=800');
      newWindow?.document.write('<html><head><title>Listado de Voluntarios</title>');
      newWindow?.document.write('<style>body{font-family:sans-serif;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:8px;} th{background-color:#f2f2f2;} .check{width:50px;}</style>');
      newWindow?.document.write('</head><body>');
      newWindow?.document.write(printContent.innerHTML);
      newWindow?.document.write('</body></html>');
      newWindow?.document.close();
      newWindow?.print();
    }
  };

  const tabButtonClass = (tab: string) => `px-4 py-2 font-medium rounded-t-lg transition-colors ${activeTab === tab ? 'bg-white border-b-2 border-primary-500 text-primary-600' : 'bg-gray-100 text-gray-500 hover:text-gray-700'}`;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex space-x-1 mb-4 border-b border-gray-200">
        <button onClick={() => setActiveTab('bajas')} className={tabButtonClass('bajas')}>
          <div className="flex items-center"><List size={18} className="mr-2" /> Solicitudes</div>
        </button>
        <button onClick={() => setActiveTab('roster')} className={tabButtonClass('roster')}>
          <div className="flex items-center"><Printer size={18} className="mr-2" /> Reportes</div>
        </button>
        <button onClick={() => setActiveTab('turnos')} className={tabButtonClass('turnos')}>
          <div className="flex items-center"><CalendarPlus size={18} className="mr-2" /> Gestionar Turnos</div>
        </button>
      </div>

      {activeTab === 'bajas' && (
        <div className="bg-white p-6 rounded-lg shadow-card border border-fs-border">
          <h2 className="text-xl font-serif mb-4 text-fs-text">Solicitudes de Baja Pendientes</h2>
          {isLoading ? <div className="text-center py-4">Cargando...</div> : (
            <div className="space-y-3">
              {pendingCancellations.length > 0 ? pendingCancellations.map(booking => (
                <div key={booking.id} className="p-4 border border-gray-200 rounded-lg flex justify-between items-center bg-gray-50">
                  <div>
                    <p className="font-bold text-fs-text">{booking.user?.fullName}</p>
                    <p className="text-sm text-gray-500">{booking.shift?.role.name} - {new Date(booking.shift?.date!).toLocaleDateString('es-ES')} {booking.shift?.timeSlot}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => handleApprove(booking.id)} className="flex items-center px-3 py-1.5 bg-primary-100 text-primary-700 rounded-fs hover:bg-primary-200 font-bold text-sm">
                      <Check size={16} className="mr-1" /> Aprobar Baja
                    </button>
                  </div>
                </div>
              )) : <p className="text-gray-500 italic py-4 text-center">No hay solicitudes pendientes.</p>}
            </div>
          )}
        </div>
      )}

      {activeTab === 'roster' && (
        <div className="bg-white p-6 rounded-lg shadow-card border border-fs-border">
          <h2 className="text-xl font-serif mb-4 text-fs-text">Listado para Imprimir</h2>
          <div className="flex flex-wrap items-end gap-4 mb-6 bg-gray-50 p-4 rounded-fs border border-gray-100">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
              <input type="date" value={rosterDate} onChange={(e) => setRosterDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-fs text-sm focus:border-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Turno</label>
              <select value={rosterShift} onChange={(e) => setRosterShift(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-fs text-sm focus:border-primary-500 focus:outline-none">
                <option value="13:00-16:00">13:00-16:00</option>
                <option value="16:00-22:00">16:00-22:00</option>
              </select>
            </div>
            <button onClick={handleFetchRoster} className="px-4 py-2 bg-primary-500 text-white font-bold rounded-fs hover:bg-primary-600 text-sm shadow-sm">
              Generar Lista
            </button>
          </div>

          {rosterData.length > 0 && (
            <div className="animate-fade-in">
              <button onClick={handlePrint} className="mb-4 flex items-center px-4 py-2 bg-gray-800 text-white font-bold rounded-fs hover:bg-black text-sm"><Printer size={16} className="mr-2" /> Imprimir</button>
              <div id="printable-roster" className="border p-8 bg-white">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.5rem', fontFamily: 'serif', margin: 0 }}>Listado de Voluntarios</h3>
                    <p style={{ margin: '5px 0', color: '#666' }}>Feria del Libro 2026</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 'bold', margin: 0 }}>{new Date(rosterDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    <p style={{ margin: 0 }}>{rosterShift} hs</p>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f2f2f2' }}>
                      <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Nombre Completo</th>
                      <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>DNI</th>
                      <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Rol Asignado</th>
                      <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'center', width: '80px' }}>Presente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterData.map((item, index) => (
                      <tr key={index}>
                        <td style={{ border: '1px solid #ddd', padding: '10px' }}>{item.fullName}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px' }}>{item.dni}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px' }}>{item.role}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px' }}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'turnos' && (
        <div className="bg-white p-6 rounded-lg shadow-card border border-fs-border">
          <h2 className="text-xl font-serif mb-4 text-fs-text">Crear Nuevo Turno</h2>
          <form onSubmit={handleCreateShift} className="max-w-md space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Fecha</label>
              <input type="date" required value={newShift.date} onChange={e => setNewShift({ ...newShift, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-fs focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Horario</label>
              <select value={newShift.timeSlot} onChange={e => setNewShift({ ...newShift, timeSlot: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-fs focus:ring-1 focus:ring-primary-500 outline-none">
                <option value="13:00-16:00">13:00-16:00</option>
                <option value="16:00-22:00">16:00-22:00</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Rol</label>
              <select value={newShift.roleId} onChange={e => setNewShift({ ...newShift, roleId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-fs focus:ring-1 focus:ring-primary-500 outline-none">
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Vacantes</label>
              <input type="number" min="1" required value={newShift.totalVacancies} onChange={e => setNewShift({ ...newShift, totalVacancies: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-fs focus:ring-1 focus:ring-primary-500 outline-none" />
            </div>
            <button type="submit" className="w-full py-2 bg-primary-500 text-white font-bold rounded-fs hover:bg-primary-600 shadow-sm mt-2">
              Agregar Turno
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
