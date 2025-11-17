
import React, { useState, useEffect, useCallback } from 'react';
import type { User, Booking } from '../types';
import { mockApi } from '../services/mockApiService';
import { Check, X, Printer, UserCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [pendingCancellations, setPendingCancellations] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Roster state
  const [rosterDate, setRosterDate] = useState(new Date('2026-04-23').toISOString().split('T')[0]);
  const [rosterShift, setRosterShift] = useState<'13:00-16:00' | '16:00-22:00'>('13:00-16:00');
  const [rosterData, setRosterData] = useState<any[]>([]);

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
  }, [fetchCancellations]);

  const handleApprove = async (bookingId: string) => {
    try {
      await mockApi.approveCancellation(bookingId);
      toast.success('Baja aprobada. El cupo ha sido liberado.');
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


  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pending Cancellations */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Solicitudes de Baja Pendientes</h2>
            {isLoading ? <p>Cargando...</p> : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                {pendingCancellations.length > 0 ? pendingCancellations.map(booking => (
                    <div key={booking.id} className="p-4 border dark:border-gray-700 rounded-lg flex justify-between items-center">
                    <div>
                        <p className="font-semibold">{booking.user?.fullName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{booking.shift?.role.name} - {new Date(booking.shift?.date!).toLocaleDateString('es-ES')} {booking.shift?.timeSlot}</p>
                    </div>
                    <div className="flex space-x-2">
                        <button onClick={() => handleApprove(booking.id)} className="p-2 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full hover:bg-green-200"><Check size={18}/></button>
                        {/* Reject functionality can be added here */}
                        <button className="p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full hover:bg-red-200"><X size={18}/></button>
                    </div>
                    </div>
                )) : <p className="text-gray-500 dark:text-gray-400">No hay solicitudes pendientes.</p>}
                </div>
            )}
        </div>

        {/* Printable Roster */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Listado para Imprimir</h2>
            <div className="flex items-center space-x-4 mb-4">
                <input type="date" value={rosterDate} onChange={(e) => setRosterDate(e.target.value)} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"/>
                <select value={rosterShift} onChange={(e) => setRosterShift(e.target.value as any)} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                    <option value="13:00-16:00">13:00-16:00</option>
                    <option value="16:00-22:00">16:00-22:00</option>
                </select>
                <button onClick={handleFetchRoster} className="px-4 py-2 bg-primary-600 text-white font-semibold rounded-md hover:bg-primary-700">Generar</button>
            </div>
            {rosterData.length > 0 && (
                <div>
                <button onClick={handlePrint} className="mb-4 flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 font-semibold rounded-md hover:bg-gray-300"><Printer size={16} className="mr-2"/> Imprimir</button>
                    <div id="printable-roster">
                        <h3 style={{fontSize: '1.25rem', fontWeight: 'bold'}}>Listado de Voluntarios</h3>
                        <p>Fecha: {new Date(rosterDate).toLocaleDateString('es-ES')} | Turno: {rosterShift}</p>
                        <table style={{width: '100%', marginTop: '1rem'}}>
                            <thead>
                                <tr><th>Nombre Completo</th><th>DNI</th><th>Rol Asignado</th><th className="check">Asistencia</th></tr>
                            </thead>
                            <tbody>
                            {rosterData.map((item, index) => (
                                <tr key={index}>
                                    <td>{item.fullName}</td>
                                    <td>{item.dni}</td>
                                    <td>{item.role}</td>
                                    <td className="check"></td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default AdminDashboard;
