import { supabase } from '../lib/supabaseClient';
import type { PCStatus, BitacoraUso, User } from '../types';

export const pcControlService = {
  // Get all PCs status, optionally filtered by event
  getAllPcsStatus: async (eventoId?: string): Promise<PCStatus[]> => {
    let query = supabase.from('pcs_status').select('*, voluntario:users(*)');
    if (eventoId) {
      query = query.eq('evento_id', eventoId);
    }
    const { data, error } = await query;

    if (error) throw error;

    // Map the joined user data
    return data.map((pc: any) => ({
      ...pc,
      voluntario: pc.voluntario ? {
        id: pc.voluntario.id,
        fullName: pc.voluntario.full_name,
        // Map other fields if necessary
      } : undefined
    }));
  },

  // Get single PC status
  getPcStatus: async (id: number): Promise<PCStatus | null> => {
    const { data, error } = await supabase
      .from('pcs_status')
      .select('*, voluntario:users(*)')
      .eq('id', id)
      .single();

    if (error) return null;

    return {
      ...data,
      voluntario: data.voluntario ? {
        id: data.voluntario.id,
        fullName: data.voluntario.full_name,
      } as User : undefined
    };
  },

  // Update PC status (Lock/Unlock/Maintenance)
  updatePcStatus: async (id: number, updates: Partial<PCStatus>): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.estado) dbUpdates.estado = updates.estado;
    if (updates.voluntario_id !== undefined) dbUpdates.voluntario_id = updates.voluntario_id;
    if (updates.inicio_sesion !== undefined) dbUpdates.inicio_sesion = updates.inicio_sesion;
    if (updates.tiempo_limite !== undefined) dbUpdates.tiempo_limite = updates.tiempo_limite;

    const { error } = await supabase
      .from('pcs_status')
      .update(dbUpdates)
      .eq('id', id);

    if (error) throw error;
  },

  // Snooze (add 5 minutes) - Atomic via RPC to prevent race conditions
  snoozePc: async (id: number): Promise<void> => {
    const { error } = await supabase.rpc('snooze_pc', { 
      p_pc_id: id,
      p_minutes: 5
    });

    if (error) {
      console.error('Error in snoozePc RPC:', error);
      throw new Error('No se pudo extender el tiempo de la PC');
    }
  },

  // Log usage report
  createBitacora: async (entry: Omit<BitacoraUso, 'id' | 'created_at'>): Promise<void> => {
    const { error } = await supabase.from('bitacora_uso').insert({
      pc_id: entry.pc_id,
      evento_id: entry.evento_id,
      voluntario_id: entry.voluntario_id,
      acciones_reportadas: entry.acciones_reportadas,
      duracion_total: entry.duracion_total
    });

    if (error) throw error;
  },

  // Reset PC (clear user and set to available)
  resetPc: async (id: number): Promise<void> => {
    await pcControlService.updatePcStatus(id, {
      estado: 'disponible',
      voluntario_id: null,
      inicio_sesion: null,
      tiempo_limite: null
    });
  },

  // Get active volunteers (for login dropdown)
  getActiveVolunteers: async (): Promise<{ id: string, fullName: string }[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('status', 'active')
      .order('full_name');

    if (error) throw error;

    return data.map((u: any) => ({
      id: u.id,
      fullName: u.full_name
    }));
  },

  // Start a new session
  startSession: async (pcId: number, userId: string, durationMinutes: number = 20): Promise<void> => {
    const now = new Date();
    const limit = new Date(now.getTime() + durationMinutes * 60000);

    await pcControlService.updatePcStatus(pcId, {
      estado: 'ocupada',
      voluntario_id: userId,
      inicio_sesion: now.toISOString(),
      tiempo_limite: limit.toISOString()
    });
  },

  // Get Bitacora for metrics
  getBitacora: async (): Promise<BitacoraUso[]> => {
    const { data, error } = await supabase
      .from('bitacora_uso')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get Bitacora for specific event with optional date filter
  getBitacoraForEvent: async (eventoId: string, since?: Date): Promise<BitacoraUso[]> => {
    try {
      let query = supabase
        .from('bitacora_uso')
        .select('*')
        .eq('evento_id', eventoId)
        .order('created_at', { ascending: true });

      if (since) {
        query = query.gte('created_at', since.toISOString());
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[pcControlService] Error fetching bitacora, falling back to empty list:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('[pcControlService] Fatal error in getBitacoraForEvent:', err);
      return [];
    }
  }
};
