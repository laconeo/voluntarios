import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import type { User, Event } from './types';
import { supabaseApi as mockApi } from './services/supabaseApiService';
import VolunteerPortal from './components/VolunteerPortal';
import AdminDashboard from './components/AdminDashboard';
import CoordinatorDashboard from './components/CoordinatorDashboard';
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import { supabase } from './lib/supabaseClient';
import Header from './components/Header';
import UserProfile from './components/UserProfile';
import { Toaster, toast } from 'react-hot-toast';

// Wrapper component to handle event slug logic
const EventPortalWrapper: React.FC<{
  user: User | null,
  onLogout: () => void,
  onLogin: (id: string, password?: string) => Promise<boolean | 'password_required' | 'register'>,
  onRegister: (u: User) => void
  onRecoverPassword: (email: string) => Promise<void>
}> = ({ user, onLogout, onLogin, onRegister, onRecoverPassword }) => {
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      if (eventSlug) {
        const foundEvent = await mockApi.getEventBySlug(eventSlug);
        setEvent(foundEvent);
      }
      setLoading(false);
    };
    fetchEvent();
  }, [eventSlug]);

  if (loading) return <div className="p-8 text-center">Cargando evento...</div>;

  if (!event) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-red-600">Evento no encontrado</h2>
        <p className="text-gray-600">La URL ingresada no corresponde a ningún evento activo.</p>
      </div>
    );
  }

  // Check if event is archived or inactive
  if (event.estado === 'Archivado') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-gray-200 p-8 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{event.nombre}</h2>
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-sm font-semibold rounded-full">
              Evento Archivado
            </span>
          </div>
          <p className="text-gray-600 mb-4">
            Este evento ha finalizado y ya no está aceptando inscripciones de voluntarios.
          </p>
          <p className="text-sm text-gray-500">
            Si crees que esto es un error, por favor contacta al administrador del evento.
          </p>
        </div>
      </div>
    );
  }

  if (event.estado === 'Inactivo') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-yellow-200 p-8 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{event.nombre}</h2>
            <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-semibold rounded-full">
              Evento Inactivo
            </span>
          </div>
          <p className="text-gray-600 mb-4">
            Este evento aún no está activo. Las inscripciones se abrirán próximamente.
          </p>
          <p className="text-sm text-gray-500">
            Por favor, vuelve más tarde o contacta al administrador del evento para más información.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={onLogin} onRegister={onRegister} onRecoverPassword={onRecoverPassword} />;
  }

  // If user is admin/superadmin, they might want to see the admin dashboard instead
  // But if they are at a specific event URL, they probably want to see the portal for that event
  // We'll stick to the portal view for specific event URLs unless they explicitly navigate away
  return <VolunteerPortal user={user} onLogout={onLogout} eventId={event.id} />;
};

const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'portal' | 'profile' | 'admin'>('portal');
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for Password Recovery event
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password');
      } else if (event === 'SIGNED_IN' && session) {
        // Optional: Auto-login if session exists
        // But we already handle login via mockApi.login manually in handleLogin.
        // If we want auto-persistence logic here:
        // const user = await mockApi.getUserById(session.user.id);
        // if (user) setCurrentUser(user);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogin = async (identifier: string, password?: string): Promise<boolean | 'password_required' | 'register'> => {
    try {
      const user = await mockApi.login(identifier, password);
      if (user) {
        setCurrentUser(user);
        toast.success(`Bienvenido/a ${user.fullName.split(' ')[0]}!`);

        // Redirigir a home para admin, superadmin y coordinator
        if (user.role === 'admin' || user.role === 'superadmin' || user.role === 'coordinator') {
          navigate('/');
        }
        return true;
      } else {
        // User not found, signal Login component to show registration
        return 'register';
      }
    } catch (error: any) {
      if (error.message === 'Contraseña incorrecta') {
        if (password) {
          toast.error('Email o contraseña incorrectos');
        }
        return 'password_required';
      }
      if (error.message === 'Contraseña requerida') {
        return 'password_required';
      }
      if (error.message === 'Usuario no encontrado' || error.message.includes('Invalid login credentials')) {
        // If user not found by DNI search, ask to register
        return 'register';
      }
      toast.error(error.message || 'Error al iniciar sesión.');
      console.error(error);
      return false;
    }
  };

  const handleRegister = async (newUser: User) => {
    try {
      const registeredUser = await mockApi.register(newUser);
      setCurrentUser(registeredUser);
      toast.success('¡Registro exitoso!');
    } catch (error: any) {
      const errorMessage = error?.message || 'Error desconocido';
      console.error('Registration Error:', error);
      toast.error(`Error en el registro: ${errorMessage}`);
    }
  };

  const handleRecoverPassword = async (email: string) => {
    await mockApi.recoverPassword(email);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('portal');
    navigate('/');
    toast('Sesión cerrada.');
  };

  const handleUpdateProfile = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    setCurrentView('portal');
  };

  // Main render logic based on routes
  return (
    <div className="min-h-screen bg-[#F7F7F7] text-[#333333] font-sans">
      <Toaster position="top-center" reverseOrder={false} toastOptions={{
        style: {
          background: '#333',
          color: '#fff',
          fontFamily: '"Noto Sans", sans-serif'
        }
      }} />
      <div className="print:hidden">
        <Header
          user={currentUser}
          onLogout={currentUser ? handleLogout : undefined}
          onProfileClick={() => setCurrentView('profile')}
          onLogoClick={() => {
            setCurrentView('portal');
            navigate('/');
          }}
        />
      </div>
      <main className="sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {currentView === 'profile' && currentUser ? (
          <UserProfile user={currentUser} onUpdate={handleUpdateProfile} onCancel={() => setCurrentView('portal')} />
        ) : (
          <Routes>
            {/* Home Route - Lists events or redirects based on role */}
            <Route path="/" element={
              !currentUser ? (
                <Login onLogin={handleLogin} onRegister={handleRegister} onRecoverPassword={handleRecoverPassword} />
              ) : currentUser.role === 'superadmin' || currentUser.role === 'admin' ? (
                <AdminDashboard user={currentUser} onLogout={handleLogout} />
              ) : currentUser.role === 'coordinator' ? (
                <CoordinatorDashboard user={currentUser} onLogout={handleLogout} />
              ) : (
                // If regular volunteer at root, maybe show a list of events to choose from?
                // For now, let's redirect to a default event or show a selection screen.
                // Since we don't have a "Select Event" screen yet, let's default to event_1
                <Navigate to="/feriadellibrobuenosaires2026" replace />
              )
            } />

            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Dynamic Event Route */}
            <Route path="/:eventSlug" element={
              <EventPortalWrapper
                user={currentUser}
                onLogout={handleLogout}
                onLogin={handleLogin}
                onRegister={handleRegister}
                onRecoverPassword={handleRecoverPassword}
              />
            } />
          </Routes>
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;