import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Smartphone, Users, BarChart2, Monitor, Contact, Share2, ArrowLeft, DownloadCloud, Layout, HelpCircle } from 'lucide-react';
import { supabaseApi as mockApi } from '../services/supabaseApiService';
import type { Event } from '../types';

const EventMonitor: React.FC = () => {
    const { eventSlug } = useParams<{ eventSlug: string }>();
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

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

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: `Monitor - ${event?.nombre}`,
                url: window.location.href
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert('Enlace copiado al portapapeles');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F3F3F3] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#8CB83E]"></div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-[#F3F3F3] flex items-center justify-center p-6 text-center">
                <div>
                    <h2 className="text-2xl font-bold text-[#282829] mb-2">Evento no encontrado</h2>
                    <p className="text-[#575757]">La URL ingresada no es válida.</p>
                </div>
            </div>
        );
    }

    const apps = [
        {
            id: 'asistencia',
            name: 'Coordinador',
            subName: 'Asistencia',
            icon: Users,
            color: 'bg-[#8CB83E]',
            shadow: 'shadow-[#8CB83E]/20',
            path: `/${eventSlug}/asistencia`
        },
        {
            id: 'metrics',
            name: 'Métricas',
            subName: 'del Stand',
            icon: BarChart2,
            color: 'bg-[#005994]',
            shadow: 'shadow-[#005994]/20',
            path: `/${eventSlug}/stand-metrics`
        },
        {
            id: 'pc-monitor',
            name: 'Monitor PC',
            subName: 'Estado Stand',
            icon: Monitor,
            color: 'bg-[#558b2f]',
            shadow: 'shadow-[#558b2f]/20',
            path: `/${eventSlug}/stand-monitor`
        },
        {
            id: 'credenciales',
            name: 'Credenciales',
            subName: 'Impresión',
            icon: Contact,
            color: 'bg-[#004a7c]',
            shadow: 'shadow-[#004a7c]/20',
            path: `/${eventSlug}/credenciales`
        },
        {
            id: 'registro',
            name: 'Registro',
            subName: 'Experiencia',
            icon: Layout,
            color: 'bg-orange-500',
            shadow: 'shadow-orange-500/20',
            path: `/${eventSlug}/registro`
        },
        {
            id: 'extension',
            name: 'Extensión',
            subName: 'Modo Kiosko',
            icon: DownloadCloud,
            color: 'bg-slate-600',
            shadow: 'shadow-slate-600/20',
            path: 'https://laconeo.github.io/voluntarios/#/pc-setup',
            isExternal: true
        },
        {
            id: 'ayuda',
            name: 'Ayuda',
            subName: 'Activación / Recuperación de cuentas',
            icon: HelpCircle,
            color: 'bg-teal-600',
            shadow: 'shadow-teal-600/20',
            path: 'https://laconeo.github.io/centro-virtual/',
            isExternal: true
        }
    ];

    return (
        <div className="min-h-screen bg-[#F3F3F3] text-[#282829] font-sans overflow-hidden flex flex-col">
            {/* Header */}
            <header className="pt-6 pb-4 px-6 flex justify-between items-start">
                <div>
                    <h1 className="text-lg font-bold text-gray-900 leading-tight">Monitor del Evento</h1>
                    <p className="text-[#8CB83E] font-bold mt-1 uppercase text-xs tracking-widest">{event.nombre}</p>
                </div>
                <button 
                    onClick={handleShare}
                    className="p-3 bg-white hover:bg-gray-50 rounded-2xl transition-colors shadow-sm border border-gray-200"
                >
                    <Share2 size={20} className="text-[#005994]" />
                </button>
            </header>

            {/* App Grid */}
            <main className="flex-1 px-6 py-4">
                <div className="grid grid-cols-2 gap-6">
                    {apps.map((app) => (
                        <button
                            key={app.id}
                            onClick={() => {
                                if (app.isExternal) {
                                    window.open(app.path, '_blank');
                                } else {
                                    window.open(`${window.location.origin}${window.location.pathname.split('#')[0]}#${app.path}`, '_blank');
                                }
                            }}
                            className="flex flex-col items-center group"
                        >
                            <div className={`${app.color} ${app.shadow} w-20 h-20 rounded-[24px] flex items-center justify-center mb-3 shadow-lg transform transition-all group-hover:scale-105 active:scale-95 group-active:brightness-90`}>
                                <app.icon size={36} className="text-white" strokeWidth={2.5} />
                            </div>
                            <span className="text-[14px] font-bold text-[#282829] text-center leading-tight">{app.name}</span>
                            <span className="text-[11px] text-[#575757] text-center leading-tight mt-0.5">{app.subName}</span>
                        </button>
                    ))}
                </div>
            </main>

            {/* Bottom Bar Mockup */}
            <div className="p-8 flex justify-center">
                <div className="w-32 h-1.5 bg-gray-300 rounded-full"></div>
            </div>

            {/* Decorative background elements - Subtler for FS branding */}
            <div className="absolute top-[-5%] right-[-10%] w-[60%] h-[40%] bg-[#8CB83E]/5 blur-[80px] rounded-full -z-10"></div>
            <div className="absolute bottom-[-5%] left-[-10%] w-[60%] h-[40%] bg-[#005994]/5 blur-[80px] rounded-full -z-10"></div>
        </div>
    );
};

export default EventMonitor;
