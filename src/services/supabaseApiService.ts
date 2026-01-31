
import { supabase } from '../lib/supabaseClient';
import type { User, Role, Shift, Booking, Event, EventAdmin, DashboardMetrics, WaitlistEntry, Material, Stake } from '../types';
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
    stakeId: row.stake_id,
    ecclesiasticalPermission: row.ecclesiastical_permission,
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
    contactEmail: row.contact_email,
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
    isVisible: row.is_visible,
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
    shiftId: row.shift_id || undefined, // Maybe null if event-level registration
    eventId: row.event_id,
    status: row.status as any,
    attendance: row.attendance as any,
    foodDelivered: row.food_delivered,
    requestedAt: row.requested_at,
    cancelledAt: row.cancelled_at,
    // Relations must be joined if needed
    shift: row.shifts ? {
        ...mapShift(row.shifts),
        role: row.shifts.roles ? mapRole(row.shifts.roles) : undefined
    } : undefined,
    user: row.users ? mapUser(row.users) : undefined
});

const mapMaterial = (row: any): Material => ({
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    description: row.description,
    quantity: row.quantity,
    category: row.category,
    isRequired: row.is_required,
    createdAt: row.created_at,
});

const mapStake = (row: any): Stake => ({
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    createdAt: row.created_at,
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

        // Check if user is deleted
        if (userProfile.status === 'deleted') {
            // Fetch superadmins to notify
            const { data: superAdmins } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'superadmin');

            if (superAdmins) {
                // Must map to User type
                const admins = superAdmins.map(mapUser);
                emailService.sendDeletedUserLoginAlert(mapUser(userProfile), admins).catch(console.error);
            }

            throw new Error('Su cuenta esta en proceso de revision, el administrador del sistema le contactara.');
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

    register: async (newUser: User, eventId?: string): Promise<User> => {
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
                    stake_id: newUser.stakeId || null,
                    status: 'active', // Reactivate if it was deleted/suspended
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

        if (authError) {
            if (authError.message.includes("User already registered")) {
                throw new Error("El correo ya está registrado en el sistema de Autenticación (Auth), pero no tiene perfil de voluntario. Esto ocurre si el usuario fue eliminado de la base de datos manualmente pero no de la lista de usuarios autorizados. Por favor, elimine el usuario desde el panel de 'Authentication' en Supabase para poder registrarlo nuevamente.");
            }
            throw authError;
        }
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
            stake_id: newUser.stakeId || null,
            status: 'active'
        };

        const { data: profileData, error: profileError } = await supabase.from('users').insert(dbUser).select().single();

        // If profile creation fails, we should ideally rollback Auth (delete user), but for MVP just throw
        if (profileError) {
            console.error('Profile creation failed. Details:', {
                message: profileError.message,
                details: profileError.details,
                hint: profileError.hint,
                code: profileError.code
            });
            throw new Error(`Error creando perfil: ${profileError.message}`);
        }

        const registered = mapUser(profileData);

        // Send Welcome Email
        emailService.sendWelcomeEmail(registered, generatedPassword).catch(console.error);

        // AUTO-ENROLL IN EVENT IF PROVIDED
        if (eventId) {
            try {
                // Try to create a booking with NULL shift_id (General Registration)
                await supabase.from('bookings').insert({
                    id: `bk_gen_${Date.now()}`,
                    user_id: registered.id,
                    event_id: eventId,
                    shift_id: null,
                    status: 'confirmed',
                    requested_at: new Date().toISOString()
                });
            } catch (err) {
                console.warn('Could not auto-enroll user in event.', err);
            }
        }

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
            stake_id: updatedUser.stakeId || null,
            ecclesiastical_permission: updatedUser.ecclesiasticalPermission || 'pending',
            status: updatedUser.status
        };

        // REMOVED: potentially dangerous and error-prone client-side auth update.
        // Password updates should be handled via specific recovery or settings flows, not side-effect of profile update.
        /*
        if (updatedUser.password) {
            // ...
        }
        */

        const { data, error } = await supabase
            .from('users')
            .update(dbUser)
            .eq('id', updatedUser.id)
            .select()
            .single();

        if (error) throw error;

        // Check if user became suspended - NOW we keep bookings active as requested.
        // if (updatedUser.status === 'suspended') { ... }

        return mapUser(data);
    },

    deleteUser: async (userId: string): Promise<void> => {
        // 1. Fetch active confirmed bookings to process waitlist later
        const { data: confirmedBookings } = await supabase
            .from('bookings')
            .select('shift_id')
            .eq('user_id', userId)
            .eq('status', 'confirmed');

        // 2. Cancel ALL active bookings (confirmed, pending, waitlist, requested)
        // This releases the vacancies.
        await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('user_id', userId)
            .neq('status', 'cancelled');

        // 3. Process waitlist for shifts that had a confirmed booking cancelled
        if (confirmedBookings && confirmedBookings.length > 0) {
            const shiftIds = [...new Set(confirmedBookings.map(b => b.shift_id))];
            for (const shiftId of shiftIds) {
                await supabaseApi.processWaitlist(shiftId); // This assigns the slot to the next person
            }
        }

        // 4. Soft Delete: Mark as deleted to avoid Auth user conflict.
        // The user remains in DB but with status='deleted', and is filtered out from UI.
        const { error } = await supabase
            .from('users')
            .update({ status: 'deleted' })
            .eq('id', userId);

        if (error) throw error;
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

    getUsersByIds: async (userIds: string[]): Promise<User[]> => {
        if (!userIds || userIds.length === 0) return [];
        const { data, error } = await supabase.from('users').select('*').in('id', userIds);
        if (error) throw error;
        return (data || []).map(mapUser);
    },


    // ==================== EVENTS ====================
    getAllEvents: async (): Promise<Event[]> => {
        const { data: events, error } = await supabase.from('events').select('*');
        if (error) throw error;

        // Fetch active bookings to calculate volunteer counts
        // Using "confirmed" status to count actual volunteers
        const { data: bookings } = await supabase
            .from('bookings')
            .select('event_id, user_id')
            .eq('status', 'confirmed');

        const eventsWithCounts = events.map(event => {
            const mapped = mapEvent(event);

            // Calculate unique volunteers for this event
            if (bookings) {
                const eventBookings = bookings.filter(b => b.event_id === event.id);
                // Count unique userIds
                const uniqueUsers = new Set(eventBookings.map(b => b.user_id));
                mapped.voluntarios = uniqueUsers.size;
            }

            return mapped;
        });

        return eventsWithCounts;
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
            contact_email: eventData.contactEmail,
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
        if (updates.contactEmail !== undefined) dbUpdates.contact_email = updates.contactEmail;
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
            requires_approval: roleData.requiresApproval,
            is_visible: roleData.isVisible ?? true
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
        if (updates.isVisible !== undefined) dbUpdates.is_visible = updates.isVisible;

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
            // Also subtract assigned coordinators (if the shift is meant for them, this helps)
            // But usually coordinator assignment is separate from vacancies.
            // USER REQUEST: "no descontaste los turnos ocupados de coordinador" implies we should.
            const coordinatorCount = s.coordinator_ids ? s.coordinator_ids.length : 0;

            return {
                ...mapShift(s),
                availableVacancies: Math.max(0, s.total_vacancies - bookedCount - coordinatorCount)
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

    deleteShift: async (shiftId: string, force: boolean = false): Promise<void> => {
        const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('shift_id', shiftId).neq('status', 'cancelled');
        if (count && count > 0) {
            if (!force) {
                throw new Error('No se puede eliminar un turno con voluntarios inscritos');
            }
            // Cancel active bookings
            await supabase.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('shift_id', shiftId).neq('status', 'cancelled');
        }

        const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
        if (error) {
            // Handle FK violation (bookings still exist)
            if (error.code === '23503' && force) {
                // Hard delete bookings if we really want to delete the shift and FK restricts it
                // Or we could leave it if the user just wanted to cancel bookings? No, "permite borrarlo" implies deleting the shift.
                await supabase.from('bookings').delete().eq('shift_id', shiftId);
                // Retry delete
                const { error: retryError } = await supabase.from('shifts').delete().eq('id', shiftId);
                if (retryError) throw retryError;
            } else {
                throw error;
            }
        }
    },

    getEventShiftDates: async (eventId: string): Promise<string[]> => {
        const { data } = await supabase
            .from('shifts')
            .select('date')
            .eq('event_id', eventId);

        if (!data) return [];
        // Unique dates
        const dates = Array.from(new Set(data.map((d: any) => d.date)));
        return dates.sort();
    },

    assignCoordinatorToShift: async (shiftId: string, userId: string): Promise<Shift> => {
        const { data: shift } = await supabase.from('shifts').select('*').eq('id', shiftId).single();
        if (!shift) throw new Error('Turno no encontrado');

        // Update user role to coordinator
        await supabase.from('users').update({ role: 'coordinator' }).eq('id', userId);

        // Get ALL shifts with same date and time slot
        const { data: relatedShifts } = await supabase
            .from('shifts')
            .select('id, coordinator_ids')
            .eq('event_id', shift.event_id)
            .eq('date', shift.date)
            .eq('time_slot', shift.time_slot);

        if (relatedShifts && relatedShifts.length > 0) {
            // Update each shift to include this coordinator
            for (const relatedShift of relatedShifts) {
                const currentIds = relatedShift.coordinator_ids || [];
                if (!currentIds.includes(userId)) {
                    const newIds = [...currentIds, userId];
                    await supabase
                        .from('shifts')
                        .update({ coordinator_ids: newIds })
                        .eq('id', relatedShift.id);
                }
            }
        }

        return mapShift({ ...shift, coordinator_ids: [...(shift.coordinator_ids || []), userId] });
    },

    removeCoordinatorFromShift: async (shiftId: string, userId: string): Promise<Shift> => {
        const { data: shift } = await supabase.from('shifts').select('*').eq('id', shiftId).single();
        if (!shift) throw new Error('Turno no encontrado');

        // Get ALL shifts with same date and time slot
        const { data: relatedShifts } = await supabase
            .from('shifts')
            .select('id, coordinator_ids')
            .eq('event_id', shift.event_id)
            .eq('date', shift.date)
            .eq('time_slot', shift.time_slot);

        if (relatedShifts && relatedShifts.length > 0) {
            // Remove coordinator from each shift
            for (const relatedShift of relatedShifts) {
                const currentIds = relatedShift.coordinator_ids || [];
                const newIds = currentIds.filter((id: string) => id !== userId);

                if (currentIds.length !== newIds.length) {
                    await supabase
                        .from('shifts')
                        .update({ coordinator_ids: newIds })
                        .eq('id', relatedShift.id);
                }
            }
        }

        // Check if coordinator elsewhere.
        const { count: coordCount } = await supabase.from('shifts').select('*', { count: 'exact', head: true }).contains('coordinator_ids', [userId]);
        if (coordCount === 0) {
            await supabase.from('users').update({ role: 'volunteer' }).eq('id', userId);
        }

        // FAIL-SAFE: Check if user has ANY booking for this event. 
        // If not, create a General Registration so they don't disappear.
        const { count: bookingCount } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('event_id', shift.event_id)
            .neq('status', 'cancelled');

        // Also check if they are coordinator in other shifts of THIS event specifically (coordCount is global? No, shifts table mix events? Yes.)
        const { count: eventCoordCount } = await supabase
            .from('shifts')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', shift.event_id)
            .contains('coordinator_ids', [userId]);

        if (bookingCount === 0 && eventCoordCount === 0) {
            // Create a general enrollment
            const generalBookingId = `booking_${Date.now()}_general`;
            await supabase.from('bookings').insert({
                id: generalBookingId,
                user_id: userId,
                event_id: shift.event_id,
                shift_id: null,
                status: 'confirmed',
                requested_at: new Date().toISOString()
            });
        }

        return mapShift({ ...shift, coordinator_ids: (shift.coordinator_ids || []).filter((id: string) => id !== userId) });
    },


    // ==================== BOOKINGS ====================
    createBooking: async (userId: string, shiftId: string): Promise<Booking> => {
        // 1. Obtener datos del turno y rol
        const { data: shift } = await supabase.from('shifts').select('*').eq('id', shiftId).single();
        if (!shift) throw new Error("Turno no encontrado.");

        const { data: role } = await supabase.from('roles').select('*').eq('id', shift.role_id).single();

        // Determinar estado inicial
        const initialStatus = role?.requires_approval ? 'pending_approval' : 'confirmed';

        let bookingId: string | undefined;

        // 2. Intentar reserva OPTIMIZADA (RPC)
        // Intentamos usar la función de base de datos para máxima concurrencia
        const { data: rpcResult, error: rpcError } = await supabase.rpc('book_shift', {
            p_user_id: userId,
            p_shift_id: shiftId,
            p_status: initialStatus
        });

        // 3. Manejo de resultados RPC
        if (!rpcError) {
            // El RPC se ejecutó correctamente (exito o rechazo lógico)
            if (!rpcResult.success) {
                if (rpcResult.code === 'FULL') {
                    // Lógica de lista de espera
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
                    await supabase.from('bookings').insert(newBooking);
                    throw new Error("No hay vacantes disponibles. Te agregamos a la lista de espera.");
                } else {
                    throw new Error(rpcResult.message);
                }
            } else {
                // Éxito RPC
                console.log("%c✅ [DEBUG] Inscripción procesada con RPC (Método Seguro)", "color: green; font-weight: bold; font-size: 12px;");
                bookingId = rpcResult.booking_id;
            }
        } else {
            // FALLBACK: Si falla el RPC (ej: función no existe), usamos lógica manual (Legacy)
            console.log("%c⚠️ [DEBUG] RPC falló. Usando método FALLBACK (Legacy)", "color: orange; font-weight: bold; font-size: 12px;", rpcError);
            console.warn("Detalle error RPC:", rpcError);

            // A. Check existing
            const { data: existing } = await supabase
                .from('bookings')
                .select('*')
                .eq('user_id', userId)
                .eq('shift_id', shiftId)
                .neq('status', 'cancelled')
                .maybeSingle();

            if (existing) throw new Error("Ya estás inscripto en este turno.");

            // B. Check concurrency manually (Not atomic, but better than fail)
            const { count } = await supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('shift_id', shiftId)
                .eq('status', 'confirmed');

            if (count !== null && count >= shift.total_vacancies) {
                // Waitlist Logic Duplicated
                const { count: posCount } = await supabase.from('waitlist').select('*', { count: 'exact', head: true }).eq('shift_id', shiftId);
                const position = (posCount || 0) + 1;

                await supabase.from('waitlist').insert({
                    id: `wl_${Date.now()}`,
                    user_id: userId,
                    shift_id: shiftId,
                    event_id: shift.event_id,
                    position: position
                });

                const newBooking = {
                    id: `booking_${Date.now()}`,
                    user_id: userId,
                    shift_id: shiftId,
                    event_id: shift.event_id,
                    status: 'waitlist',
                    requested_at: new Date().toISOString()
                };
                await supabase.from('bookings').insert(newBooking);
                throw new Error("No hay vacantes disponibles. Te agregamos a la lista de espera.");
            }

            // C. Insert Manual
            const newBooking = {
                id: `booking_${Date.now()}`,
                user_id: userId,
                shift_id: shiftId,
                event_id: shift.event_id,
                status: initialStatus,
                requested_at: new Date().toISOString()
            };

            const { data: bookingData, error: insertError } = await supabase.from('bookings').insert(newBooking).select().single();
            if (insertError) throw new Error("Error técnico al inscribir (Fallback).");
            bookingId = bookingData.id;
        }

        // 4. Lógica Post-Inscripción Común
        if (!bookingId) throw new Error("Error inesperado: No se pudo confirmar la reserva.");

        const { data: bookingData } = await supabase.from('bookings').select('*').eq('id', bookingId).single();

        // Auto-assign coordinators
        if (role && role.name.toLowerCase().includes('coordinador')) {
            try {
                // Get all shifts with same date and time slot
                const { data: relatedShifts } = await supabase
                    .from('shifts')
                    .select('id, coordinator_ids')
                    .eq('event_id', shift.event_id)
                    .eq('date', shift.date)
                    .eq('time_slot', shift.time_slot);

                if (relatedShifts && relatedShifts.length > 0) {
                    // Update each shift to include this coordinator
                    for (const relatedShift of relatedShifts) {
                        const currentIds = relatedShift.coordinator_ids || [];
                        if (!currentIds.includes(userId)) {
                            const newIds = [...currentIds, userId];
                            await supabase
                                .from('shifts')
                                .update({ coordinator_ids: newIds })
                                .eq('id', relatedShift.id);
                        }
                    }
                }
            } catch (error) {
                console.error('Error auto-assigning coordinator:', error);
            }
        }

        // Email Notification
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

    enrollUserInEvent: async (userId: string, eventId: string): Promise<Booking> => {
        // Check if already enrolled
        const { data: existing } = await supabase
            .from('bookings')
            .select('*')
            .eq('user_id', userId)
            .eq('event_id', eventId)
            .neq('status', 'cancelled')
            .maybeSingle();

        if (existing) throw new Error("El usuario ya está inscripto en este evento.");

        const newBooking = {
            id: `bk_man_${Date.now()}`,
            user_id: userId,
            event_id: eventId,
            shift_id: null,
            status: 'confirmed',
            requested_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('bookings').insert(newBooking).select().single();
        if (error) throw error;
        return mapBooking(data);
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

    getBookingsForShifts: async (shiftIds: string[]): Promise<Booking[]> => {
        if (!shiftIds || shiftIds.length === 0) return [];
        const { data } = await supabase
            .from('bookings')
            .select('*, users(*), shifts(*, roles(*))')
            .in('shift_id', shiftIds)
            .eq('status', 'confirmed');

        if (!data) return [];

        return data.map((b: any) => {
            const booking = mapBooking(b);
            booking.user = b.users ? mapUser(b.users) : undefined;
            if (b.shifts) {
                booking.shift = mapShift(b.shifts) as Shift & { role: Role };
                if (b.shifts.roles) {
                    booking.shift.role = mapRole(b.shifts.roles);
                }
            }
            return booking;
        });
    },

    requestBookingCancellation: async (bookingId: string): Promise<Booking> => {
        const { data: booking } = await supabase.from('bookings').select('*, shifts(*), events(*)').eq('id', bookingId).single();
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

    adminCancelBooking: async (bookingId: string): Promise<void> => {
        const { data: booking } = await supabase.from('bookings').select('*, shifts(*), events(*), users(*)').eq('id', bookingId).single();
        if (!booking) throw new Error("Inscripción no encontrada.");

        const cancelledAt = new Date().toISOString();

        // 1. Mark as cancelled
        await supabase.from('bookings').update({ status: 'cancelled', cancelled_at: cancelledAt }).eq('id', bookingId);

        // 1.5. Auto-remove from coordinator_ids if role is coordinator
        // Remove from ALL shifts with the same date and time slot
        if (booking.shifts) {
            const { data: role } = await supabase.from('roles').select('*').eq('id', booking.shifts.role_id).single();
            if (role && role.name.toLowerCase().includes('coordinador')) {
                try {
                    // Get all shifts with same date and time slot
                    const { data: relatedShifts } = await supabase
                        .from('shifts')
                        .select('id, coordinator_ids')
                        .eq('event_id', booking.event_id)
                        .eq('date', booking.shifts.date)
                        .eq('time_slot', booking.shifts.time_slot);

                    if (relatedShifts && relatedShifts.length > 0) {
                        console.log(`✅ Found ${relatedShifts.length} shifts with date ${booking.shifts.date} and time ${booking.shifts.time_slot}`);

                        // Remove coordinator from each shift
                        for (const relatedShift of relatedShifts) {
                            const currentIds = relatedShift.coordinator_ids || [];
                            const newIds = currentIds.filter((id: string) => id !== booking.user_id);

                            if (currentIds.length !== newIds.length) {
                                await supabase
                                    .from('shifts')
                                    .update({ coordinator_ids: newIds })
                                    .eq('id', relatedShift.id);

                                console.log(`✅ Removed coordinator ${booking.user_id} from shift ${relatedShift.id}`);
                            }
                        }

                        console.log(`✅ Auto-removed user ${booking.user_id} as coordinator from ${relatedShifts.length} shifts`);
                    }
                } catch (error) {
                    console.error('Error auto-removing coordinator:', error);
                }
            }
        }

        // 2. Process waitlist to fill the spot
        await supabaseApi.processWaitlist(booking.shift_id);

        // 3. Send email to user
        if (booking.users && booking.events && booking.shifts) {
            emailService.sendBookingCancelledByAdmin(
                mapUser(booking.users),
                booking.events.nombre,
                booking.shifts.date,
                booking.shifts.time_slot
            ).catch(console.error);
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

    updateBookingFoodStatus: async (bookingId: string, delivered: boolean): Promise<void> => {
        const { error } = await supabase.from('bookings').update({ food_delivered: delivered }).eq('id', bookingId);
        if (error) throw error;
    },

    getUserEvents: async (userId: string): Promise<Event[]> => {
        const { data: bookings } = await supabase
            .from('bookings')
            .select('event_id, events(*)')
            .eq('user_id', userId)
            .neq('status', 'cancelled');

        if (!bookings) return [];

        // Deduplicate events
        const eventsMap = new Map();
        bookings.forEach((b: any) => {
            if (b.events) {
                eventsMap.set(b.events.id, mapEvent(b.events));
            }
        });

        // Also check if they are coordinator in any shift of any event
        const { data: coordShifts } = await supabase
            .from('shifts')
            .select('event_id, events(*)')
            .contains('coordinator_ids', [userId]);

        if (coordShifts) {
            coordShifts.forEach((s: any) => {
                if (s.events) {
                    eventsMap.set(s.events.id, mapEvent(s.events));
                }
            });
        }

        return Array.from(eventsMap.values());
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
        const { data: userMaterials } = await supabase.from('user_materials').select('user_id').eq('event_id', eventId);

        if (!shifts || !bookings || !roles || !users || !userMaterials) {
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
                materialsDeliveryPercentage: 0,
                ecclesiasticalApprovalPercentage: 0,
            };
        }

        // Pre-calculate occupancy including coordinators (deduplicated per shift)
        let totalOccupiedSlots = 0;
        const allOccupantIds = new Set<string>();

        shifts.forEach(shift => {
            const shiftBookings = bookings.filter(b => b.shift_id === shift.id);
            const shiftBookedIds = shiftBookings.map(b => b.user_id);
            const shiftCoordIds = shift.coordinator_ids || [];

            // Deduplicate: User booked AND assigned as coordinator in SAME shift counts as 1 slot usage
            const uniqueShiftOccupants = new Set([...shiftBookedIds, ...shiftCoordIds]);
            totalOccupiedSlots += uniqueShiftOccupants.size;

            uniqueShiftOccupants.forEach(id => allOccupantIds.add(id));
        });

        const totalVacancies = shifts.reduce((sum, s) => sum + s.total_vacancies, 0);
        const occupiedVacancies = totalOccupiedSlots;
        const availableVacancies = Math.max(0, totalVacancies - occupiedVacancies);
        const occupationPercentage = totalVacancies > 0 ? Math.round((occupiedVacancies / totalVacancies) * 100) : 0;

        const uniqueVolunteers = allOccupantIds.size;
        const avgShiftsPerVolunteer = uniqueVolunteers > 0 ? (occupiedVacancies / uniqueVolunteers).toFixed(1) : 0;

        const pendingCancellations = allBookings ? allBookings.filter(b => b.status === 'cancellation_requested').length : 0;
        const pendingCoordinatorRequests = allBookings ? allBookings.filter(b => b.status === 'pending_approval').length : 0;
        const waitlistCount = waitlist ? waitlist.length : 0;

        // Distribution
        const roleDistribution = bookings.reduce((acc: any[], b) => {
            const shift = shifts.find(s => s.id === b.shift_id);
            const role = roles.find(r => r.id === shift?.role_id);
            if (role) {
                const existing = acc.find((r: any) => r.roleName === role.name);
                if (existing) {
                    existing.count++;
                } else {
                    acc.push({ roleName: role.name, count: 1, color: '#4F46E5' }); // default color
                }
            }
            return acc;
        }, []);

        // Add Coordinators to distribution (those who don't have a booking)
        const unbookedCoordsPerShift: { shift: any, userId: string }[] = [];
        shifts.forEach(s => {
            const shiftBookings = bookings.filter(b => b.shift_id === s.id);
            const bookedUserIds = shiftBookings.map(b => b.user_id);
            const coordIds = s.coordinator_ids || [];

            coordIds.forEach(cId => {
                if (!bookedUserIds.includes(cId)) {
                    unbookedCoordsPerShift.push({ shift: s, userId: cId });
                }
            });
        });

        // Add unbooked coords to role distribution
        unbookedCoordsPerShift.forEach(item => {
            const role = roles.find(r => r.id === item.shift.role_id);
            if (role) {
                const existing = roleDistribution.find((r: any) => r.roleName === role.name);
                if (existing) {
                    existing.count++;
                } else {
                    roleDistribution.push({ roleName: role.name, count: 1, color: '#10B981' });
                }
            }
        });


        // Daily Occupation
        const uniqueDates = [...new Set(shifts.map(s => s.date))].sort();
        const dailyOccupation = uniqueDates.map(date => {
            const dateShifts = shifts.filter(s => s.date === date);
            let dateOccupied = 0;
            let dateTotal = 0;

            dateShifts.forEach(shift => {
                const shiftBookings = bookings.filter(b => b.shift_id === shift.id);
                const shiftBookedIds = shiftBookings.map(b => b.user_id);
                const shiftCoordIds = shift.coordinator_ids || [];
                const uniqueShiftOccupants = new Set([...shiftBookedIds, ...shiftCoordIds]).size;

                dateOccupied += uniqueShiftOccupants;
                dateTotal += shift.total_vacancies;
            });

            const occupation = dateTotal > 0 ? Math.round((dateOccupied / dateTotal) * 100) : 0;
            return { date, occupation };
        });

        // Shift Occupation
        const shiftOccupation: Record<string, number> = {};
        const uniqueTimeSlots = [...new Set(shifts.map(s => s.time_slot))].sort();
        uniqueTimeSlots.forEach(slot => {
            const slotShifts = shifts.filter(s => s.time_slot === slot);
            let slotOccupied = 0;
            let slotTotal = 0;

            slotShifts.forEach(shift => {
                const shiftBookings = bookings.filter(b => b.shift_id === shift.id);
                const shiftBookedIds = shiftBookings.map(b => b.user_id);
                const shiftCoordIds = shift.coordinator_ids || [];
                const uniqueShiftOccupants = new Set([...shiftBookedIds, ...shiftCoordIds]).size;

                slotOccupied += uniqueShiftOccupants;
                slotTotal += shift.total_vacancies;
            });

            shiftOccupation[slot] = slotTotal > 0 ? Math.round((slotOccupied / slotTotal) * 100) : 0;
        });

        // Attendance
        const attendedCount = bookings.filter(b => b.attendance === 'attended').length;
        const absentCount = bookings.filter(b => b.attendance === 'absent').length;
        const totalMarked = attendedCount + absentCount;
        const attendancePercentage = totalMarked > 0 ? Math.round((attendedCount / totalMarked) * 100) : 0;

        // Experience
        let experiencedCount = 0;
        let approvedEcclesiasticalCount = 0;

        allOccupantIds.forEach(uid => {
            const u = users.find(user => user.id === uid);
            if (u) {
                if (u.attended_previous) experiencedCount++;
                if (u.ecclesiastical_permission === 'verified') approvedEcclesiasticalCount++;
            }
        });
        const previousExperiencePercentage = uniqueVolunteers > 0 ? Math.round((experiencedCount / uniqueVolunteers) * 100) : 0;
        const ecclesiasticalApprovalPercentage = uniqueVolunteers > 0 ? Math.round((approvedEcclesiasticalCount / uniqueVolunteers) * 100) : 0;

        // Materials
        const uniqueMaterialRecipients = new Set((userMaterials || []).map(m => m.user_id)).size;
        const materialsDeliveryPercentage = uniqueVolunteers > 0 ? Math.round((uniqueMaterialRecipients / uniqueVolunteers) * 100) : 0;

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
            materialsDeliveryPercentage,
            ecclesiasticalApprovalPercentage
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

            // 3. Add user to coordinator_ids for ALL shifts with same date and time slot
            if (booking.shift_id && booking.shifts) {
                // Get all shifts with same date and time slot
                const { data: relatedShifts } = await supabase
                    .from('shifts')
                    .select('id, coordinator_ids')
                    .eq('event_id', booking.event_id)
                    .eq('date', booking.shifts.date)
                    .eq('time_slot', booking.shifts.time_slot);

                if (relatedShifts && relatedShifts.length > 0) {
                    // Update each shift to include this coordinator
                    for (const relatedShift of relatedShifts) {
                        const currentIds = relatedShift.coordinator_ids || [];
                        if (!currentIds.includes(booking.user_id)) {
                            const newIds = [...currentIds, booking.user_id];
                            await supabase
                                .from('shifts')
                                .update({ coordinator_ids: newIds })
                                .eq('id', relatedShift.id);
                        }
                    }
                }
            }
        }

        // 3. Send notification email? (Optional but good practice)
        // For now, assuming standard confirmation email logic or silence.

        return;
    },

    rejectCoordinatorRequest: async (bookingId: string): Promise<void> => {
        const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
        if (error) throw error;
    },

    // ==================== MATERIALS ====================
    getMaterialsByEvent: async (eventId: string): Promise<Material[]> => {
        const { data, error } = await supabase.from('materials').select('*').eq('event_id', eventId);
        if (error) throw error;
        return data.map(mapMaterial);
    },

    createMaterial: async (material: Omit<Material, 'id' | 'createdAt'>): Promise<Material> => {
        const dbMaterial = {
            event_id: material.eventId,
            name: material.name,
            description: material.description,
            quantity: material.quantity,
            category: material.category,
            is_required: material.isRequired
        };
        const { data, error } = await supabase.from('materials').insert(dbMaterial).select().single();
        if (error) throw error;
        return mapMaterial(data);
    },

    updateMaterial: async (id: string, updates: Partial<Material>): Promise<Material> => {
        const dbUpdates: any = {};
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.description) dbUpdates.description = updates.description;
        if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
        if (updates.category) dbUpdates.category = updates.category;
        if (updates.isRequired !== undefined) dbUpdates.is_required = updates.isRequired;

        const { data, error } = await supabase.from('materials').update(dbUpdates).eq('id', id).select().single();
        if (error) throw error;
        return mapMaterial(data);
    },

    deleteMaterial: async (id: string): Promise<void> => {
        const { error } = await supabase.from('materials').delete().eq('id', id);
        if (error) throw error;
    },

    // ==================== DELIVERY ====================
    getUserMaterials: async (eventId: string): Promise<{ user_id: string; material_id: string }[]> => {
        const { data, error } = await supabase.from('user_materials').select('*').eq('event_id', eventId);
        if (error) {
            // If table doesn't exist, return empty (for now)
            if (error.code === '42P01') return [];
            throw error;
        }
        return data || [];
    },

    toggleUserMaterial: async (eventId: string, userId: string, materialId: string, delivered: boolean): Promise<void> => {
        if (delivered) {
            const { error } = await supabase.from('user_materials').insert({ event_id: eventId, user_id: userId, material_id: materialId });
            if (error && error.code !== '23505') throw error; // Ignore 23505 (unique violation)
        } else {
            const { error } = await supabase.from('user_materials').delete().match({ event_id: eventId, user_id: userId, material_id: materialId });
            if (error) throw error;
        }
    },

    // ==================== COORDINATOR MANAGEMENT ====================
    addCoordinatorToShift: async (shiftId: string, userId: string): Promise<void> => {
        // Fetch current shift
        const { data: shift } = await supabase
            .from('shifts')
            .select('coordinator_ids')
            .eq('id', shiftId)
            .single();

        if (!shift) throw new Error('Shift not found');

        const currentIds = shift.coordinator_ids || [];
        if (currentIds.includes(userId)) return; // Already added

        const newIds = [...currentIds, userId];
        const { error } = await supabase
            .from('shifts')
            .update({ coordinator_ids: newIds })
            .eq('id', shiftId);

        if (error) throw error;
    },


    // ==================== STAKES ====================
    getStakesByEvent: async (eventId: string): Promise<Stake[]> => {
        const { data, error } = await supabase.from('stakes').select('*').eq('event_id', eventId);
        if (error) throw error;
        return (data || []).map(mapStake);
    },

    createStake: async (stake: Omit<Stake, 'id' | 'createdAt'>): Promise<Stake> => {
        const dbStake = {
            event_id: stake.eventId,
            name: stake.name,
        };
        const { data, error } = await supabase.from('stakes').insert(dbStake).select().single();
        if (error) throw error;
        return mapStake(data);
    },

    deleteStake: async (id: string): Promise<void> => {
        const { error } = await supabase.from('stakes').delete().eq('id', id);
        if (error) throw error;
    },

    getVolunteersByEventStakes: async (eventId: string): Promise<User[]> => {
        // 1. Obtener todas las estacas del evento
        const { data: stakes, error: stakeError } = await supabase
            .from('stakes')
            .select('id')
            .eq('event_id', eventId);

        if (stakeError) throw stakeError;
        if (!stakes || stakes.length === 0) return [];

        const stakeIds = stakes.map(s => s.id);

        // 2. Obtener usuarios asociados a esas estacas
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('*')
            .in('stake_id', stakeIds);

        if (userError) throw userError;
        return (users || []).map(mapUser);
    },
};
