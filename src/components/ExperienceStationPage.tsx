import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { experienceService, type ExperienceStation, type ExperienceLog } from '../services/experienceService';
import { supabaseApi } from '../services/supabaseApiService';
import { CheckCircle, Users, Clock, ChevronDown, ChevronLeft } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// ExperienceStationPage — Página de registro para el voluntario desde el celular
// Estilo FamilySearch
// Rutas:
//   /:eventSlug/registro            → elige puesto
//   /:eventSlug/registro/:stationId → registro directo
// ─────────────────────────────────────────────────────────────────────────────

const FS_GREEN = '#00a94f';
const FS_DARK = '#006838';
const FS_BLUE = '#005994';
const FS_BORDER = '#d9d9d9';
const FS_BG = '#f5f5f5';

const ExperienceStationPage: React.FC = () => {
    const { eventSlug, stationId } = useParams<{ eventSlug: string; stationId?: string }>();

    const [eventName, setEventName] = useState('');
    const [eventoId, setEventoId] = useState('');
    const [stations, setStations] = useState<ExperienceStation[]>([]);
    const [selectedStation, setSelectedStation] = useState<ExperienceStation | null>(null);
    const [todayLogs, setTodayLogs] = useState<ExperienceLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);
    const [lastRegistered, setLastRegistered] = useState<number | null>(null);
    const [showRecent, setShowRecent] = useState(false);

    const todayExp = todayLogs.length;
    const todayPersonas = todayLogs.reduce((s, l) => s + l.cantidadPersonas, 0);

    const todayStart = () => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    };

    useEffect(() => {
        const init = async () => {
            if (!eventSlug) return;
            try {
                const ev = await supabaseApi.getEventBySlug(eventSlug);
                if (!ev) { setLoading(false); return; }
                setEventName(ev.nombre);
                setEventoId(ev.id);

                const sts = await experienceService.getStations(ev.id);
                setStations(sts);

                if (stationId) {
                    const st = sts.find(s => s.id === stationId)
                        ?? await experienceService.getStationById(stationId);
                    if (st) {
                        setSelectedStation(st);
                        const logs = await experienceService.getLogsForStation(st.id, todayStart());
                        setTodayLogs(logs);
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [eventSlug, stationId]);

    const handleSelectStation = async (st: ExperienceStation) => {
        setSelectedStation(st);
        setTodayLogs([]);
        setLastRegistered(null);
        const logs = await experienceService.getLogsForStation(st.id, todayStart());
        setTodayLogs(logs);
    };

    const handleRegister = async (cantidad: number) => {
        if (!selectedStation || !eventoId || registering) return;
        setRegistering(true);
        try {
            const log = await experienceService.logExperience(selectedStation.id, eventoId, cantidad);
            setTodayLogs(prev => [log, ...prev]);
            setLastRegistered(cantidad);
            setTimeout(() => setLastRegistered(null), 2500);
        } catch {
            alert('Error al registrar. Revisá la conexión a internet.');
        } finally {
            setRegistering(false);
        }
    };

    // ── Loading ───────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{ minHeight: '100dvh', background: FS_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <img src="/logo-familysearch.png" alt="FamilySearch" style={{ height: 36, marginBottom: 24, opacity: 0.6 }} onError={e => (e.currentTarget.style.display = 'none')} />
                    <div style={{ width: 40, height: 40, border: `3px solid ${FS_GREEN}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                    <p style={{ color: '#555', fontSize: 15 }}>Cargando…</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!eventName) {
        return (
            <div style={{ minHeight: '100dvh', background: FS_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ textAlign: 'center', background: 'white', borderRadius: 12, padding: 32, border: `1px solid ${FS_BORDER}`, maxWidth: 360, width: '100%' }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: '#333', marginBottom: 8 }}>Evento no encontrado</p>
                    <p style={{ color: '#666', fontSize: 14 }}>Verificá el enlace que recibiste.</p>
                </div>
            </div>
        );
    }

    // ── Selector de puesto ────────────────────────────────────────────────
    if (!selectedStation) {
        return (
            <div style={{ minHeight: '100dvh', background: FS_BG, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {/* Header FS */}
                <header style={{ background: 'white', borderBottom: `3px solid ${FS_GREEN}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src="/logo-familysearch.png" alt="FamilySearch" style={{ height: 28 }} onError={e => (e.currentTarget.style.display = 'none')} />
                    <div>
                        <p style={{ fontSize: 11, color: '#888', margin: 0 }}>Registro de experiencias</p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#333', margin: 0 }}>{eventName}</p>
                    </div>
                </header>

                <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 16px' }}>
                    <div style={{ marginBottom: 28, textAlign: 'center' }}>
                        <h1 style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px' }}>
                            ¿En qué puesto estás?
                        </h1>
                        <p style={{ color: '#666', fontSize: 15, margin: 0 }}>
                            Seleccioná tu puesto de trabajo para comenzar a registrar las experiencias.
                        </p>
                    </div>

                    {stations.length === 0 ? (
                        <div style={{ background: 'white', border: `1px solid ${FS_BORDER}`, borderRadius: 10, padding: 32, textAlign: 'center' }}>
                            <p style={{ color: '#888', margin: 0 }}>No hay puestos configurados para este evento.</p>
                            <p style={{ color: '#aaa', fontSize: 13, marginTop: 8 }}>Pedile al coordinador que los configure en el sistema.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {stations.map(st => (
                                <button
                                    key={st.id}
                                    onClick={() => handleSelectStation(st)}
                                    style={{
                                        background: 'white',
                                        border: `1px solid ${FS_BORDER}`,
                                        borderLeft: `4px solid ${FS_GREEN}`,
                                        borderRadius: 10,
                                        padding: '18px 20px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: 17,
                                        fontWeight: 600,
                                        color: '#1a1a1a',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                        transition: 'box-shadow 0.15s',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,169,79,0.15)')}
                                    onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
                                >
                                    <span>{st.nombre}</span>
                                    <span style={{ color: FS_GREEN, fontSize: 20, lineHeight: 1 }}>›</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── Página de registro ────────────────────────────────────────────────
    const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    return (
        <div style={{ minHeight: '100dvh', background: FS_BG, fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }}>
            {/* Header FS */}
            <header style={{ background: 'white', borderBottom: `3px solid ${FS_GREEN}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
                <button
                    onClick={() => { setSelectedStation(null); setTodayLogs([]); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px 4px 0', color: FS_GREEN, display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600 }}
                >
                    <ChevronLeft size={18} /> Cambiar
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: '#888', margin: 0 }}>{eventName}</p>
                </div>
                <img src="/logo-familysearch.png" alt="FS" style={{ height: 22 }} onError={e => (e.currentTarget.style.display = 'none')} />
            </header>

            <div style={{ flex: 1, maxWidth: 480, margin: '0 auto', width: '100%', padding: '24px 16px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Nombre del puesto */}
                <div style={{ background: 'white', border: `1px solid ${FS_BORDER}`, borderTop: `4px solid ${FS_GREEN}`, borderRadius: 10, padding: '20px 20px 16px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <p style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Puesto activo</p>
                    <h1 style={{ fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 700, color: '#1a1a1a', margin: '0 0 16px' }}>
                        {selectedStation.nombre}
                    </h1>

                    {/* Stats del día */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ background: '#f0faf4', border: '1px solid #b0e0c0', borderRadius: 8, padding: '12px 8px' }}>
                            <p style={{ fontSize: 28, fontWeight: 800, color: FS_DARK, margin: 0 }}>{todayExp}</p>
                            <p style={{ fontSize: 12, color: '#4a7a5a', margin: '2px 0 0' }}>experiencias hoy</p>
                        </div>
                        <div style={{ background: '#f0f6fc', border: '1px solid #b0d0e8', borderRadius: 8, padding: '12px 8px' }}>
                            <p style={{ fontSize: 28, fontWeight: 800, color: FS_BLUE, margin: 0 }}>{todayPersonas}</p>
                            <p style={{ fontSize: 12, color: '#3a6080', margin: '2px 0 0' }}>personas atendidas</p>
                        </div>
                    </div>
                </div>

                {/* Feedback de registro */}
                <div style={{
                    background: '#f0faf4',
                    border: `1px solid ${FS_GREEN}`,
                    borderRadius: 10,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'opacity 0.3s, transform 0.3s',
                    opacity: lastRegistered !== null ? 1 : 0,
                    transform: lastRegistered !== null ? 'scale(1)' : 'scale(0.96)',
                    pointerEvents: lastRegistered !== null ? 'auto' : 'none',
                }}>
                    <CheckCircle size={26} color={FS_GREEN} style={{ flexShrink: 0 }} />
                    <div>
                        <p style={{ fontWeight: 700, color: FS_DARK, fontSize: 16, margin: 0 }}>¡Registrado!</p>
                        <p style={{ color: '#4a7a5a', fontSize: 13, margin: 0 }}>
                            {lastRegistered} {lastRegistered === 1 ? 'persona anotada' : 'personas anotadas'}
                        </p>
                    </div>
                </div>

                {/* Pad numérico */}
                <div style={{ background: 'white', border: `1px solid ${FS_BORDER}`, borderRadius: 10, padding: '20px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <p style={{ textAlign: 'center', color: '#555', fontSize: 14, marginBottom: 16 }}>
                        ¿Cuántas personas atendiste en esta experiencia?
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                        {NUMBERS.map(n => (
                            <button
                                key={n}
                                onClick={() => handleRegister(n)}
                                disabled={registering}
                                style={{
                                    aspectRatio: '1',
                                    borderRadius: 10,
                                    border: `2px solid ${registering ? '#ddd' : FS_GREEN}`,
                                    background: registering ? '#f9f9f9' : 'white',
                                    color: registering ? '#aaa' : FS_DARK,
                                    fontSize: 'clamp(18px, 4vw, 24px)',
                                    fontWeight: 700,
                                    cursor: registering ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.12s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: registering ? 'none' : '0 2px 6px rgba(0,168,79,0.12)',
                                }}
                                onMouseEnter={e => { if (!registering) { e.currentTarget.style.background = FS_GREEN; e.currentTarget.style.color = 'white'; } }}
                                onMouseLeave={e => { if (!registering) { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = FS_DARK; } }}
                            >
                                {n}
                            </button>
                        ))}
                    </div>

                    {registering && (
                        <div style={{ textAlign: 'center', marginTop: 14, color: '#888', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <div style={{ width: 14, height: 14, border: `2px solid ${FS_GREEN}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            Guardando…
                        </div>
                    )}
                </div>

                {/* Historial reciente */}
                {todayLogs.length > 0 && (
                    <div style={{ background: 'white', border: `1px solid ${FS_BORDER}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        <button
                            onClick={() => setShowRecent(!showRecent)}
                            style={{ width: '100%', background: 'none', border: 'none', borderBottom: showRecent ? `1px solid ${FS_BORDER}` : 'none', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#555', fontSize: 14 }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Clock size={15} color={FS_GREEN} />
                                Últimos registros de hoy ({todayLogs.length})
                            </span>
                            <ChevronDown size={15} style={{ transform: showRecent ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>

                        {showRecent && (
                            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                                {todayLogs.slice(0, 20).map((log, i) => (
                                    <div
                                        key={log.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '10px 16px',
                                            borderBottom: i < Math.min(todayLogs.length, 20) - 1 ? `1px solid ${FS_BORDER}` : 'none',
                                            background: i % 2 === 0 ? 'white' : '#fafafa',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Users size={13} color="#aaa" />
                                            <span style={{ fontWeight: 700, fontSize: 15, color: FS_DARK }}>{log.cantidadPersonas}</span>
                                            <span style={{ color: '#888', fontSize: 13 }}>{log.cantidadPersonas === 1 ? 'persona' : 'personas'}</span>
                                        </div>
                                        <span style={{ color: '#aaa', fontSize: 12 }}>
                                            {new Date(log.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer FS */}
            <footer style={{ textAlign: 'center', padding: '16px', borderTop: `1px solid ${FS_BORDER}`, background: 'white' }}>
                <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>
                    Sistema de Gestión de Voluntarios · FamilySearch
                </p>
            </footer>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default ExperienceStationPage;
