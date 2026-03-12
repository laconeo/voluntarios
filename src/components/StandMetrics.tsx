import React, { useEffect, useRef, useState, useCallback } from 'react';
import { experienceService, type StationStats } from '../services/experienceService';
import { supabase } from '../lib/supabaseClient';
import { Monitor, Users, Zap, Clock, TrendingUp, RefreshCw, AlertTriangle, Activity } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// StandMetrics — Dashboard unificado de rendimiento del stand
// Incluye: PCs (bitacora_uso) + Puestos de experiencia (experience_logs)
// Desglose por día + totalizadores + filtro de período
// Estilo FamilySearch
// ─────────────────────────────────────────────────────────────────────────────

interface StandMetricsProps {
    eventId: string;
    eventName: string;
}

interface DayRow {
    date: string; // 'YYYY-MM-DD'
    label: string;
    pcSessions: number;
    pcPersonas: number;
    pcExtensiones: number;
    expSessions: number;
    expPersonas: number;
}

interface Totals {
    pcSessions: number;
    pcPersonas: number;
    pcExtensiones: number;
    expSessions: number;
    expPersonas: number;
}

interface MetricsState {
    days: DayRow[];
    totals: Totals;
    stationStats: StationStats[];
    loadedAt: Date;
}

// ── Tiempo muerto ─────────────────────────────────────────────────────────────
interface DeadTimeEntry {
    id: string;
    name: string;
    type: 'station' | 'pc';
    lastActivityAt: Date | null;  // null = nunca hubo actividad
    isActiveNow?: boolean;         // PC en sesión en curso
}

