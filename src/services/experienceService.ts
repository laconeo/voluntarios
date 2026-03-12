import { supabase } from '../lib/supabaseClient';

export interface ExperienceStation {
    id: string;
    eventoId: string;
    nombre: string;
    createdAt: string;
}

export interface ExperienceLog {
    id: string;
    stationId: string;
    eventoId: string;
    cantidadPersonas: number;
    createdAt: string;
    stationNombre?: string;
}

export interface StationStats {
    stationId: string;
    stationNombre: string;
    totalExperiencias: number;
    totalPersonas: number;
}

const mapStation = (r: any): ExperienceStation => ({
    id: r.id,
    eventoId: r.evento_id,
    nombre: r.nombre,
    createdAt: r.created_at,
});

const mapLog = (r: any): ExperienceLog => ({
    id: r.id,
    stationId: r.station_id,
    eventoId: r.evento_id,
    cantidadPersonas: r.cantidad_personas,
    createdAt: r.created_at,
    stationNombre: r.station?.nombre,
});

export const experienceService = {

    // ── Stations ──────────────────────────────────────────────────────────

    getStations: async (eventoId: string): Promise<ExperienceStation[]> => {
        const { data, error } = await supabase
            .from('experience_stations')
            .select('*')
            .eq('evento_id', eventoId)
            .order('created_at');
        if (error) throw error;
        return (data || []).map(mapStation);
    },

    getStationById: async (stationId: string): Promise<ExperienceStation | null> => {
        const { data, error } = await supabase
            .from('experience_stations')
            .select('*')
            .eq('id', stationId)
            .single();
        if (error) return null;
        return mapStation(data);
    },

    createStation: async (eventoId: string, nombre: string): Promise<ExperienceStation> => {
        const { data, error } = await supabase
            .from('experience_stations')
            .insert({ evento_id: eventoId, nombre: nombre.trim() })
            .select()
            .single();
        if (error) throw error;
        return mapStation(data);
    },

    updateStation: async (stationId: string, nombre: string): Promise<ExperienceStation> => {
        const { data, error } = await supabase
            .from('experience_stations')
            .update({ nombre: nombre.trim() })
            .eq('id', stationId)
            .select()
            .single();
        if (error) throw error;
        return mapStation(data);
    },

    deleteStation: async (stationId: string): Promise<void> => {
        const { error } = await supabase
            .from('experience_stations')
            .delete()
            .eq('id', stationId);
        if (error) throw error;
    },

    // ── Logs ──────────────────────────────────────────────────────────────

    logExperience: async (
        stationId: string,
        eventoId: string,
        cantidadPersonas: number
    ): Promise<ExperienceLog> => {
        const { data, error } = await supabase
            .from('experience_logs')
            .insert({
                station_id: stationId,
                evento_id: eventoId,
                cantidad_personas: cantidadPersonas,
            })
            .select()
            .single();
        if (error) throw error;
        return mapLog(data);
    },

    getLogsForStation: async (
        stationId: string,
        since?: Date
    ): Promise<ExperienceLog[]> => {
        // Paginación para superar el límite de 1000 filas de Supabase PostgREST
        const PAGE_SIZE = 1000;
        let allData: any[] = [];
        let from = 0;
        while (true) {
            let q = supabase
                .from('experience_logs')
                .select('*')
                .eq('station_id', stationId)
                .order('created_at', { ascending: true })
                .range(from, from + PAGE_SIZE - 1);
            if (since) q = q.gte('created_at', since.toISOString());
            const { data, error } = await q;
            if (error) throw error;
            if (!data || data.length === 0) break;
            allData = [...allData, ...data];
            if (data.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
        }
        return allData.map(mapLog);
    },

    getLogsForEvent: async (
        eventoId: string,
        since?: Date
    ): Promise<ExperienceLog[]> => {
        // Paginación para superar el límite de 1000 filas de Supabase PostgREST
        const PAGE_SIZE = 1000;
        let allData: any[] = [];
        let from = 0;
        while (true) {
            let q = supabase
                .from('experience_logs')
                .select('*, station:experience_stations(nombre)')
                .eq('evento_id', eventoId)
                .order('created_at', { ascending: true })
                .range(from, from + PAGE_SIZE - 1);
            if (since) q = q.gte('created_at', since.toISOString());
            const { data, error } = await q;
            if (error) throw error;
            if (!data || data.length === 0) break;
            allData = [...allData, ...data];
            if (data.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
        }
        return allData.map(mapLog);
    },

    // Agrupado por puesto: resumen de métricas
    getStatsForEvent: async (
        eventoId: string,
        since?: Date
    ): Promise<StationStats[]> => {
        const logs = await experienceService.getLogsForEvent(eventoId, since);
        const map = new Map<string, StationStats>();
        for (const log of logs) {
            const key = log.stationId;
            if (!map.has(key)) {
                map.set(key, {
                    stationId: key,
                    stationNombre: log.stationNombre || '?',
                    totalExperiencias: 0,
                    totalPersonas: 0,
                });
            }
            const s = map.get(key)!;
            s.totalExperiencias++;
            s.totalPersonas += log.cantidadPersonas;
        }
        return Array.from(map.values()).sort((a, b) =>
            a.stationNombre.localeCompare(b.stationNombre)
        );
    },
};
