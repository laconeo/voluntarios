import React, { useEffect, useRef, useState, useCallback } from 'react';
import { experienceService, type StationStats } from '../services/experienceService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toLocalDateStr, parseSafeDate } from '../lib/utils';
import { pcControlService } from '../services/pcControlService';
import { supabase } from '../lib/supabaseClient';
import { Monitor, Users, Zap, Clock, TrendingUp, RefreshCw, AlertTriangle, Activity, Download } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// StandMetrics — Dashboard unificado de rendimiento del stand
// Incluye: PCs (bitacora_uso) + Puestos de experiencia (experience_logs)
// Desglose por día + totalizadores + filtro de período
// Estilo FamilySearch
// ─────────────────────────────────────────────────────────────────────────────

interface StandMetricsProps {
    eventId: string;
    eventName: string;
    eventStart?: string; // YYYY-MM-DD
    eventEnd?: string;   // YYYY-MM-DD
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

interface DailyStationStats {
    day: string; // YYYY-MM-DD
    label: string;
    stats: StationStats[];
}

interface HourlyStats {
    hour: number;
    pcSessions: number;
    expSessions: number;
}

interface AttendanceStats {
    day: string; // YYYY-MM-DD
    label: string;
    total: number;
    attended: number;
    absent: number;
    pending: number;
}

interface MetricsState {
    days: DayRow[];
    totals: Totals;
    stationStats: StationStats[];
    dailyStationStats: DailyStationStats[];
    hourlyStats: HourlyStats[];
    attendanceStats: AttendanceStats[];
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

const sinceForPeriod = (p: Period, eventStart?: string): Date | undefined => {
    if (p === 'all') {
        if (eventStart) {
            const d = new Date(eventStart + 'T00:00:00');
            return isNaN(d.getTime()) ? undefined : d;
        }
        return undefined;
    }
    const d = new Date();
    if (p === 'today') d.setHours(0, 0, 0, 0);
    if (p === 'week') { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); }
    return d;
};

const dayLabel = (dateStr: string): string => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
};

// used via import from ../lib/utils

