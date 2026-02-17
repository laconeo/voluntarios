import { supabase } from '../lib/supabaseClient';
import type { PCStatus, BitacoraUso, User } from '../types';

export const pcControlService = {
  // Get all PCs status
  getAllPcsStatus: async (): Promise<PCStatus[]> => {
    const { data, error } = await supabase
      .from('pcs_status')
      .select('*, voluntario:users(*)');

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

  // Snooze (add 5 minutes)
  snoozePc: async (id: number): Promise<void> => {
    // First get current limit
    const { data, error } = await supabase
      .from('pcs_status')
      .select('tiempo_limite')
      .eq('id', id)
      .single();

    if (error || !data.tiempo_limite) throw new Error('No se pudo obtener el tiempo límite actual');

    const newLimit = new Date(new Date(data.tiempo_limite).getTime() + 5 * 60000).toISOString();

    await pcControlService.updatePcStatus(id, { tiempo_limite: newLimit });
  },

  // Log usage report
  createBitacora: async (entry: Omit<BitacoraUso, 'id' | 'created_at'>): Promise<void> => {
    const { error } = await supabase.from('bitacora_uso').insert({
      pc_id: entry.pc_id,
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
  }
};
