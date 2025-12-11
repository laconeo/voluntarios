
import { supabase } from '../lib/supabaseClient';
import type { User, Role, Shift, Booking, Event, EventAdmin, DashboardMetrics, WaitlistEntry } from '../types';
import { emailService } from './emailService';

// Helper to map DB columns to camelCase types if necessary
// But our Types match the DB columns mostly if we use snake_case in DB and camelCase in Types?
// DB uses snake_case: full_name. Types: fullName.
// We need a mapper.

const mapUser = (row: any): User => ({
    id: row.id,
    dni: row.dni,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    tshirtSize: row.tshirt_size,
    isMember: row.is_member,
    attendedPrevious: row.attended_previous,
    isOver18: row.is_over_18,
    howTheyHeard: row.how_they_heard,
    role: row.role as any,
    password: row.password,
    status: row.status as any,
    createdAt: row.created_at,
});

const mapEvent = (row: any): Event => ({
    id: row.id,
    slug: row.slug,
    nombre: row.nombre,
    ubicacion: row.ubicacion,
    pais: row.pais,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    descripcion: row.descripcion,
    estado: row.estado as any,
    voluntarios: 0, // Calculated separately
    turnos: 0, // Calculated separately
    ocupacion: 0, // Calculated separately
    createdAt: row.created_at,
});

const mapRole = (row: any): Role => ({
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    description: row.description,
    detailedTasks: row.detailed_tasks,
    youtubeUrl: row.youtube_url,
    experienceLevel: row.experience_level as any,
    requiresApproval: row.requires_approval,
    createdAt: row.created_at,
});

const mapShift = (row: any): Shift => ({
    id: row.id,
    eventId: row.event_id,
    date: row.date,
    timeSlot: row.time_slot,
    roleId: row.role_id,
    totalVacancies: row.total_vacancies,
    availableVacancies: row.total_vacancies, // Calc logic needed
    coordinatorIds: row.coordinator_ids || [],
});

const mapBooking = (row: any): Booking => ({
    id: row.id,
    userId: row.user_id,
    shiftId: row.shift_id,
    eventId: row.event_id,
    status: row.status as any,
    attendance: row.attendance as any,
    requestedAt: row.requested_at,
    cancelledAt: row.cancelled_at,
    // Relations must be joined if needed
});

// helper
const isWithin24Hours = (shiftDate: string, shiftTime: string): boolean => {
    const [startTime] = shiftTime.split('-');
    const cleanStartTime = startTime ? startTime.trim() : '00:00';
    const shiftDateTime = new Date(`${shiftDate}T${cleanStartTime}:00`);
    const now = new Date();
    const diff = shiftDateTime.getTime() - now.getTime();
    const hoursUntilShift = diff / (1000 * 60 * 60);
    return hoursUntilShift <= 24 && hoursUntilShift > 0;
};

// No delay needed for Supabase calls ideally, but network latency is there.

