import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import type { User, Event } from './types';
import { mockApi } from './services/mockApiService';
import VolunteerPortal from './components/VolunteerPortal';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import Header from './components/Header';
import UserProfile from './components/UserProfile';
import { Toaster, toast } from 'react-hot-toast';

// Wrapper component to handle event slug logic
const EventPortalWrapper: React.FC<{
  user: User | null,
  onLogout: () => void,
  onLogin: (id: string) => void,
  onRegister: (u: User) => void
}> = ({ user, onLogout, onLogin, onRegister }) => {
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

  if (!user) {
    return <Login onLogin={onLogin} onRegister={onRegister} />;
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

  const handleLogin = async (identifier: string, password?: string) => {
    try {
      const user = await mockApi.login(identifier, password);
      if (user) {
        setCurrentUser(user);
        toast.success(`Bienvenido/a ${user.fullName.split(' ')[0]}!`);

        // Redirigir a home para admin y superadmin
        if (user.role === 'admin' || user.role === 'superadmin') {
          navigate('/');
        }
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
    } catch (error: any) {
      toast.error(error.message || 'Error al iniciar sesión.');
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
      <Header
        user={currentUser}
        onLogout={currentUser ? handleLogout : undefined}
        onProfileClick={() => setCurrentView('profile')}
        onLogoClick={() => {
          setCurrentView('portal');
          navigate('/');
        }}
      />
      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {currentView === 'profile' && currentUser ? (
          <UserProfile user={currentUser} onUpdate={handleUpdateProfile} onCancel={() => setCurrentView('portal')} />
        ) : (
          <Routes>
            {/* Home Route - Lists events or redirects based on role */}
            <Route path="/" element={
              !currentUser ? (
                <Login onLogin={handleLogin} onRegister={handleRegister} />
              ) : currentUser.role === 'superadmin' || currentUser.role === 'admin' ? (
                <AdminDashboard user={currentUser} onLogout={handleLogout} />
              ) : (
                // If regular volunteer at root, maybe show a list of events to choose from?
                // For now, let's redirect to a default event or show a selection screen.
                // Since we don't have a "Select Event" screen yet, let's default to event_1
                <Navigate to="/feriadellibrobuenosaires" replace />
              )
            } />

            {/* Dynamic Event Route */}
            <Route path="/:eventSlug" element={
              <EventPortalWrapper
                user={currentUser}
                onLogout={handleLogout}
                onLogin={handleLogin}
                onRegister={handleRegister}
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
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;