// Formatea elapsed en formato humanizado
const formatElapsed = (ms: number): string => {
    if (ms < 60_000) return 'Ahora mismo';
    const mins = Math.floor(ms / 60_000);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}min` : `${hrs}h`;
};

// Color y semáforo según minutos de inactividad
const urgency = (ms: number | null): { color: string; bg: string; border: string; dot: string; label: string } => {
    if (ms === null) return { color: '#aaa', bg: '#f5f5f5', border: '#ddd', dot: '#ccc', label: 'Sin datos' };
    const mins = ms / 60_000;
    if (mins < 10) return { color: '#006838', bg: '#f0faf4', border: '#a0d8b0', dot: '#00a94f', label: 'Activo' };
    if (mins < 30) return { color: '#92400e', bg: '#fffbeb', border: '#fcd34d', dot: '#f59e0b', label: 'Moderado' };
    if (mins < 60) return { color: '#9a3412', bg: '#fff7ed', border: '#fdba74', dot: '#f97316', label: 'Inactivo' };
    return { color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444', label: 'Sin actividad' };
};

const PERIODS = [
    { label: 'Hoy', value: 'today' },
    { label: '7 días', value: 'week' },
    { label: 'Todo el evento', value: 'all' },
] as const;
type Period = typeof PERIODS[number]['value'];

const FS_GREEN = '#00a94f';
const FS_DARK = '#006838';
const FS_BLUE = '#005994';
const FS_BORDER = '#d9d9d9';

const sinceForPeriod = (p: Period): Date | undefined => {
    if (p === 'all') return undefined;
    const d = new Date();
    if (p === 'today') d.setHours(0, 0, 0, 0);
    if (p === 'week') { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); }
    return d;
};

const dayLabel = (dateStr: string): string => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
};

// Extrae 'YYYY-MM-DD' en la zona horaria LOCAL del navegador (no UTC)
// Esto es crítico para Argentina (UTC-3): una sesión a las 23:00 local no
// debe aparecer como el día siguiente al convertir a UTC.
const toLocalDateStr = (dateInput: string | Date): string => {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    // Usamos el offset local para compensar la diferencia con UTC
    const offsetMs = d.getTimezoneOffset() * 60_000;
    const localDate = new Date(d.getTime() - offsetMs);
    return localDate.toISOString().split('T')[0];
};

const StandMetrics: React.FC<StandMetricsProps> = ({ eventId, eventName }) => {
    const [period, setPeriod] = useState<Period>('today');
    const [data, setData] = useState<MetricsState | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // ── Tiempo muerto ──────────────────────────────────────────────────────
    const [deadTime, setDeadTime] = useState<DeadTimeEntry[]>([]);
    const [tick, setTick] = useState(0); // fuerza re-render cada 30s
    const deadTimeRef = useRef<DeadTimeEntry[]>([]);

    const fetchDeadTime = useCallback(async () => {
        try {
            // 1. Puestos: última actividad por station_id
            const stations = await experienceService.getStations(eventId);
            const stationEntries: DeadTimeEntry[] = await Promise.all(
                stations.map(async (st) => {
                    const { data: rows } = await supabase
                        .from('experience_logs')
                        .select('created_at')
                        .eq('station_id', st.id)
                        .order('created_at', { ascending: false })
                        .limit(1);
                    const last = rows?.[0]?.created_at ? new Date(rows[0].created_at) : null;
                    return { id: st.id, name: st.nombre, type: 'station', lastActivityAt: last };
                })
            );

            // 2. PCs: estado actual + última sesión completada
            const [{ data: pcStatus }, { data: bitacora }] = await Promise.all([
                supabase.from('pcs_status').select('id,estado').eq('evento_id', eventId),
                supabase.from('bitacora_uso').select('pc_id,created_at').eq('evento_id', eventId).order('created_at', { ascending: false }),
            ]);

            // Mapa pc_id → última sesión completada
            const lastPcActivity = new Map<number, Date>();
            for (const row of bitacora || []) {
                if (!lastPcActivity.has(row.pc_id)) {
                    lastPcActivity.set(row.pc_id, new Date(row.created_at));
                }
            }

            const pcEntries: DeadTimeEntry[] = (pcStatus || []).map((pc: any) => ({
                id: String(pc.id),
                name: `PC ${pc.id}`,
                type: 'pc' as const,
                isActiveNow: pc.estado === 'ocupada',
                lastActivityAt: lastPcActivity.get(pc.id) ?? null,
            })).sort((a, b) => Number(a.id) - Number(b.id));

            const merged = [...stationEntries, ...pcEntries];
            deadTimeRef.current = merged;
            setDeadTime(merged);
        } catch (e) {
            console.error('[DeadTime] Error:', e);
        }
    }, [eventId]);

    // Montaje: cargar y actualizar cada 60s
    useEffect(() => {
        fetchDeadTime();
        const dtInterval = setInterval(fetchDeadTime, 60_000);
        // Tick visual cada 30s para re-render del elapsed
        const tickInterval = setInterval(() => setTick(t => t + 1), 30_000);
        return () => { clearInterval(dtInterval); clearInterval(tickInterval); };
    }, [fetchDeadTime]);

    const load = useCallback(async () => {
        const since = sinceForPeriod(period);

        console.log('[StandMetrics] load() → period:', period, '| since:', since?.toISOString() ?? 'SIN FILTRO (todo el evento)');
        console.log('[StandMetrics] eventId:', eventId);

        // ── Experiencias ─────────────────────────────────────────────────
        const expLogs = await experienceService.getLogsForEvent(eventId, since);
        const stationStats = await experienceService.getStatsForEvent(eventId, since);

        console.log('[StandMetrics] expLogs recibidos:', expLogs.length, '| fechas únicas:', [...new Set(expLogs.map(l => toLocalDateStr(l.createdAt)))].sort());

        // ── PCs (bitacora_uso) — paginado para superar el límite de 1000 filas ─
        const PC_PAGE_SIZE = 1000;
        let pcLogs: any[] = [];
        let pcFrom = 0;
        while (true) {
            let pcQ = supabase
                .from('bitacora_uso')
                .select('pc_id, duracion_total, acciones_reportadas, created_at')
                .eq('evento_id', eventId)
                .order('created_at', { ascending: true })
                .range(pcFrom, pcFrom + PC_PAGE_SIZE - 1);
            if (since) pcQ = pcQ.gte('created_at', since.toISOString());
            const { data: pcPage, error: pcError } = await pcQ;
            if (pcError) { console.error('[StandMetrics] PC query error:', pcError); break; }
            if (!pcPage || pcPage.length === 0) break;
            pcLogs = [...pcLogs, ...pcPage];
            if (pcPage.length < PC_PAGE_SIZE) break;
            pcFrom += PC_PAGE_SIZE;
        }
        console.log('[StandMetrics] pcLogs recibidos (paginado):', pcLogs.length);

        // ── Unificar por día ─────────────────────────────────────────────
        const dayMap = new Map<string, DayRow>();

        const getOrCreate = (dateStr: string): DayRow => {
            if (!dayMap.has(dateStr)) {
                dayMap.set(dateStr, {
                    date: dateStr,
                    label: dayLabel(dateStr),
                    pcSessions: 0, pcPersonas: 0, pcExtensiones: 0,
                    expSessions: 0, expPersonas: 0,
                });
            }
            return dayMap.get(dateStr)!;
        };

        for (const pc of pcLogs) {
            const d = toLocalDateStr(pc.created_at);
            const row = getOrCreate(d);
            row.pcSessions++;
            row.pcPersonas += Number(pc.acciones_reportadas?.people_helped) || 0;
            row.pcExtensiones += Number(pc.acciones_reportadas?.extensions) || 0;
        }

        for (const ex of expLogs) {
            const d = toLocalDateStr(ex.createdAt);
            const row = getOrCreate(d);
            row.expSessions++;
            row.expPersonas += ex.cantidadPersonas;
        }

        const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

        const totals: Totals = days.reduce(
            (acc, r) => ({
                pcSessions: acc.pcSessions + r.pcSessions,
                pcPersonas: acc.pcPersonas + r.pcPersonas,
                pcExtensiones: acc.pcExtensiones + r.pcExtensiones,
                expSessions: acc.expSessions + r.expSessions,
                expPersonas: acc.expPersonas + r.expPersonas,
            }),
            { pcSessions: 0, pcPersonas: 0, pcExtensiones: 0, expSessions: 0, expPersonas: 0 }
        );

        setData({ days, totals, stationStats, loadedAt: new Date() });
        setLoading(false);
        setRefreshing(false);
    }, [eventId, period]);

    // Auto-refresh completo cada 2 minutos
    const MAIN_REFRESH_S = 120;
    const [countdown, setCountdown] = useState(MAIN_REFRESH_S);

    useEffect(() => {
        setLoading(true);
        setData(null);
        setCountdown(MAIN_REFRESH_S);
        load();

        // Refresca datos principales cada 2 min
        const mainInterval = setInterval(() => {
            load();
            setCountdown(MAIN_REFRESH_S);
        }, MAIN_REFRESH_S * 1000);

        // Countdown visual cada segundo
        const countdownInterval = setInterval(() => {
            setCountdown(c => (c > 0 ? c - 1 : MAIN_REFRESH_S));
        }, 1000);

        return () => {
            clearInterval(mainInterval);
            clearInterval(countdownInterval);
        };
    }, [load]);

    const handleRefresh = () => {
        setRefreshing(true);
        setCountdown(MAIN_REFRESH_S);
        fetchDeadTime();
        load();
    };

    const totalPersonas = (data?.totals.pcPersonas ?? 0) + (data?.totals.expPersonas ?? 0);
    const totalSessions = (data?.totals.pcSessions ?? 0) + (data?.totals.expSessions ?? 0);
    const maxPersonasDia = data ? Math.max(...data.days.map(d => d.pcPersonas + d.expPersonas), 1) : 1;

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
                <div style={{ width: 36, height: 36, border: `3px solid ${FS_GREEN}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* ── Encabezado ── */}
            <div style={{ background: 'white', border: `1px solid ${FS_BORDER}`, borderTop: `4px solid ${FS_GREEN}`, borderRadius: 10, padding: '20px 24px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <TrendingUp size={22} color={FS_GREEN} />
                        Métricas del Stand
                        {/* Badge EN VIVO */}
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: '#dc2626', borderRadius: 20, padding: '2px 8px', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', animation: 'pulse 1.5s infinite' }} />
                            EN VIVO
                        </span>
                    </h2>
                    <p style={{ margin: 0, color: '#666', fontSize: 14 }}>{eventName}</p>
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {data?.loadedAt && (
                            <span style={{ color: '#aaa', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} /> Actualizado: {data.loadedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        )}
                        {/* Countdown próxima actualización */}
                        <span style={{
                            fontSize: 12,
                            color: countdown <= 15 ? '#dc2626' : '#888',
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontWeight: countdown <= 15 ? 700 : 400,
                            transition: 'color 0.3s',
                        }}>
                            <RefreshCw size={11} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
                            Próximo refresh en {countdown}s
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Selector de período */}
                    <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 8, padding: 3, gap: 2 }}>
                        {PERIODS.map(p => (
                            <button
                                key={p.value}
                                onClick={() => setPeriod(p.value)}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: 6,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    background: period === p.value ? 'white' : 'transparent',
                                    color: period === p.value ? FS_DARK : '#777',
                                    boxShadow: period === p.value ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${FS_BORDER}`, background: 'white', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center' }}
                    >
                        <RefreshCw size={15} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
                    </button>
                </div>
            </div>

            {/* ── Totalizadores ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
                <StatCard icon={<Users size={20} color={FS_GREEN} />} bg="#f0faf4" border="#b0e0c0" label="Personas atendidas" value={totalPersonas} sub="en total" valColor={FS_DARK} />
                <StatCard icon={<Zap size={20} color={FS_BLUE} />} bg="#f0f6fc" border="#b0d0e8" label="Experiencias totales" value={totalSessions} sub="registradas" valColor={FS_BLUE} />
                <StatCard icon={<Monitor size={20} color="#7c3aed" />} bg="#f5f0ff" border="#d0b8f5" label="Sesiones PC" value={data?.totals.pcSessions ?? 0} sub={`${data?.totals.pcExtensiones ?? 0} extensiones`} valColor="#7c3aed" />
                <StatCard icon={<Users size={20} color="#0891b2" />} bg="#f0f9fc" border="#b0dde8" label="Personas vía puestos" value={data?.totals.expPersonas ?? 0} sub={`${data?.totals.expSessions ?? 0} experiencias`} valColor="#0891b2" />
            </div>

            {/* ── Tiempo muerto en tiempo real ── */}
            {deadTime.length > 0 && (
                <Section
                    title="Tiempo muerto — estado en tiempo real"
                    icon={<Activity size={18} color="#dc2626" />}
                    badge={
                        <span style={{ fontSize: 11, color: '#888', fontWeight: 400, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00a94f', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                            En vivo · actualiza cada 60s
                        </span>
                    }
                >
                    <style>{`
                        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
                        @keyframes spin  { to { transform: rotate(360deg); } }
                    `}</style>

                    {/* Puestos de experiencia */}
                    {deadTime.filter(e => e.type === 'station').length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                                Puestos de experiencia
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {deadTime.filter(e => e.type === 'station').map(entry => {
                                    const now = Date.now();
                                    const elapsedMs = entry.lastActivityAt ? now - entry.lastActivityAt.getTime() : null;
                                    const u = urgency(elapsedMs);
                                    return (
                                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: u.bg, border: `1px solid ${u.border}`, borderRadius: 8, padding: '10px 14px', flexWrap: 'wrap', gap: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: u.dot, flexShrink: 0, boxShadow: `0 0 6px ${u.dot}66` }} />
                                                <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>{entry.name}</span>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                {entry.lastActivityAt ? (
                                                    <>
                                                        <span style={{ fontSize: 18, fontWeight: 800, color: u.color }}>
                                                            {elapsedMs !== null ? formatElapsed(elapsedMs) : '—'}
                                                        </span>
                                                        <span style={{ fontSize: 11, color: '#888', display: 'block' }}>
                                                            Último: {entry.lastActivityAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span style={{ fontSize: 13, color: '#aaa', fontStyle: 'italic' }}>Sin actividad registrada</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Computadoras */}
                    {deadTime.filter(e => e.type === 'pc').length > 0 && (
                        <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                                Computadoras
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                                {deadTime.filter(e => e.type === 'pc').map(entry => {
                                    const now = Date.now();
                                    const elapsedMs = entry.isActiveNow
                                        ? 0
                                        : entry.lastActivityAt ? now - entry.lastActivityAt.getTime() : null;
                                    const u = entry.isActiveNow
                                        ? { color: '#1e40af', bg: '#eff6ff', border: '#93c5fd', dot: '#3b82f6', label: 'En uso' }
                                        : urgency(elapsedMs);
                                    return (
                                        <div key={entry.id} style={{ background: u.bg, border: `1px solid ${u.border}`, borderRadius: 8, padding: '10px 12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.dot, boxShadow: `0 0 5px ${u.dot}66` }} />
                                                <span style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a' }}>{entry.name}</span>
                                            </div>
                                            {entry.isActiveNow ? (
                                                <span style={{ fontSize: 12, color: u.color, fontWeight: 600 }}>🖥 En sesión activa</span>
                                            ) : entry.lastActivityAt ? (
                                                <>
                                                    <div style={{ fontSize: 16, fontWeight: 800, color: u.color }}>
                                                        {elapsedMs !== null ? formatElapsed(elapsedMs) : '—'}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: '#888' }}>
                                                        Última: {entry.lastActivityAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </>
                                            ) : (
                                                <span style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>Sin sesiones aún</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Leyenda */}
                    <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: '#666', borderTop: `1px solid ${FS_BORDER}`, paddingTop: 12 }}>
                        {[
                            { dot: '#3b82f6', label: 'En uso (PC)' },
                            { dot: '#00a94f', label: '< 10 min — Activo' },
                            { dot: '#f59e0b', label: '10-30 min — Moderado' },
                            { dot: '#f97316', label: '30-60 min — Inactivo' },
                            { dot: '#ef4444', label: '> 60 min — Sin actividad' },
                        ].map(l => (
                            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.dot }} />
                                {l.label}
                            </span>
                        ))}
                    </div>
                </Section>
            )}

            {/* ── Evolución diaria ── */}
            <Section title="Evolución por día" icon={<TrendingUp size={18} color={FS_GREEN} />}>
                {!data?.days.length ? (
                    <Empty text="Sin datos para el período seleccionado." />
                ) : (
                    <>
                        {/* Barras visuales */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                            {data.days.map(row => {
                                const total = row.pcPersonas + row.expPersonas;
                                const pct = maxPersonasDia > 0 ? (total / maxPersonasDia) * 100 : 0;
                                const pcPct = total > 0 ? (row.pcPersonas / total) * 100 : 0;
                                return (
                                    <div key={row.date}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: '#333', textTransform: 'capitalize' }}>{row.label}</span>
                                            <span style={{ fontSize: 13, color: '#555' }}>
                                                <strong style={{ color: FS_DARK }}>{total}</strong> personas
                                                <span style={{ color: '#aaa', marginLeft: 8 }}>({row.pcSessions + row.expSessions} exp.)</span>
                                            </span>
                                        </div>
                                        <div style={{ height: 18, background: '#eee', borderRadius: 9, overflow: 'hidden', display: 'flex' }}>
                                            <div style={{ width: `${pct * pcPct / 100}%`, background: '#7c3aed', transition: 'width 0.4s' }} title={`PCs: ${row.pcPersonas}`} />
                                            <div style={{ width: `${pct * (100 - pcPct) / 100}%`, background: FS_GREEN, transition: 'width 0.4s' }} title={`Puestos: ${row.expPersonas}`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Leyenda */}
                        <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#666', marginBottom: 20 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: '#7c3aed' }} /> Computadoras</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: FS_GREEN }} /> Puestos de experiencia</span>
                        </div>

                        {/* Tabla detallada */}
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f5f5f5', color: '#555' }}>
                                        <Th>Fecha</Th>
                                        <Th align="right">Ses. PC</Th>
                                        <Th align="right">Pers. PC</Th>
                                        <Th align="right">Ext.</Th>
                                        <Th align="right">Exp. Puestos</Th>
                                        <Th align="right">Pers. Puestos</Th>
                                        <Th align="right" style={{ fontWeight: 700, color: FS_DARK }}>Total personas</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.days.map((row, i) => (
                                        <tr key={row.date} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: `1px solid ${FS_BORDER}` }}>
                                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#333', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{row.label}</td>
                                            <Td>{row.pcSessions}</Td>
                                            <Td>{row.pcPersonas}</Td>
                                            <Td color="#a16207">{row.pcExtensiones}</Td>
                                            <Td>{row.expSessions}</Td>
                                            <Td>{row.expPersonas}</Td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: FS_DARK, fontSize: 15 }}>
                                                {row.pcPersonas + row.expPersonas}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: '#f0faf4', borderTop: `2px solid ${FS_GREEN}` }}>
                                        <td style={{ padding: '10px 12px', fontWeight: 700, color: FS_DARK, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</td>
                                        <Td bold>{data.totals.pcSessions}</Td>
                                        <Td bold>{data.totals.pcPersonas}</Td>
                                        <Td bold color="#a16207">{data.totals.pcExtensiones}</Td>
                                        <Td bold>{data.totals.expSessions}</Td>
                                        <Td bold>{data.totals.expPersonas}</Td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: FS_DARK, fontSize: 18 }}>
                                            {data.totals.pcPersonas + data.totals.expPersonas}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </>
                )}
            </Section>

            {/* ── Detalle por puesto de experiencia ── */}
            <Section title="Desglose por puesto de experiencia" icon={<Zap size={18} color={FS_BLUE} />}>
                {!data?.stationStats.length ? (
                    <Empty text="Sin registros de experiencias en el período." />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f5f5f5' }}>
                                    <Th>Puesto</Th>
                                    <Th align="right">Experiencias</Th>
                                    <Th align="right">Personas atendidas</Th>
                                    <Th align="right">Promedio</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.stationStats.map((st, i) => (
                                    <tr key={st.stationId} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: `1px solid ${FS_BORDER}` }}>
                                        <td style={{ padding: '9px 12px', fontWeight: 600, color: '#333' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: FS_GREEN, flexShrink: 0 }} />
                                                {st.stationNombre}
                                            </span>
                                        </td>
                                        <Td>{st.totalExperiencias}</Td>
                                        <Td>{st.totalPersonas}</Td>
                                        <Td color="#555">{st.totalExperiencias > 0 ? (st.totalPersonas / st.totalExperiencias).toFixed(1) : '—'}</Td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: '#f0f6ff', borderTop: `2px solid ${FS_BLUE}` }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 700, color: FS_BLUE, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</td>
                                    <Td bold>{data.totals.expSessions}</Td>
                                    <Td bold>{data.totals.expPersonas}</Td>
                                    <Td bold color="#555">{data.totals.expSessions > 0 ? (data.totals.expPersonas / data.totals.expSessions).toFixed(1) : '—'}</Td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </Section>

            {/* ── Detalle PCs ── */}
            <Section title="Computadoras — resumen del período" icon={<Monitor size={18} color="#7c3aed" />}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <MiniStat label="Sesiones" value={data?.totals.pcSessions ?? 0} color="#7c3aed" />
                    <MiniStat label="Personas ayudadas" value={data?.totals.pcPersonas ?? 0} color={FS_BLUE} />
                    <MiniStat label="Extensiones de tiempo" value={data?.totals.pcExtensiones ?? 0} color="#d97706" />
                    <MiniStat label="Minutos extra" value={(data?.totals.pcExtensiones ?? 0) * 5} color="#d97706" />
                </div>
            </Section>
        </div>
    );
};

// ── Sub-componentes ─────────────────────────────────────────────────────────

const StatCard = ({ icon, bg, border, label, value, sub, valColor }: {
    icon: React.ReactNode; bg: string; border: string;
    label: string; value: number; sub?: string; valColor?: string;
}) => (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ background: 'white', borderRadius: 10, padding: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>{icon}</div>
        <div>
            <p style={{ fontSize: 28, fontWeight: 800, color: valColor || '#1a1a1a', margin: 0 }}>{value.toLocaleString()}</p>
            <p style={{ fontSize: 12, color: '#555', margin: '2px 0 0', fontWeight: 600 }}>{label}</p>
            {sub && <p style={{ fontSize: 11, color: '#888', margin: '1px 0 0' }}>{sub}</p>}
        </div>
    </div>
);

const MiniStat = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div style={{ background: 'white', border: `1px solid ${FS_BORDER}`, borderTop: `3px solid ${color}`, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
        <p style={{ fontSize: 26, fontWeight: 800, color, margin: 0 }}>{value.toLocaleString()}</p>
        <p style={{ fontSize: 12, color: '#666', margin: '3px 0 0' }}>{label}</p>
    </div>
);

const Section = ({ title, icon, badge, children }: { title: string; icon: React.ReactNode; badge?: React.ReactNode; children: React.ReactNode }) => (
    <div style={{ background: 'white', border: `1px solid ${FS_BORDER}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: `1px solid ${FS_BORDER}`, background: '#fafafa', flexWrap: 'wrap' }}>
            {icon}
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1a1a1a', flex: 1 }}>{title}</h3>
            {badge && <div>{badge}</div>}
        </div>
        <div style={{ padding: 20 }}>{children}</div>
    </div>
);

const Th = ({ children, align = 'left', style: extraStyle }: { children: React.ReactNode; align?: 'left' | 'right'; style?: React.CSSProperties }) => (
    <th style={{ padding: '8px 12px', textAlign: align, fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', ...extraStyle }}>{children}</th>
);

const Td = ({ children, align = 'right', color, bold }: { children: React.ReactNode; align?: string; color?: string; bold?: boolean }) => (
    <td style={{ padding: '8px 12px', textAlign: 'right' as const, color: color || '#444', fontWeight: bold ? 700 : 400 }}>{children}</td>
);

const Empty = ({ text }: { text: string }) => (
    <div style={{ padding: '32px 0', textAlign: 'center', color: '#aaa', fontSize: 14 }}>{text}</div>
);

export default StandMetrics;