const StandMetrics: React.FC<StandMetricsProps> = ({ eventId, eventName, eventStart, eventEnd }) => {
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
        const since = sinceForPeriod(period, eventStart);
        setRefreshing(true);
        // No limpiamos 'data' inmediatamente para evitar parpadeo si ya había algo
        // Pero si es la carga inicial (loading true), sí lo dejamos en null

        try {
            console.log('[StandMetrics] load() -> period:', period, '| since:', since?.toISOString() ?? 'TODO EL EVENTO');
            
            // ── Métricas Diarias (Resumen en Servidor - RPC) ────────────────────
            // Intentamos obtener el resumen. Si falla por el tipo UUID, el service lo logueará.
            let summary: any[] = [];
            try {
                summary = await experienceService.getDailySummary(eventId, since);
            } catch (err) {
                console.error('[StandMetrics] Error en getDailySummary:', err);
                // No lanzamos el error para permitir que al menos cargue stationStats si funcionan
            }
            
            // ── Estadísticas por Puesto (Para el desglose inferior) ──────────────
            // Obtenemos los logs para agrupar por día y puesto si es necesario
            const allLogs = await experienceService.getLogsForEvent(eventId, since);
            
            // Agregación total
            const mapTotal = new Map<string, StationStats>();
            // Agregación por día
            const mapDaily = new Map<string, Map<string, StationStats>>();
            // Distribución horaria
            const hourlyMap = new Map<number, HourlyStats>();
            for (let h = 0; h < 24; h++) {
                hourlyMap.set(h, { hour: h, pcSessions: 0, expSessions: 0 });
            }

            for (const log of allLogs) {
                const logDate = parseSafeDate(log.createdAt);
                const day = toLocalDateStr(logDate);
                const hour = logDate.getHours();
                const stId = log.stationId;
                const stNombre = log.stationNombre || 'Puesto Desconocido';

                // Total
                if (!mapTotal.has(stId)) {
                    mapTotal.set(stId, { stationId: stId, stationNombre: stNombre, totalExperiencias: 0, totalPersonas: 0 });
                }
                const st = mapTotal.get(stId)!;
                st.totalExperiencias++;
                st.totalPersonas += log.cantidadPersonas;

                // Diario
                if (!mapDaily.has(day)) mapDaily.set(day, new Map());
                const dayMap = mapDaily.get(day)!;
                if (!dayMap.has(stId)) {
                    dayMap.set(stId, { stationId: stId, stationNombre: stNombre, totalExperiencias: 0, totalPersonas: 0 });
                }
                const dSt = dayMap.get(stId)!;
                dSt.totalExperiencias++;
                dSt.totalPersonas += log.cantidadPersonas;

                // Horario
                const hStat = hourlyMap.get(hour)!;
                hStat.expSessions++;
            }

            // Bitácora para sesiones de PC por hora
            const bitacora = await pcControlService.getBitacoraForEvent(eventId, since);
            for (const b of bitacora) {
                const bDate = parseSafeDate(b.created_at);
                const hour = bDate.getHours();
                const hStat = hourlyMap.get(hour)!;
                hStat.pcSessions++;
            }

            const stationStats = Array.from(mapTotal.values()).sort((a, b) => a.stationNombre.localeCompare(b.stationNombre));
            
            const dailyStationStats: DailyStationStats[] = Array.from(mapDaily.entries())
                .map(([day, dayMap]) => ({
                    day,
                    label: dayLabel(day),
                    stats: Array.from(dayMap.values()).sort((a, b) => a.stationNombre.localeCompare(b.stationNombre))
                }))
                .sort((a, b) => b.day.localeCompare(a.day)); // Descendente por fecha

            const hourlyStats = Array.from(hourlyMap.values());

            // ── Unificar datos para la UI ──
            const days: DayRow[] = (summary || [])
                .filter(row => {
                    // Filtrado estricto por fechas de evento si es "todo el evento"
                    if (period === 'all' && eventStart && eventEnd) {
                        return row.day >= eventStart && row.day <= eventEnd;
                    }
                    return true;
                })
                .map(row => ({
                    date: row.day,
                    label: dayLabel(row.day),
                    pcSessions: Number(row.pc_sessions || 0),
                    pcPersonas: Number(row.pc_personas || 0),
                    pcExtensiones: Number(row.pc_extensiones || 0),
                    expSessions: Number(row.exp_sessions || 0),
                    expPersonas: Number(row.exp_personas || 0)
                }));

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

            // ── Ausentismo (Bookings & Shifts) ──────────────────────────────────
            const { data: bookingsData } = await supabase
                .from('bookings')
                .select('attendance, status, shifts(date)')
                .eq('event_id', eventId)
                .neq('status', 'cancelled');
            
            const attendanceMap = new Map<string, AttendanceStats>();
            
            // ── Pre-llenar días según el filtro seleccionado ──
            let fillStart: Date | undefined = since;
            let fillEnd: Date | undefined;

            if (period === 'all') {
                if (eventStart && eventEnd) {
                    fillStart = new Date(eventStart + 'T00:00:00');
                    fillEnd = new Date(eventEnd + 'T00:00:00');
                }
            } else {
                fillEnd = new Date(); // local today
            }

            if (fillStart && fillEnd && !isNaN(fillStart.getTime()) && !isNaN(fillEnd.getTime())) {
                // Ensure we iterate smoothly by converting to clean YYYY-MM-DD local strings first
                const startStr = toLocalDateStr(fillStart);
                const endStr = toLocalDateStr(fillEnd);
                const s = new Date(startStr + 'T00:00:00');
                const e = new Date(endStr + 'T00:00:00');
                let current = new Date(s);
                while (current <= e) {
                    const dayStr = toLocalDateStr(current);
                    attendanceMap.set(dayStr, {
                        day: dayStr,
                        label: dayLabel(dayStr),
                        total: 0,
                        attended: 0,
                        absent: 0,
                        pending: 0
                    });
                    current.setDate(current.getDate() + 1);
                }
            }
            
            if (bookingsData) {
                for (const b of bookingsData as any[]) {
                    if (!b.shifts || !b.shifts.date) continue;
                    
                    const day = b.shifts.date;
                    if (!attendanceMap.has(day)) {
                        attendanceMap.set(day, {
                            day,
                            label: dayLabel(day),
                            total: 0,
                            attended: 0,
                            absent: 0,
                            pending: 0
                        });
                    }
                    
                    const stat = attendanceMap.get(day)!;
                    stat.total++;
                    if (b.attendance === 'attended') stat.attended++;
                    else if (b.attendance === 'absent') stat.absent++;
                    else stat.pending++;
                }
            }
            
            const attendanceStats = Array.from(attendanceMap.values())
                .filter(stat => {
                    const statDateStr = stat.day;
                    if (period === 'all' && eventStart && eventEnd) {
                        return statDateStr >= eventStart && statDateStr <= eventEnd;
                    }
                    if (period === 'today') {
                        return statDateStr === toLocalDateStr(new Date());
                    }
                    if (period === 'week') {
                        const todayStr = toLocalDateStr(new Date());
                        const sinceStr = toLocalDateStr(since!);
                        return statDateStr >= sinceStr && statDateStr <= todayStr;
                    }
                    return true;
                })
                .sort((a, b) => a.day.localeCompare(b.day));

            setData({ days, totals, stationStats, dailyStationStats, hourlyStats, attendanceStats, loadedAt: new Date() });
        } catch (error) {
            console.error('[StandMetrics] Error fatal cargando métricas:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [eventId, period, eventStart, eventEnd]);

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

    const handleDownloadPDF = () => {
        if (!data) return;
        const doc = new jsPDF();
        
        // Header
        doc.setFillColor(243, 244, 246);
        doc.rect(0, 0, 210, 38, 'F');
        doc.setFontSize(20);
        doc.setTextColor(17, 24, 39);
        doc.text("Métricas del Stand - FamilySearch", 14, 20);
        
        doc.setFontSize(12);
        doc.text(`Evento: ${eventName}`, 14, 28);
        doc.setFontSize(10);
        const periodStr = period === 'today' ? 'Hoy' : period === 'week' ? 'Últimos 7 días' : 'Todo el evento';
        doc.text(`Período: ${periodStr}  |  Actualizado: ${data.loadedAt.toLocaleTimeString('es-AR')}`, 14, 33);
        
        let yPos = 48;
        
        // Resumen
        doc.setFontSize(14);
        doc.setTextColor(17, 24, 39);
        doc.text("Resumen General", 14, yPos);
        yPos += 8;
        
        const totalRows = [
            ["Personas atendidas:", `${(data.totals.pcPersonas ?? 0) + (data.totals.expPersonas ?? 0)}`],
            ["Experiencias registradas:", `${(data.totals.pcSessions ?? 0) + (data.totals.expSessions ?? 0)}`],
            ["Sesiones PC:", `${data.totals.pcSessions}`],
            ["Extensiones de tiempo PC:", `${data.totals.pcExtensiones}`],
            ["Minutos extra generados por extensiones:", `${(data.totals.pcExtensiones ?? 0) * 5}`]
        ];
        
        autoTable(doc, {
            startY: yPos,
            body: totalRows,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 2 },
            columnStyles: { 0: { fontStyle: 'bold', minCellWidth: 70 } }
        });
        
        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 15;
        
        // Tabla diaria
        doc.setFontSize(14);
        doc.text("Evolución Diaria", 14, yPos);
        yPos += 8;
        
        const dayHeaders = [["Fecha", "Ses. PC", "Pers. PC", "Ext.", "Exp. Puestos", "Pers. Puestos", "Total"]];
        const dayRows = data.days.map(r => [
            r.label,
            r.pcSessions.toString(),
            r.pcPersonas.toString(),
            r.pcExtensiones.toString(),
            r.expSessions.toString(),
            r.expPersonas.toString(),
            (r.pcPersonas + r.expPersonas).toString()
        ]);
        
        // Fila Total
        dayRows.push([
            "TOTAL",
            data.totals.pcSessions.toString(),
            data.totals.pcPersonas.toString(),
            data.totals.pcExtensiones.toString(),
            data.totals.expSessions.toString(),
            data.totals.expPersonas.toString(),
            (data.totals.pcPersonas + data.totals.expPersonas).toString()
        ]);
        
        autoTable(doc, {
            startY: yPos,
            head: dayHeaders,
            body: dayRows,
            theme: 'grid',
            headStyles: { fillColor: [0, 169, 79], textColor: 255 }, // FS_GREEN
            styles: { fontSize: 9, cellPadding: 3 },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            willDrawCell: function(hookData) {
                if (hookData.row.index === dayRows.length - 1) {
                    doc.setFont(doc.getFont().fontName, 'bold');
                }
            }
        });
        
        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 15;
        
        // Desglose Puestos
        if (data.stationStats.length > 0) {
            if (yPos > 250) { doc.addPage(); yPos = 20; }
            doc.setFontSize(14);
            doc.text("Desglose por Puesto de Experiencia", 14, yPos);
            yPos += 8;
            
            const stHeaders = [["Puesto", "Experiencias", "Personas", "Promedio"]];
            const stRows = data.stationStats.map(st => [
                st.stationNombre,
                st.totalExperiencias.toString(),
                st.totalPersonas.toString(),
                st.totalExperiencias > 0 ? (st.totalPersonas / st.totalExperiencias).toFixed(1) : "—"
            ]);
            
            autoTable(doc, {
                startY: yPos,
                head: stHeaders,
                body: stRows,
                theme: 'grid',
                headStyles: { fillColor: [0, 89, 148], textColor: 255 }, // FS_BLUE
                styles: { fontSize: 9, cellPadding: 3 },
                alternateRowStyles: { fillColor: [249, 250, 251] }
            });
        }
        
        doc.save(`Métricas_Stand_${eventName.replace(/\s+/g, '_')}_${period}.pdf`);
    };

    const totalPersonas = (data?.totals.pcPersonas ?? 0) + (data?.totals.expPersonas ?? 0);
    const totalSessions = (data?.totals.pcSessions ?? 0) + (data?.totals.expSessions ?? 0);
    const avgPeoplePerExp = totalSessions > 0 ? (totalPersonas / totalSessions).toFixed(1) : '0';
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
                        onClick={handleDownloadPDF}
                        disabled={loading || !data}
                        style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${FS_BORDER}`, background: 'white', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
                        title="Exportar Reporte a PDF"
                    >
                        <Download size={15} />
                        Exportar PDF
                    </button>
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
                <StatCard icon={<Zap size={20} color={FS_BLUE} />} bg="#f0f6fc" border="#b0d0e8" label="Puestos de atención" value={data?.totals.expPersonas ?? 0} sub={`${data?.totals.expSessions ?? 0} experiencias únicas`} valColor={FS_BLUE} />
                <StatCard icon={<Monitor size={20} color="#7c3aed" />} bg="#f5f0ff" border="#d0b8f5" label="Personas en PC" value={data?.totals.pcPersonas ?? 0} sub={`${data?.totals.pcSessions ?? 0} sesiones de PC`} valColor="#7c3aed" />
                <StatCard icon={<Activity size={20} color="#0891b2" />} bg="#f0f9fc" border="#b0dde8" label="Promedio por experiencia" value={avgPeoplePerExp} sub="Personas / Sesión" valColor="#0891b2" />
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
                                            <span style={{ fontSize: 13, color: '#444' }}>
                                                <strong style={{ color: FS_DARK }}>{total}</strong> personas
                                                <span style={{ color: '#555', marginLeft: 8, fontWeight: 800 }}>({row.pcSessions + row.expSessions} exp.)</span>
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

            {/* ── Gráfico por Hora ── */}
            <Section title="Distribución por Hora (Actividad)" icon={<Clock size={18} color={FS_BLUE} />}>
                {data?.hourlyStats ? (
                    <HourlyChart stats={data.hourlyStats} />
                ) : (
                    <Empty text="Cargando distribución..." />
                )}
            </Section>

            {/* ── Detalle por puesto de experiencia ── */}

            <Section title="Desglose por puesto de experiencia" icon={<Zap size={18} color={FS_BLUE} />}>
                {!data?.stationStats.length ? (
                    <Empty text="Sin registros de experiencias en el período." />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Si hay más de un día en dailyStationStats y estamos en modo 'all', mostramos el desglose diario */}
                        {(period === 'all' || data.dailyStationStats.length > 1) && data.dailyStationStats.map(ds => (
                            <div key={ds.day} style={{ border: `1px solid ${FS_BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                                <div style={{ background: '#f8fafc', padding: '8px 12px', borderBottom: `1px solid ${FS_BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: '#334155', textTransform: 'capitalize' }}>{ds.label}</span>
                                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{ds.stats.reduce((acc, s) => acc + s.totalPersonas, 0)} personas</span>
                                </div>
                                <StationTable stats={ds.stats} totalsColor={FS_BLUE} />
                            </div>
                        ))}

                        {/* Siempre mostramos el total acumulado al final si hay múltiples días, o como tabla única si es un solo día */}
                        <div>
                            {data.dailyStationStats.length > 1 && (
                                <p style={{ fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                                    Resumen Total Acumulado
                                </p>
                            )}
                            <StationTable stats={data.stationStats} totalsColor={FS_BLUE} isTotal />
                        </div>
                    </div>
                )}
            </Section>

            {/* ── Análisis de Ausentismo ── */}
            <Section title="Análisis de Ausentismo de Voluntarios" icon={<Users size={18} color="#ea580c" />}>
                {!data?.attendanceStats.length ? (
                    <Empty text="Sin datos de asistencia para el período seleccionado." />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#fff7ed' }}>
                                        <Th>Fecha</Th>
                                        <Th align="right">Turnos Confirmados</Th>
                                        <Th align="right">Presentes</Th>
                                        <Th align="right">Ausentes</Th>
                                        <Th align="right">Pendientes</Th>
                                        <Th align="right">% Ausentismo (s/Confirmados)</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.attendanceStats.map((stat, i) => {
                                        // Ausentismo = ausentes / (presentes + ausentes)  ó sobre total confirmado?
                                        // Usualmente sobre el total de turnos que no están pendientes
                                        // O sobre el total general. Vamos a usar ausentes / (presentes + ausentes) si hay marcados, sino 0.
                                        const totalMarked = stat.attended + stat.absent;
                                        const pct = totalMarked > 0 ? ((stat.absent / totalMarked) * 100).toFixed(1) : '0.0';
                                        
                                        return (
                                            <tr key={stat.day} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: `1px solid ${FS_BORDER}` }}>
                                                <td style={{ padding: '9px 12px', fontWeight: 600, color: '#333' }}>
                                                    {stat.label}
                                                </td>
                                                <Td>{stat.total}</Td>
                                                <Td color="#15803d" bold>{stat.attended}</Td>
                                                <Td color="#dc2626" bold>{stat.absent}</Td>
                                                <Td color="#94a3b8">{stat.pending}</Td>
                                                <Td color="#ea580c" bold>{pct}%</Td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: '#ffedd5', borderTop: `1px solid #fdba74` }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#9a3412', fontSize: 12, textTransform: 'uppercase' }}>Total</td>
                                        <Td bold>{data.attendanceStats.reduce((acc, s) => acc + s.total, 0)}</Td>
                                        <Td bold color="#15803d">{data.attendanceStats.reduce((acc, s) => acc + s.attended, 0)}</Td>
                                        <Td bold color="#dc2626">{data.attendanceStats.reduce((acc, s) => acc + s.absent, 0)}</Td>
                                        <Td bold color="#94a3b8">{data.attendanceStats.reduce((acc, s) => acc + s.pending, 0)}</Td>
                                        <Td bold color="#ea580c">
                                            {(() => {
                                                const totalA = data.attendanceStats.reduce((acc, s) => acc + s.attended, 0);
                                                const totalM = data.attendanceStats.reduce((acc, s) => acc + s.absent, 0);
                                                const sum = totalA + totalM;
                                                return sum > 0 ? ((totalM / sum) * 100).toFixed(1) + '%' : '0.0%';
                                            })()}
                                        </Td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </Section>

        </div>
    );
};

// ── Sub-componentes ─────────────────────────────────────────────────────────

const StatCard = ({ icon, bg, border, label, value, sub, valColor }: {
    icon: React.ReactNode; bg: string; border: string;
    label: string; value: number | string; sub?: string; valColor?: string;
}) => (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ background: 'white', borderRadius: 10, padding: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>{icon}</div>
        <div>
            <p style={{ fontSize: 28, fontWeight: 800, color: valColor || '#1a1a1a', margin: 0 }}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            <p style={{ fontSize: 12, color: '#555', margin: '2px 0 0', fontWeight: 600 }}>{label}</p>
            {sub && <p style={{ fontSize: 12, color: '#444', margin: '1px 0 0', fontWeight: 700 }}>{sub}</p>}
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

const StationTable = ({ stats, totalsColor, isTotal }: { stats: StationStats[]; totalsColor: string; isTotal?: boolean }) => {
    const totalExp = stats.reduce((acc, s) => acc + s.totalExperiencias, 0);
    const totalPers = stats.reduce((acc, s) => acc + s.totalPersonas, 0);

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                        <Th>Puesto</Th>
                        <Th align="right">Experiencias</Th>
                        <Th align="right">Personas</Th>
                        <Th align="right">Promedio</Th>
                    </tr>
                </thead>
                <tbody>
                    {stats.map((st, i) => (
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
                    <tr style={{ background: isTotal ? '#f0f6ff' : '#f8fafc', borderTop: `1px solid ${isTotal ? totalsColor : FS_BORDER}` }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: isTotal ? totalsColor : '#555', fontSize: 12, textTransform: 'uppercase' }}>Subtotal</td>
                        <Td bold>{totalExp}</Td>
                        <Td bold>{totalPers}</Td>
                        <Td bold color="#555">{totalExp > 0 ? (totalPers / totalExp).toFixed(1) : '—'}</Td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

const HourlyChart = ({ stats }: { stats: HourlyStats[] }) => {
    // Encontrar el rango de horas con actividad (por defecto 8 a 21)
    let minActive = 8;
    let maxActive = 21;

    for (const s of stats) {
        if (s.pcSessions > 0 || s.expSessions > 0) {
            if (s.hour < minActive) minActive = s.hour;
            if (s.hour > maxActive) maxActive = s.hour;
        }
    }

    const activeStats = stats.filter(s => s.hour >= minActive && s.hour <= maxActive);
    const maxVal = Math.max(...activeStats.map(s => s.pcSessions + s.expSessions), 1);

    return (
        <div style={{ padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160, borderBottom: `2px solid ${FS_BORDER}`, paddingBottom: 5, overflowX: 'auto', minWidth: '100%' }} className="hide-scrollbar">
                {activeStats.map(s => {
                    const pcH = (s.pcSessions / maxVal) * 100;
                    const expH = (s.expSessions / maxVal) * 100;
                    const total = s.pcSessions + s.expSessions;

                    return (
                        <div key={s.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 25 }}>
                            <div style={{ width: '100%', height: 140, display: 'flex', flexDirection: 'column-reverse', gap: 1 }}>
                                {/* Barra Experiencias */}
                                <div 
                                    style={{ height: `${expH}%`, background: FS_GREEN, width: '100%', borderRadius: '2px 2px 0 0', transition: 'height 0.3s' }} 
                                    title={`Experiencias: ${s.expSessions}`}
                                />
                                {/* Barra PCs */}
                                <div 
                                    style={{ height: `${pcH}%`, background: '#7c3aed', width: '100%', borderRadius: '2px 2px 0 0', transition: 'height 0.3s' }} 
                                    title={`Sesiones PC: ${s.pcSessions}`}
                                />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#666', marginTop: 8 }}>{s.hour}h</span>
                        </div>
                    );
                })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, background: '#7c3aed', borderRadius: 2 }} />
                    <span style={{ fontSize: 11, color: '#666' }}>Computadoras</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, background: FS_GREEN, borderRadius: 2 }} />
                    <span style={{ fontSize: 11, color: '#666' }}>Puestos de experiencia</span>
                </div>
            </div>
        </div>
    );
};

export default StandMetrics;