export const supabaseApi = {
    // ==================== AUTH ====================
    login: async (identifier: string, password?: string): Promise<User | null> => {
        // 1. Resolve proper email and check existence in public profile
        const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .or(`dni.eq.${identifier},email.eq.${identifier}`)
            .maybeSingle();

        if (!userProfile) {
            throw new Error('Usuario no encontrado');
        }

        const email = userProfile.email;

        // 2. User exists. Check if password is intended to be checked.
        if (!password) {
            // Signal that we found the user but need password
            throw new Error('Contraseña requerida');
        }

        // 3. Authenticate with Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            // Translate common Supabase errors
            if (error.message === 'Invalid login credentials') throw new Error('Contraseña incorrecta');
            throw error;
        }

        if (!data.user) return null;

        // Return the profile we already found (or fetch again if needed, but we have it)
        return mapUser(userProfile);
    },

    recoverPassword: async (email: string): Promise<void> => {
        // Explicit strategy: Hardcode production URL to ensure correct subdirectory
        const prodUrl = 'https://laconeo.github.io/voluntarios';
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        // Use current origin for local, explicit prod URL for deployment
        // We append a trailing slash because Supabase sometimes prefers it for folder matching
        const redirectUrl = isLocal ? window.location.origin : `${prodUrl}/`;

        console.log('Recovery Redirect URL:', redirectUrl);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl,
        });
        if (error) throw error;
    },

    register: async (newUser: User): Promise<User> => {
        // Check if user exists by DNI to avoid dups in Profile
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('dni', newUser.dni)
            .maybeSingle();

        // If profile exists, check if they have auth?
        // For simplicity: If profile exists, we update it. But assume they already have Auth.
        // If they "forgot" everything, recoverPassword is better.
        // But user asked to "register again" for new events.

        if (existingUser) {
            // User exists. Update profile data.
            const { data: updated, error } = await supabase
                .from('users')
                .update({
                    full_name: newUser.fullName,
                    phone: newUser.phone,
                    tshirt_size: newUser.tshirtSize,
                    is_member: newUser.isMember,
                    attended_previous: newUser.attendedPrevious,
                    is_over_18: newUser.isOver18,
                    how_they_heard: newUser.howTheyHeard,
                    // DO NOT update ID or Email effectively here for Auth linkage
                })
                .eq('id', existingUser.id)
                .select()
                .single();

            if (error) throw error;

            // Maybe resend credentials? We can't see the old password.
            // We could Admin-Reset it, but client SDK can't set password without old one usually.
            // Let's assume re-registration just updates profile.
            return mapUser(updated);
        }

        // New User: Generate Password -> SignUp -> Create Profile
        const generatedPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8); // simple random string

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: newUser.email,
            password: generatedPassword,
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Error creando usuario de autenticación');

        // Create Profile linked to Auth ID
        const dbUser = {
            id: authData.user.id, // CRITICAL: Link Auth ID
            dni: newUser.dni,
            full_name: newUser.fullName,
            email: newUser.email,
            phone: newUser.phone,
            tshirt_size: newUser.tshirtSize,
            is_member: newUser.isMember,
            attended_previous: newUser.attendedPrevious,
            is_over_18: newUser.isOver18,
            how_they_heard: newUser.howTheyHeard,
            role: newUser.role || 'volunteer',
            status: 'active'
        };

        const { data: profileData, error: profileError } = await supabase.from('users').insert(dbUser).select().single();

        // If profile creation fails, we should ideally rollback Auth (delete user), but for MVP just throw
        if (profileError) {
            console.error('Profile creation failed', profileError);
            throw profileError;
        }

        const registered = mapUser(profileData);
        emailService.sendWelcomeEmail(registered, generatedPassword).catch(console.error);
        return registered;
    },

    updateUser: async (updatedUser: User): Promise<User> => {
        const dbUser = {
            dni: updatedUser.dni,
            full_name: updatedUser.fullName,
            email: updatedUser.email,
            phone: updatedUser.phone,
            tshirt_size: updatedUser.tshirtSize,
            is_member: updatedUser.isMember,
            attended_previous: updatedUser.attendedPrevious,
            is_over_18: updatedUser.isOver18,
            how_they_heard: updatedUser.howTheyHeard,
            role: updatedUser.role,
            status: updatedUser.status
        };

        if (updatedUser.password) {
            // Update password in Auth if changed
            const { error: authError } = await supabase.auth.admin.updateUserById(
                updatedUser.id,
                { password: updatedUser.password }
            );

            // Fallback for non-service-role clients (standard client can only update own password)
            // But here we are admin editing another user. Without service role, we can't update OTHER's password via Client SDK easily.
            // We will ignore this limitation for now or assume backend trigger handles it if implemented. 
            // In pure client-side SuperAdmin, updating other's password is restricted.
            if (authError) console.warn('Could not update Auth password (client limitation):', authError);
        }

        const { data, error } = await supabase
            .from('users')
            .update(dbUser)
            .eq('id', updatedUser.id)
            .select()
            .single();

        if (error) throw error;

        // Check if user became suspended to release bookings
        if (updatedUser.status === 'suspended') {
            await supabase
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('user_id', updatedUser.id)
                .eq('status', 'confirmed');
        }

        return mapUser(data);
    },

    deleteUser: async (userId: string): Promise<void> => {
        // 1. Delete from public users table
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        // Note: Auth user deletion requires Service Role key and backend logic.
        // We only delete the profile data here. The Auth user remains but login will fail or have no profile.
    },

    getAllUsers: async (): Promise<User[]> => {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        return data.map(mapUser);
    },

    getUserById: async (userId: string): Promise<User | null> => {
        const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
        if (error) return null;
        return mapUser(data);
    },


    // ==================== EVENTS ====================
    getAllEvents: async (): Promise<Event[]> => {
        const { data, error } = await supabase.from('events').select('*');
        if (error) throw error;
        // In real app, fetch counts via joined query
        // For now, map basic data. Metrics dashboard calculates detailed counts.
        return data.map(mapEvent);
    },

    getEventById: async (eventId: string): Promise<Event | null> => {
        const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();
        if (error) return null;
        return mapEvent(data);
    },

    getEventBySlug: async (slug: string): Promise<Event | null> => {
        const { data, error } = await supabase.from('events').select('*').eq('slug', slug).single();
        if (error) return null;
        return mapEvent(data);
    },

    createEvent: async (eventData: Omit<Event, 'id' | 'voluntarios' | 'turnos' | 'ocupacion' | 'createdAt'>): Promise<Event> => {
        const dbEvent = {
            id: `event_${Date.now()}`,
            slug: eventData.slug || eventData.nombre.toLowerCase().replace(/ /g, '-'),
            nombre: eventData.nombre,
            ubicacion: eventData.ubicacion,
            pais: eventData.pais,
            fecha_inicio: eventData.fechaInicio,
            fecha_fin: eventData.fechaFin,
            descripcion: eventData.descripcion,
            estado: eventData.estado || 'Activo'
        };
        const { data, error } = await supabase.from('events').insert(dbEvent).select().single();
        if (error) throw error;
        return mapEvent(data);
    },

    updateEvent: async (eventId: string, updates: Partial<Event>): Promise<Event> => {
        const dbUpdates: any = {};
        if (updates.nombre) dbUpdates.nombre = updates.nombre;
        if (updates.slug) dbUpdates.slug = updates.slug;
        if (updates.ubicacion) dbUpdates.ubicacion = updates.ubicacion;
        if (updates.pais) dbUpdates.pais = updates.pais;
        if (updates.fechaInicio) dbUpdates.fecha_inicio = updates.fechaInicio;
        if (updates.fechaFin) dbUpdates.fecha_fin = updates.fechaFin;
        if (updates.descripcion) dbUpdates.descripcion = updates.descripcion;
        if (updates.estado) dbUpdates.estado = updates.estado;

        const { data, error } = await supabase.from('events').update(dbUpdates).eq('id', eventId).select().single();
        if (error) throw error;
        return mapEvent(data);
    },

    archiveEvent: async (eventId: string): Promise<Event> => {
        const { data, error } = await supabase.from('events').update({ estado: 'Archivado' }).eq('id', eventId).select().single();
        if (error) throw error;
        return mapEvent(data);
    },

    deleteEvent: async (eventId: string): Promise<void> => {
        // Check for bookings
        const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('event_id', eventId);
        if (count && count > 0) throw new Error('No se puede eliminar evento con voluntarios registrados');

        const { error } = await supabase.from('events').delete().eq('id', eventId);
        if (error) throw error;
    },

    // ==================== EVENT ADMINS ====================
    assignAdminToEvent: async (userId: string, eventId: string, assignedBy: string): Promise<EventAdmin> => {
        const newAssignment = {
            id: `ea_${Date.now()}`,
            user_id: userId,
            event_id: eventId,
            assigned_by: assignedBy
        };
        const { data, error } = await supabase.from('event_admins').insert(newAssignment).select().single();
        if (error) throw error;

        // Update User Role to admin
        await supabase.from('users').update({ role: 'admin' }).eq('id', userId);

        return {
            id: data.id,
            userId: data.user_id,
            eventId: data.event_id,
            assignedAt: data.assigned_at,
            assignedBy: data.assigned_by
        };
    },

    getEventAdmins: async (eventId: string): Promise<User[]> => {
        const { data: adminIds } = await supabase.from('event_admins').select('user_id').eq('event_id', eventId);
        if (!adminIds || adminIds.length === 0) return [];

        const ids = adminIds.map(a => a.user_id);
        const { data: users } = await supabase.from('users').select('*').in('id', ids);

        return (users || []).map(mapUser);
    },

    revokeAdminFromEvent: async (userId: string, eventId: string): Promise<void> => {
        const { error } = await supabase.from('event_admins').delete().match({ user_id: userId, event_id: eventId });
        if (error) throw error;

        // Check if has other events
        const { count } = await supabase.from('event_admins').select('*', { count: 'exact', head: true }).eq('user_id', userId);
        if (count === 0) {
            await supabase.from('users').update({ role: 'volunteer' }).eq('id', userId);
        }
    },


    // ==================== ROLES ====================
    getRolesByEvent: async (eventId: string): Promise<Role[]> => {
        const { data, error } = await supabase.from('roles').select('*').eq('event_id', eventId);
        if (error) throw error;
        return data.map(mapRole);
    },

    getRoleById: async (roleId: string): Promise<Role | null> => {
        const { data, error } = await supabase.from('roles').select('*').eq('id', roleId).single();
        if (error) return null;
        return mapRole(data);
    },

    getAllRoles: async (): Promise<Role[]> => {
        const { data, error } = await supabase.from('roles').select('*');
        if (error) throw error;
        return data.map(mapRole);
    },

    createRole: async (roleData: Omit<Role, 'id' | 'createdAt'>): Promise<Role> => {
        const dbRole = {
            id: `role_${Date.now()}`,
            event_id: roleData.eventId,
            name: roleData.name,
            description: roleData.description,
            detailed_tasks: roleData.detailedTasks,
            youtube_url: roleData.youtubeUrl,
            experience_level: roleData.experienceLevel,
            requires_approval: roleData.requiresApproval
        };
        const { data, error } = await supabase.from('roles').insert(dbRole).select().single();
        if (error) throw error;
        return mapRole(data);
    },

    updateRole: async (roleId: string, updates: Partial<Role>): Promise<Role> => {
        const dbUpdates: any = {};
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.description) dbUpdates.description = updates.description;
        if (updates.detailedTasks) dbUpdates.detailed_tasks = updates.detailedTasks;
        if (updates.youtubeUrl !== undefined) dbUpdates.youtube_url = updates.youtubeUrl;
        if (updates.experienceLevel) dbUpdates.experience_level = updates.experienceLevel;
        if (updates.requiresApproval !== undefined) dbUpdates.requires_approval = updates.requiresApproval;

        const { data, error } = await supabase.from('roles').update(dbUpdates).eq('id', roleId).select().single();
        if (error) throw error;
        return mapRole(data);
    },

    deleteRole: async (roleId: string): Promise<void> => {
        const { count } = await supabase.from('shifts').select('*', { count: 'exact', head: true }).eq('role_id', roleId);
        if (count && count > 0) throw new Error('No se puede eliminar rol con turnos asignados');
        await supabase.from('roles').delete().eq('id', roleId);
    },

    // ==================== SHIFTS ====================
    getShiftsForDate: async (eventId: string, date: string): Promise<Shift[]> => {
        // Fetch bookings count efficiently? Or fetch simple shifts and counts.
        // Supabase returns all rows.
        const { data: shifts, error } = await supabase.from('shifts').select('*').eq('event_id', eventId).eq('date', date);
        if (error) throw error;

        // Calculate vacancies
        const shiftIds = shifts.map(s => s.id);
        const { data: bookings } = await supabase.from('bookings').select('shift_id').in('shift_id', shiftIds).eq('status', 'confirmed');

        return shifts.map(s => {
            const bookedCount = bookings?.filter(b => b.shift_id === s.id).length || 0;
            return {
                ...mapShift(s),
                availableVacancies: s.total_vacancies - bookedCount
            };
        });
    },

    getShiftsByEvent: async (eventId: string): Promise<Shift[]> => {
        const { data, error } = await supabase.from('shifts').select('*').eq('event_id', eventId);
        if (error) throw error;
        return data.map(mapShift);
    },

    getShiftById: async (shiftId: string): Promise<Shift | null> => {
        const { data, error } = await supabase.from('shifts').select('*').eq('id', shiftId).single();
        if (error) return null;
        return mapShift(data);
    },

    createShift: async (shiftData: Omit<Shift, 'id'>): Promise<Shift> => {
        const dbShift = {
            id: `shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            event_id: shiftData.eventId,
            date: shiftData.date,
            time_slot: shiftData.timeSlot,
            role_id: shiftData.roleId,
            total_vacancies: shiftData.totalVacancies,
            coordinator_ids: shiftData.coordinatorIds || []
        };
        const { data, error } = await supabase.from('shifts').insert(dbShift).select().single();
        if (error) throw error;
        return mapShift(data);
    },

    updateShift: async (shiftId: string, updates: Partial<Shift>): Promise<Shift> => {
        // Logic to check bookings not > vacancies
        if (updates.totalVacancies !== undefined) {
            const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('shift_id', shiftId).eq('status', 'confirmed');
            if (count && updates.totalVacancies < count) {
                throw new Error(`No se puede reducir el cupo a ${updates.totalVacancies} porque ya hay ${count} voluntarios inscritos.`);
            }
        }

        // Check critical changes
        // First get original
        const { data: original } = await supabase.from('shifts').select('*').eq('id', shiftId).single();
        if (!original) throw new Error('Turno no encontrado');

        const dbUpdates: any = {};
        if (updates.date) dbUpdates.date = updates.date;
        if (updates.timeSlot) dbUpdates.time_slot = updates.timeSlot;
        if (updates.totalVacancies) dbUpdates.total_vacancies = updates.totalVacancies;
        if (updates.coordinatorIds) dbUpdates.coordinator_ids = updates.coordinatorIds;

        const { data: updated, error } = await supabase.from('shifts').update(dbUpdates).eq('id', shiftId).select().single();
        if (error) throw error;

        // Alerts logic
        if ((updates.timeSlot && updates.timeSlot !== original.time_slot) || (updates.date && updates.date !== original.date)) {
            // Send emails
            const { data: bookedUsers } = await supabase
                .from('bookings')
                .select('user_id, users(*)')
                .eq('shift_id', shiftId)
                .eq('status', 'confirmed');

            const { data: event } = await supabase.from('events').select('nombre').eq('id', original.event_id).single();

            if (bookedUsers && event) {
                bookedUsers.forEach((b: any) => {
                    if (b.users) {
                        emailService.sendShiftModificationAlert(
                            mapUser(b.users), // joined data
                            event.nombre,
                            original.time_slot,
                            updated.time_slot,
                            updated.date
                        ).catch(console.error);
                    }
                });
            }
        }

        const shiftMapped = mapShift(updated);
        // calc avail
        const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('shift_id', shiftId).eq('status', 'confirmed');
        shiftMapped.availableVacancies = shiftMapped.totalVacancies - (count || 0);

        return shiftMapped;
    },

    deleteShift: async (shiftId: string): Promise<void> => {
        const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('shift_id', shiftId).neq('status', 'cancelled');
        if (count && count > 0) throw new Error('No se puede eliminar un turno con voluntarios inscritos');
        await supabase.from('shifts').delete().eq('id', shiftId);
    },

    assignCoordinatorToShift: async (shiftId: string, userId: string): Promise<Shift> => {
        const { data: shift } = await supabase.from('shifts').select('*').eq('id', shiftId).single();
        if (!shift) throw new Error('Turno no encontrado');

        // Check booking? Not enforced by DB constraint but business rule
        // ...

        let coords = shift.coordinator_ids || [];
        if (!coords.includes(userId)) {
            coords.push(userId);
            await supabase.from('shifts').update({ coordinator_ids: coords }).eq('id', shiftId);
            await supabase.from('users').update({ role: 'coordinator' }).eq('id', userId);
        }

        return mapShift({ ...shift, coordinator_ids: coords });
    },

    removeCoordinatorFromShift: async (shiftId: string, userId: string): Promise<Shift> => {
        const { data: shift } = await supabase.from('shifts').select('*').eq('id', shiftId).single();
        if (!shift) throw new Error('Turno no encontrado');

        let coords = shift.coordinator_ids || [];
        coords = coords.filter((id: string) => id !== userId);

        await supabase.from('shifts').update({ coordinator_ids: coords }).eq('id', shiftId);

        // Check if coordinator elsewhere. Complex query or straightforward check.
        // Logic: Search 'shifts' where coordinator_ids contains userId.
        const { count } = await supabase.from('shifts').select('*', { count: 'exact', head: true }).contains('coordinator_ids', [userId]);
        if (count === 0) {
            await supabase.from('users').update({ role: 'volunteer' }).eq('id', userId);
        }

        return mapShift({ ...shift, coordinator_ids: coords });
    },


    // ==================== BOOKINGS ====================
    createBooking: async (userId: string, shiftId: string): Promise<Booking> => {
        const { data: shift } = await supabase.from('shifts').select('*').eq('id', shiftId).single();
        if (!shift) throw new Error("Turno no encontrado.");

        const { data: existing } = await supabase
            .from('bookings')
            .select('*')
            .eq('user_id', userId)
            .eq('shift_id', shiftId)
            .neq('status', 'cancelled')
            .maybeSingle();

        if (existing) throw new Error("Ya estás inscripto en este turno.");

        const { count } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('shift_id', shiftId)
            .eq('status', 'confirmed');

        if (count !== null && count >= shift.total_vacancies) {
            // Waitlist logic
            // Get position
            const { count: posCount } = await supabase.from('waitlist').select('*', { count: 'exact', head: true }).eq('shift_id', shiftId);
            const position = (posCount || 0) + 1;

            await supabase.from('waitlist').insert({
                id: `wl_${Date.now()}`,
                user_id: userId,
                shift_id: shiftId,
                event_id: shift.event_id,
                position: position
            });

            // Create booking status waitlist
            const newBooking = {
                id: `booking_${Date.now()}`,
                user_id: userId,
                shift_id: shiftId,
                event_id: shift.event_id,
                status: 'waitlist',
                requested_at: new Date().toISOString()
            };
            const { data: bookingData } = await supabase.from('bookings').insert(newBooking).select().single();
            throw new Error("No hay vacantes disponibles. Te agregamos a la lista de espera.");
        }

        // Check if role requires approval
        const { data: role } = await supabase.from('roles').select('*').eq('id', shift.role_id).single();
        const initialStatus = role?.requires_approval ? 'pending_approval' : 'confirmed';

        const newBooking = {
            id: `booking_${Date.now()}`,
            user_id: userId,
            shift_id: shiftId,
            event_id: shift.event_id,
            status: initialStatus,
            requested_at: new Date().toISOString()
        };

        const { data: bookingData } = await supabase.from('bookings').insert(newBooking).select().single();

        // Email
        const { data: event } = await supabase.from('events').select('*').eq('id', shift.event_id).single();
        const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();

        if (event && role && user) {
            emailService.sendBookingConfirmation(
                mapUser(user),
                mapEvent(event),
                role.name,
                shift.date,
                shift.time_slot
            ).catch(console.error);
        }

        return mapBooking(bookingData);
    },

    getBookingsByEvent: async (eventId: string): Promise<Booking[]> => {
        const { data } = await supabase.from('bookings').select('*').eq('event_id', eventId).neq('status', 'cancelled');
        return (data || []).map(mapBooking);
    },

    getUserBookings: async (userId: string, eventId?: string): Promise<Booking[]> => {
        let query = supabase.from('bookings').select('*, shifts(*, roles(*))').eq('user_id', userId).neq('status', 'cancelled');
        if (eventId) {
            query = query.eq('event_id', eventId);
        }

        const { data } = await query;
        if (!data) return [];

        return data.map((b: any) => {
            const booking = mapBooking(b);
            if (b.shifts) {
                booking.shift = mapShift(b.shifts) as Shift & { role: Role };
                if (b.shifts.roles) {
                    booking.shift.role = mapRole(b.shifts.roles);
                }
            }
            return booking;
        }).sort((a, b) => new Date(a.shift?.date!).getTime() - new Date(b.shift?.date!).getTime());
    },

    requestBookingCancellation: async (bookingId: string): Promise<Booking> => {
        const { data: booking } = await supabase.from('bookings').select('*, shifts(*, events(*))').eq('id', bookingId).single();
        if (!booking) throw new Error("Inscripción no encontrada.");

        const shift = booking.shifts;
        const cancelledAt = new Date().toISOString();
        const within24 = isWithin24Hours(shift.date, shift.time_slot);

        if (within24) {
            // Auto cancel
            const { data: updated } = await supabase.from('bookings').update({ status: 'cancelled', cancelled_at: cancelledAt }).eq('id', bookingId).select().single();
            // Process waitlist
            await supabaseApi.processWaitlist(shift.id);
            return mapBooking(updated);
        } else {
            // Request
            const { data: updated } = await supabase.from('bookings').update({ status: 'cancellation_requested', cancelled_at: cancelledAt }).eq('id', bookingId).select().single();

            // Email
            const { data: user } = await supabase.from('users').select('*').eq('id', booking.user_id).single();
            if (user) {
                emailService.sendCancellationRequestReceived(
                    mapUser(user),
                    booking.events.nombre,
                    shift.date,
                    shift.time_slot
                ).catch(console.error);
            }
            return mapBooking(updated);
        }
    },

    processWaitlist: async (shiftId: string): Promise<void> => {
        const { data: entries } = await supabase.from('waitlist').select('*').eq('shift_id', shiftId).order('position', { ascending: true });

        if (entries && entries.length > 0) {
            const next = entries[0];

            // Promote booking? Booking already exists with status 'waitlist' for this user/shift?
            // In createBooking we inserted a 'waitlist' booking.
            await supabase.from('bookings').update({ status: 'confirmed' })
                .eq('user_id', next.user_id)
                .eq('shift_id', shiftId);

            // Remove from waitlist
            await supabase.from('waitlist').delete().eq('id', next.id);
        }
    },

    updateBookingAttendance: async (bookingId: string, attendance: 'pending' | 'attended' | 'absent'): Promise<void> => {
        await supabase.from('bookings').update({ attendance }).eq('id', bookingId);
        if (attendance !== 'pending') {
            // Fetch relations for email
            const { data: booking } = await supabase.from('bookings').select('*, users(*), shifts(*, roles(*)), events(*)').eq('id', bookingId).single();
            if (booking && booking.users) {
                const user = mapUser(booking.users);
                const evtName = booking.events?.nombre;
                const roleName = booking.shifts?.roles?.name;
                const date = booking.shifts?.date;
                const time = booking.shifts?.time_slot;

                if (attendance === 'attended') {
                    emailService.sendAttendanceThankYou(user, evtName, roleName, date, time).catch(console.error);
                } else {
                    emailService.sendAbsenceFollowUp(user, evtName, date, time).catch(console.error);
                }
            }
        }
    },

    // ==================== ADMIN METRICS ETC ====================
    getPendingCancellations: async (eventId?: string): Promise<Booking[]> => {
        let query = supabase.from('bookings').select('*, users(*), shifts(*, roles(*))').eq('status', 'cancellation_requested');
        if (eventId) query = query.eq('event_id', eventId);

        const { data } = await query;
        return (data || []).map((b: any) => {
            const booking = mapBooking(b);
            booking.user = mapUser(b.users);
            if (b.shifts) {
                booking.shift = mapShift(b.shifts) as Shift & { role: Role };
                booking.shift.role = mapRole(b.shifts.roles);
            }
            return booking;
        });
    },

    approveCancellation: async (bookingId: string): Promise<Booking> => {
        const { data: updated } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId).select('*, shifts(*), events(*), users(*)').single();
        await supabaseApi.processWaitlist(updated.shift_id);

        // Email
        if (updated.events && updated.shifts) {
            emailService.sendCancellationApproved(mapUser(updated.users), updated.events.nombre, updated.shifts.date).catch(console.error);
        }
        return mapBooking(updated);
    },

    rejectCancellation: async (bookingId: string): Promise<Booking> => {
        const { data: updated } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId).select('*, shifts(*), events(*), users(*)').single();

        // Email
        if (updated.events && updated.shifts) {
            emailService.sendCancellationRejected(mapUser(updated.users), updated.events.nombre, updated.shifts.date, updated.shifts.time_slot).catch(console.error);
        }
        return mapBooking(updated);
    },

    getPrintableRoster: async (eventId: string, date: string, timeSlot: string): Promise<any[]> => {
        // Need to filter shifts by date/time, then bookings
        const { data: bookings } = await supabase.from('bookings')
            .select('*, users(full_name, dni), shifts(role_id, roles(name))')
            .eq('event_id', eventId)
            .eq('status', 'confirmed');

        // Filter in memory or complex query. Memory is easier if dataset small.
        // Actually we need to filter by shift time.
        // Let's do a join on shifts with filter.
        const { data } = await supabase.from('bookings')
            .select('users(full_name, dni), shifts!inner(role_id, date, time_slot, roles(name))')
            .eq('event_id', eventId)
            .eq('status', 'confirmed')
            .eq('shifts.date', date)
            .eq('shifts.time_slot', timeSlot);

        return (data || []).map((row: any) => ({
            fullName: row.users.full_name || 'N/A',
            dni: row.users.dni || 'N/A',
            role: row.shifts.roles.name || 'N/A'
        })).sort((a: any, b: any) => a.role.localeCompare(b.role));
    },

    getDashboardMetrics: async (eventId: string): Promise<DashboardMetrics> => {
        // Calculate heavily.
        // Fetch all bookings and shifts for event.
        const { data: shifts } = await supabase.from('shifts').select('*').eq('event_id', eventId);
        const { data: bookings } = await supabase.from('bookings').select('*').eq('event_id', eventId).eq('status', 'confirmed');
        const { data: allBookings } = await supabase.from('bookings').select('*').eq('event_id', eventId);
        const { data: waitlist } = await supabase.from('waitlist').select('*').eq('event_id', eventId);
        const { data: roles } = await supabase.from('roles').select('*').eq('event_id', eventId); // for names?
        const { data: users } = await supabase.from('users').select('*'); // Should filter by booked user ids for perf

        if (!shifts || !bookings || !roles || !users) {
            // Return empty metrics?
            return {
                eventId,
                totalVacancies: 0,
                occupiedVacancies: 0,
                availableVacancies: 0,
                occupationPercentage: 0,
                totalVolunteers: 0,
                uniqueVolunteers: 0,
                avgShiftsPerVolunteer: 0,
                totalShifts: 0,
                pendingCancellations: 0,
                waitlistCount: 0,
                roleDistribution: [],
                dailyOccupation: [],
                shiftOccupation: {},
                attendancePercentage: 0,
                previousExperiencePercentage: 0,
                pendingCoordinatorRequests: 0,
            };
        }

        const totalVacancies = shifts.reduce((sum, s) => sum + s.total_vacancies, 0);
        const occupiedVacancies = bookings.length;
        const availableVacancies = totalVacancies - occupiedVacancies;
        const occupationPercentage = totalVacancies > 0 ? Math.round((occupiedVacancies / totalVacancies) * 100) : 0;

        const uniqueVolunteers = new Set(bookings.map(b => b.user_id)).size;
        const avgShiftsPerVolunteer = uniqueVolunteers > 0 ? (occupiedVacancies / uniqueVolunteers).toFixed(1) : 0;

        const pendingCancellations = allBookings ? allBookings.filter(b => b.status === 'cancellation_requested').length : 0;
        const pendingCoordinatorRequests = allBookings ? allBookings.filter(b => b.status === 'pending_approval').length : 0;
        const waitlistCount = waitlist ? waitlist.length : 0;

        // Distribution
        const roleDistribution = bookings.reduce((acc: any[], b) => {
            const shift = shifts.find(s => s.id === b.shift_id);
            const role = roles.find(r => r.id === shift?.role_id);
            if (role) {
                const existing = acc.find(r => r.roleName === role.name);
                if (existing) existing.count++;
                else acc.push({ roleName: role.name, count: 1 });
            }
            return acc;
        }, []);

        // Daily Occupation
        const uniqueDates = [...new Set(shifts.map(s => s.date))].sort();
        const dailyOccupation = uniqueDates.map(date => {
            const dateShifts = shifts.filter(s => s.date === date);
            const dateBookings = bookings.filter(b => {
                const shift = shifts.find(s => s.id === b.shift_id);
                return shift?.date === date;
            });
            const dateVacancies = dateShifts.reduce((sum, s) => sum + s.total_vacancies, 0);
            const occupation = dateVacancies > 0 ? Math.round((dateBookings.length / dateVacancies) * 100) : 0;
            return { date, occupation };
        });

        // Shift Occupation
        const shiftOccupation: Record<string, number> = {};
        const uniqueTimeSlots = [...new Set(shifts.map(s => s.time_slot))].sort();
        uniqueTimeSlots.forEach(slot => {
            const slotShifts = shifts.filter(s => s.time_slot === slot);
            const slotBookings = bookings.filter(b => {
                const shift = shifts.find(s => s.id === b.shift_id);
                return shift?.time_slot === slot;
            });
            const slotVacancies = slotShifts.reduce((sum, s) => sum + s.total_vacancies, 0);
            shiftOccupation[slot] = slotVacancies > 0 ? Math.round((slotBookings.length / slotVacancies) * 100) : 0;
        });

        // Attendance
        const attendedCount = bookings.filter(b => b.attendance === 'attended').length;
        const absentCount = bookings.filter(b => b.attendance === 'absent').length;
        const totalMarked = attendedCount + absentCount;
        const attendancePercentage = totalMarked > 0 ? Math.round((attendedCount / totalMarked) * 100) : 0;

        // Experience
        const uniqueUserIds = [...new Set(bookings.map(b => b.user_id))];
        const uniqueUsersWithExperience = users.filter(u => uniqueUserIds.includes(u.id) && u.attended_previous).length;
        const previousExperiencePercentage = uniqueVolunteers > 0 ? Math.round((uniqueUsersWithExperience / uniqueVolunteers) * 100) : 0;

        return {
            eventId,
            totalVacancies,
            occupiedVacancies,
            availableVacancies,
            occupationPercentage,
            totalVolunteers: uniqueVolunteers,
            uniqueVolunteers,
            avgShiftsPerVolunteer: Number(avgShiftsPerVolunteer),
            totalShifts: shifts.length,
            pendingCancellations,
            waitlistCount,
            roleDistribution,
            dailyOccupation,
            shiftOccupation,
            attendancePercentage,
            previousExperiencePercentage,
            pendingCoordinatorRequests,
        };
    },

    getPendingCoordinatorRequests: async (eventId?: string): Promise<Booking[]> => {
        let query = supabase.from('bookings').select('*, users(*), shifts(*, roles(*))').eq('status', 'pending_approval');
        if (eventId) query = query.eq('event_id', eventId);

        const { data } = await query;
        return (data || []).map((b: any) => {
            const booking = mapBooking(b);
            booking.user = mapUser(b.users);
            if (b.shifts) {
                booking.shift = mapShift(b.shifts) as Shift & { role: Role };
                if (b.shifts.roles) {
                    booking.shift.role = mapRole(b.shifts.roles);
                }
            }
            return booking;
        });
    },

    approveCoordinatorRequest: async (bookingId: string): Promise<void> => {
        // 1. Update booking status to confirmed
        const { data: booking, error } = await supabase.from('bookings')
            .update({ status: 'confirmed' })
            .eq('id', bookingId)
            .select('*, users(*), shifts(*, roles(*)), events(*)')
            .single();

        if (error || !booking) throw error || new Error('Error approving request');

        // 2. Update user role to coordinator (SYSTEM ROLE)
        if (booking.user_id) {
            await supabase.from('users').update({ role: 'coordinator' }).eq('id', booking.user_id);

            // 3. Add user to shift's coordinator_ids
            if (booking.shift_id) {
                const { data: shift } = await supabase.from('shifts').select('coordinator_ids').eq('id', booking.shift_id).single();
                if (shift) {
                    const currentCoords: string[] = shift.coordinator_ids || [];
                    if (!currentCoords.includes(booking.user_id)) {
                        await supabase.from('shifts')
                            .update({ coordinator_ids: [...currentCoords, booking.user_id] })
                            .eq('id', booking.shift_id);
                    }
                }
            }
        }

        // 3. Send notification email? (Optional but good practice)
        // For now, assuming standard confirmation email logic or silence.

        return;
    },
};
