import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabaseApi as mockApi } from '../services/supabaseApiService';
import VolunteerBadges from './VolunteerBadges';
import type { Event } from '../types';

const StandaloneVolunteerBadges: React.FC = () => {
    const { eventSlug } = useParams<{ eventSlug: string }>();
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);

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

    if (loading) return <div className="p-8 text-center">Cargando credenciales...</div>;
    if (!event) return <div className="p-8 text-center text-red-600">Evento no encontrado</div>;

    return (
        <VolunteerBadges 
            eventId={event.id} 
            onClose={() => window.close()} 
        />
    );
};

export default StandaloneVolunteerBadges;
