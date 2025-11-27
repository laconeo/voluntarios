import React, { useState } from 'react';
import type { User } from './types';
import { mockApi } from './services/mockApiService';
import VolunteerPortal from './components/VolunteerPortal';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import Header from './components/Header';
import UserProfile from './components/UserProfile';
import { Toaster, toast } from 'react-hot-toast';
import SuperAdminDashboard from './components/SuperAdminDashboard';

type ViewState = 'portal' | 'profile' | 'admin';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('portal');

  const handleLogin = async (identifier: string) => {
    try {
      const user = await mockApi.login(identifier);
      if (user) {
        setCurrentUser(user);
        setCurrentView(user.role === 'admin' ? 'admin' : 'portal');
        toast.success(`Bienvenido/a ${user.fullName.split(' ')[0]}!`);
      } else {
        // New volunteer, show registration form
        setCurrentUser({
          id: '',
          dni: identifier,
          fullName: '',
          email: '',
          phone: '',
          tshirtSize: 'M',
          isMember: false,
          attendedPrevious: false,
          isOver18: false,
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
      setCurrentView('portal');
      toast.success('¡Registro exitoso!');
    } catch (error) {
      toast.error('Error en el registro.');
      console.error(error);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('portal');
    toast('Sesión cerrada.');
  };

  const handleUpdateProfile = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    setCurrentView('portal'); // Volver al portal tras guardar
  };

  const renderContent = () => {
    if (!currentUser) {
      return <Login onLogin={handleLogin} onRegister={handleRegister} />;
    }

    if (currentUser.role === 'superadmin') {
      return <SuperAdminDashboard user={currentUser} onLogout={handleLogout} />;
    }

    // Si el usuario no tiene ID, es que está en proceso de registro (paso intermedio en Login)
    if (currentUser.role === 'volunteer' && !currentUser.id) {
      return <Login onLogin={handleLogin} onRegister={handleRegister} initialDni={currentUser.dni} />;
    }

    if (currentView === 'profile') {
      return <UserProfile user={currentUser} onUpdate={handleUpdateProfile} onCancel={() => setCurrentView('portal')} />;
    }

    if (currentUser.role === 'admin') {
      return <AdminDashboard user={currentUser} onLogout={handleLogout} />;
    }

    return <VolunteerPortal user={currentUser} onLogout={handleLogout} />;
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] text-[#333333] font-sans">
      <Toaster position="top-center" reverseOrder={false} toastOptions={{
        style: {
          background: '#333',
          color: '#fff',
          fontFamily: '"Noto Sans", sans-serif'
        }
      }} />
      <Header
        user={currentUser}
        onLogout={currentUser ? handleLogout : undefined}
        onProfileClick={() => setCurrentView('profile')}
        onLogoClick={() => setCurrentView(currentUser?.role === 'admin' ? 'admin' : 'portal')}
      />
      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;