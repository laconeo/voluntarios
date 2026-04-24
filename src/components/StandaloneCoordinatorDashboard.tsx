import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabaseApi as mockApi } from '../services/supabaseApiService';
import CoordinatorDashboard from './CoordinatorDashboard';
import type { Event, User } from '../types';

const StandaloneCoordinatorDashboard: React.FC = () => {
    const { eventSlug } = useParams<{ eventSlug: string }>();
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);

    // Guest user for shareable view
    const guestUser: User = {
        id: 'guest_monitor',
        fullName: 'Monitor de Evento',
        email: 'monitor@familysearch.org',
        dni: '0',
        phone: '',
        tshirtSize: 'M',
        isMember: false,
        attendedPrevious: false,
        isOver18: true,
        howTheyHeard: '',
        role: 'admin', // Give admin role so it can see everything
        status: 'active',
        createdAt: new Date().toISOString()
    };

    useEffect(() => {
        const fetchEvent = async () => {
            if (eventSlug) {
                const found = await mockApi.getEventBySlug(eventSlug);
                setEvent(found);
            }
            setLoading(false);
        };
        fetchEvent();
    }, [eventSlug]);

    if (loading) return <div className="p-8 text-center">Cargando dashboard de coordinador...</div>;
    if (!event) return <div className="p-8 text-center text-red-600">Evento no encontrado</div>;

    return (
        <CoordinatorDashboard 
            user={guestUser} 
            globalEventId={event.id} 
            onClose={() => window.close()} 
        />
    );
};

export default StandaloneCoordinatorDashboard;
