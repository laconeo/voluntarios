
import React, { useState, useMemo } from 'react';
import type { User, Role, Shift, Booking } from './types';
import { mockApi } from './services/mockApiService';
import VolunteerPortal from './components/VolunteerPortal';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import Header from './components/Header';
import { Toaster, toast } from 'react-hot-toast';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const handleLogin = async (identifier: string) => {
    try {
      const user = await mockApi.login(identifier);
      if (user) {
        setCurrentUser(user);
        toast.success(`Bienvenido/a ${user.fullName.split(' ')[0]}!`);
      } else {
        // New volunteer, show registration form. The Login component handles this.
        setCurrentUser({
            id: '', // Will be set upon registration
            dni: identifier,
            fullName: '',
            email: '',
            phone: '',
            tshirtSize: 'M',
            isMember: false,
            attendedPrevious: false,
            isOver18: true,
            howTheyHeard: '',
            role: 'volunteer',
        });
      }
    } catch (error) {
      toast.error('Error al iniciar sesión.');
      console.error(error);
    }
  };

  const handleRegister = async (newUser: User) => {
    try {
        const registeredUser = await mockApi.register(newUser);
        setCurrentUser(registeredUser);
        toast.success('¡Registro exitoso!');
    } catch (error) {
        toast.error('Error en el registro.');
        console.error(error);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    toast('Sesión cerrada.');
  };

  const renderContent = () => {
    if (!currentUser) {
      return <Login onLogin={handleLogin} onRegister={handleRegister} />;
    }
    
    if (currentUser.role === 'admin') {
      return <AdminDashboard user={currentUser} onLogout={handleLogout} />;
    }
    
    // New or existing volunteer
    if (currentUser.role === 'volunteer' ) {
        if (!currentUser.id) { // New volunteer, needs to fill details
             return <Login onLogin={handleLogin} onRegister={handleRegister} initialDni={currentUser.dni} />;
        }
        return <VolunteerPortal user={currentUser} onLogout={handleLogout} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <Toaster position="top-center" reverseOrder={false} />
      <Header 
        user={currentUser} 
        onLogout={currentUser ? handleLogout : undefined} 
      />
      <main className="p-4 sm:p-6 lg:p-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
