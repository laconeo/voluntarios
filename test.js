// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
var supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.warn("Missing Supabase URL or Anon Key. Please check your .env file.");
}
var supabase = createClient(supabaseUrl || "", supabaseKey || "");

// src/services/emailService.ts
var PUBLIC_KEY = "3OJkvoQ7fpMgoTjra";
var SERVICE_ID = "service_yx5vrg8";
var TEMPLATE_ID = "template_hg6gecb";
var sendEmail = async (payload) => {
  if (!SERVICE_ID || !TEMPLATE_ID) {
    console.warn("\u26A0\uFE0F Falta configuraci\xF3n de EmailJS (SERVICE_ID o TEMPLATE_ID) en .env.local");
    return;
  }
  const templateParams = {
    email: payload.to[0].email,
    to_name: payload.to[0].name,
    subject: `Voluntarios FamilySearch - ${payload.subject}`,
    html_content: payload.htmlContent
  };
  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        service_id: SERVICE_ID,
        template_id: TEMPLATE_ID,
        user_id: PUBLIC_KEY,
        template_params: templateParams
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error EmailJS: ${errorText}`);
    }
  } catch (error) {
    console.error("\u274C Error al enviar email:", error);
  }
};
var emailService = {
  // 1. Registro (CU-01)
  sendWelcomeEmail: async (user, password) => {
    const subject = "\xA1Bienvenido al equipo!";
    const htmlContent = `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #8CB83E;">\xA1Bienvenido, ${user.fullName.split(" ")[0]}!</h1>
        <p>Gracias por unirte a nuestro equipo de voluntarios. Estamos emocionados de contar contigo.</p>
        
        ${password ? `
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold;">Tus credenciales de acceso:</p>
          <p style="margin: 10px 0;">\u{1F4E7} Email: ${user.email}</p>
          <p style="margin: 0;">\u{1F511} Contrase\xF1a: <strong style="font-size: 1.2em; color: #8CB83E;">${password}</strong></p>
        </div>
        <p>Por favor, guarda esta contrase\xF1a en un lugar seguro. Podr\xE1s usarla para ingresar al portal y gestionar tus turnos.</p>
        ` : `
        <p>Tu registro ha sido exitoso.</p>
        `}

        <div style="text-align: center; margin-top: 30px;">
          <a href="https://laconeo.github.io/voluntarios/" style="background-color: #8CB83E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ir al Portal</a>
        </div>
      </div>
    `;
    await sendEmail({
      to: [{ email: user.email, name: user.fullName }],
      subject,
      htmlContent
    });
  },
  // 2. Confirmación de Turno (CU-04)
  sendBookingConfirmation: async (user, event, roleName, date, time) => {
    const subject = `Confirmaci\xF3n de Turno - ${event.nombre}`;
    let googleUrl = "#";
    let outlookUrl = "#";
    try {
      const parts = time.split(/-|–/).map((t) => t.trim());
      const startTime = parts[0];
      const endTime = parts[1] || startTime;
      const d = /* @__PURE__ */ new Date(date + "T" + startTime + ":00");
      const dEnd = /* @__PURE__ */ new Date(date + "T" + endTime + ":00");
      const format = (dateObj) => {
        const pad = (n) => n < 10 ? "0" + n : n.toString();
        return dateObj.getFullYear() + pad(dateObj.getMonth() + 1) + pad(dateObj.getDate()) + "T" + pad(dateObj.getHours()) + pad(dateObj.getMinutes()) + "00";
      };
      const startStr = format(d);
      const endStr = format(dEnd);
      const title = encodeURIComponent(`Voluntariado: ${event.nombre} - ${roleName}`);
      const details = encodeURIComponent(`Turno de voluntariado para ${event.nombre}.
Rol: ${roleName}
Ubicaci\xF3n: ${event.ubicacion}`);
      const loc = encodeURIComponent(event.ubicacion);
      googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${loc}`;
      outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${details}&startdt=${d.toISOString()}&enddt=${dEnd.toISOString()}&location=${loc}`;
    } catch (e) {
      console.error("Error generating calendar links", e);
    }
    const htmlContent = `
      <h1>Turno Confirmado</h1>
      <p>Hola ${user.fullName.split(" ")[0]}, tu inscripci\xF3n ha sido guardada con \xE9xito.</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Evento:</strong> ${event.nombre}</p>
        <p><strong>Rol:</strong> ${roleName}</p>
        <p><strong>Fecha:</strong> ${date}</p>
        <p><strong>Horario:</strong> ${time}</p>
        <p><strong>Ubicaci\xF3n:</strong> ${event.ubicacion}</p>
      </div>
      <p><strong>Agendar:</strong> <a href="${googleUrl}" target="_blank">Agregar a Google Calendar</a> | <a href="${outlookUrl}" target="_blank">Outlook</a></p>
      
      <div style="margin: 20px 0;">
        <a href="https://laconeo.github.io/voluntarios/" style="background-color: #8CB83E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ir a la Aplicaci\xF3n</a>
      </div>

    `;
    await sendEmail({
      to: [{ email: user.email, name: user.fullName }],
      subject,
      htmlContent
    });
  },
  // 3. Solicitud de Baja (CU-05) - Para el voluntario
  sendCancellationRequestReceived: async (user, eventName, date, time) => {
    const subject = "Hemos recibido tu solicitud de baja";
    const htmlContent = `
      <p>Hola ${user.fullName.split(" ")[0]},</p>
      <p>Hemos recibido tu solicitud para cancelar tu turno en <strong>${eventName}</strong> el ${date} a las ${time}.</p>
      <p>Tu solicitud est\xE1 <strong>pendiente de aprobaci\xF3n</strong> por un coordinador. Sigues figurando como responsable del turno hasta que recibas la confirmaci\xF3n de la baja.</p>
    `;
    await sendEmail({
      to: [{ email: user.email, name: user.fullName }],
      subject,
      htmlContent
    });
  },
  // 4. Aprobación de Baja (CU-06)
  sendCancellationApproved: async (user, eventName, date) => {
    const subject = "Tu baja ha sido aprobada";
    const htmlContent = `
      <p>Hola ${user.fullName.split(" ")[0]},</p>
      <p>Te confirmamos que tu solicitud de baja para el evento <strong>${eventName}</strong> del d\xEDa ${date} ha sido aprobada.</p>
      <p>La vacante ha sido liberada. \xA1Gracias por avisar!</p>
    `;
    await sendEmail({
      to: [{ email: user.email, name: user.fullName }],
      subject,
      htmlContent
    });
  },
  sendCancellationRejected: async (user, eventName, date, time) => {
    const subject = "Informaci\xF3n sobre tu solicitud de baja";
    const htmlContent = `
            <p>Hola ${user.fullName.split(" ")[0]},</p>
            <p>Te informamos que tu solicitud de baja para el evento <strong>${eventName}</strong> del d\xEDa ${date} a las ${time} no ha podido ser procesada en este momento.</p>
            <p><strong>Por lo tanto, tu turno sigue vigente.</strong></p>
            <p>Si tienes alguna duda, por favor comun\xEDcate con tu coordinador.</p>
            <div style="margin: 20px 0;">
                <a href="https://laconeo.github.io/voluntarios/" style="background-color: #8CB83E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Revisar mis Turnos</a>
            </div>
        `;
    await sendEmail({
      to: [{ email: user.email, name: user.fullName }],
      subject,
      htmlContent
    });
  },
  // 5. Modificación Crítica de Turno (CU-02)
  sendShiftModificationAlert: async (user, eventName, oldTime, newTime, date) => {
    const subject = "URGENTE: Cambio en tu turno programado";
    const htmlContent = `
      <h2 style="color: #dc2626;">\xA1Atenci\xF3n! Cambio de Horario</h2>
      <p>Hola ${user.fullName.split(" ")[0]},</p>
      <p>El coordinador ha modificado los horarios del evento <strong>${eventName}</strong> para el d\xEDa ${date}.</p>
      <div style="background-color: #fff1f2; padding: 15px; border-radius: 8px; border-left: 4px solid #f43f5e;">
        <p><strong>Tu turno ha cambiado:</strong></p>
        <p>Horario Anterior: <span style="text-decoration: line-through; color: #999;">${oldTime}</span></p>
        <p>Nuevo Horario: <strong>${newTime}</strong></p>
      </div>
      <p>Si no puedes asistir en este nuevo horario, por favor ingresa al portal para gestionar tu baja.</p>
    `;
    await sendEmail({
      to: [{ email: user.email, name: user.fullName }],
      subject,
      htmlContent
    });
  },
  // 6. Recordatorio (Simulado)
  sendReminderEmail: async (user, eventName, roleName, date, time, location) => {
    const subject = "Recordatorio: Tu turno es ma\xF1ana";
    const htmlContent = `
      <h1>\xA1Te esperamos ma\xF1ana!</h1>
      <p>Hola ${user.fullName.split(" ")[0]}, recuerda que tienes un turno programado.</p>
      <ul>
        <li><strong>Evento:</strong> ${eventName}</li>
        <li><strong>Rol:</strong> ${roleName}</li>
        <li><strong>Horario:</strong> ${time} (${date})</li>
        <li><strong>Lugar:</strong> ${location}</li>
      </ul>
      <p>Recuerda llevar ropa c\xF3moda y tu mejor sonrisa :)</p>
     `;
    await sendEmail({
      to: [{ email: user.email, name: user.fullName }],
      subject,
      htmlContent
    });
  },
  // 7. Agradecimiento por Asistencia
  sendAttendanceThankYou: async (user, eventName, roleName, date, time) => {
    const subject = "\xA1Muchas gracias por tu servicio hoy!";
    const htmlContent = `
      <h1>\xA1Gracias ${user.fullName.split(" ")[0]}!</h1>
      <p>Queremos agradecerte sinceramente por tu tiempo y dedicaci\xF3n en el evento <strong>${eventName}</strong>.</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Detalles del Turno:</strong></p>
        <p>Rol: ${roleName}</p>
        <p>Fecha: ${date}</p>
        <p>Horario: ${time}</p>
      </div>
      <p>Tu servicio ha sido fundamental para el \xE9xito de hoy.</p>
      <p>Esperamos contar contigo nuevamente.</p>
      <p><em>"Cuando estamos al servicio de nuestros semejantes, solo estamos al servicio de nuestro Dios."</em></p>
      <div style="margin: 20px 0;">
         <a href="https://laconeo.github.io/voluntarios/" style="background-color: #8CB83E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ir al Portal</a>
      </div>
     `;
    await sendEmail({
      to: [{ email: user.email, name: user.fullName }],
      subject,
      htmlContent
    });
  },
  // 8. Seguimiento de Ausencia
  sendAbsenceFollowUp: async (user, eventName, date, time) => {
    const subject = "Te extra\xF1amos hoy";
    const htmlContent = `
      <h1>\xA1Hola ${user.fullName.split(" ")[0]}!</h1>
      <p>Notamos que no pudiste asistir a tu turno programado para hoy en <strong>${eventName}</strong>.</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Detalles del Turno:</strong></p>
        <p>Fecha: ${date}</p>
        <p>Horario: ${time}</p>
      </div>
      <p>Te echamos de menos en el equipo y esperamos verte en una pr\xF3xima oportunidad.</p>
      <div style="margin: 20px 0;">
         <a href="https://laconeo.github.io/voluntarios/" style="background-color: #8CB83E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Revisar mis turnos</a>
      </div>
     `;
    await sendEmail({
      to: [{ email: user.email, name: user.fullName }],
      subject,
      htmlContent
    });
  },
  // 9. Cancelación por Administrador
  sendBookingCancelledByAdmin: async (user, eventName, date, time) => {
    const subject = "Aviso: Tu turno ha sido cancelado";
    const htmlContent = `
      <p>Hola ${user.fullName.split(" ")[0]},</p>
      <p>Te informamos que tu turno en el evento <strong>${eventName}</strong> ha sido cancelado por un administrador.</p>
      <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #ef4444;">
        <p><strong>Detalles del turno removido:</strong></p>
        <p>Fecha: ${date}</p>
        <p>Horario: ${time}</p>
      </div>
      <p>Ya no tienes este compromiso asignado en tu calendario.</p>
      <p>Si crees que esto es un error, por favor contacta a tu coordinador.</p>
      <div style="margin: 20px 0;">
         <a href="https://laconeo.github.io/voluntarios/" style="background-color: #8CB83E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver mis turnos actuales</a>
      </div>
     `;
    await sendEmail({
      to: [{ email: user.email, name: user.fullName }],
      subject,
      htmlContent
    });
  },
  // 9. Recuperación de Contraseña (Solicitado por User)
  sendPasswordRecovery: async (user) => {
    const subject = "Recuperaci\xF3n de Contrase\xF1a";
    const htmlContent = `
            <h1>Hola ${user.fullName.split(" ")[0]}</h1>
            <p>Has solicitado recuperar tu contrase\xF1a para acceder al sistema de gesti\xF3n de voluntarios.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center;">
                <p>Tu contrase\xF1a actual es:</p>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${user.password}</p>
            </div>
            <p>Te recomendamos eliminar este correo despu\xE9s de iniciar sesi\xF3n por seguridad.</p>
            <div style="margin: 20px 0;">
                 <a href="https://laconeo.github.io/voluntarios/" style="background-color: #8CB83E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ir a Iniciar Sesi\xF3n</a>
            </div>
        `;
    await sendEmail({
      to: [{ email: user.email, name: user.fullName }],
      subject,
      htmlContent
    });
  },
  // 10. Envío de credenciales para Admin/Coordinador
  sendAdminCredentials: async (user, passwordStr) => {
    const subject = "Asignaci\xF3n de Rol y Credenciales";
    const roleLabel = user.role === "admin" ? "Administrador" : user.role === "coordinator" ? "Coordinador" : "Usuario";
    const htmlContent = `
            <h1>Hola ${user.fullName.split(" ")[0]}</h1>
            <p>Se te ha asignado el rol de <strong>${roleLabel}</strong> en la plataforma de voluntarios.</p>
            <p>A continuaci\xF3n tus credenciales para ingresar:</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p><strong>Usuario (DNI o Email):</strong> ${user.dni || user.email}</p>
                <p><strong>Contrase\xF1a:</strong> ${passwordStr}</p>
            </div>
            <p>Por favor, ingresa al sistema y gestiona tus tareas.</p>
            <div style="margin: 20px 0;">
                 <a href="https://laconeo.github.io/voluntarios/" style="background-color: #8CB83E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ingresar al Sistema</a>
            </div>
        `;
    await sendEmail({
      to: [{ email: user.email, name: user.fullName }],
      subject,
      htmlContent
    });
  },
  // 11. Alerta de intento de login de usuario eliminado
  sendDeletedUserLoginAlert: async (user, superAdmins) => {
    if (superAdmins.length === 0) return;
    const subject = "ALERTA: Intento de acceso de usuario eliminado";
    const recipients = superAdmins.map((admin) => ({ email: admin.email, name: admin.fullName }));
    const htmlContent = `
            <h2 style="color: #dc2626;">Alerta de Seguridad</h2>
            <p>El usuario <strong>${user.fullName}</strong> (${user.email} / DNI: ${user.dni}) intent\xF3 iniciar sesi\xF3n en el sistema.</p>
            <p>Este usuario se encuentra actualmente en estado <strong>Eliminado</strong>.</p>
            <p>El usuario ha recibido un mensaje indicando que su cuenta est\xE1 en revisi\xF3n.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p><strong>Acci\xF3n requerida:</strong></p>
                <p>Por favor, revise si este usuario debe ser reactivado o si debe permanecer eliminado.</p>
                <ul>
                    <li>Si desea reactivarlo: Busque al usuario en Gesti\xF3n de Usuarios (filtro 'Eliminados') y active su cuenta.</li>
                    <li>Si debe permanecer eliminado: No se requiere acci\xF3n, el acceso seguir\xE1 bloqueado.</li>
                </ul>
            </div>
            <div style="margin: 20px 0;">
                 <a href="https://laconeo.github.io/voluntarios/" style="background-color: #8CB83E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ir al Panel de Administraci\xF3n</a>
            </div>
        `;
    for (const recipient of recipients) {
      await sendEmail({
        to: [recipient],
        subject,
        htmlContent
      });
    }
  }
};

// src/services/supabaseApiService.ts
var mapUser = (row) => ({
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
  role: row.role,
  stakeId: row.stake_id,
  ecclesiasticalPermission: row.ecclesiastical_permission,
  password: row.password,
  status: row.status,
  createdAt: row.created_at
});
var mapEvent = (row) => ({
  id: row.id,
  slug: row.slug,
  nombre: row.nombre,
  ubicacion: row.ubicacion,
  pais: row.pais,
  contactEmail: row.contact_email,
  fechaInicio: row.fecha_inicio,
  fechaFin: row.fecha_fin,
  descripcion: row.descripcion,
  estado: row.estado,
  voluntarios: 0,
  // Calculated separately
  turnos: 0,
  // Calculated separately
  ocupacion: 0,
  // Calculated separately
  createdAt: row.created_at
});
var mapRole = (row) => ({
  id: row.id,
  eventId: row.event_id,
  name: row.name,
  description: row.description,
  detailedTasks: row.detailed_tasks,
  youtubeUrl: row.youtube_url,
  experienceLevel: row.experience_level,
  requiresApproval: row.requires_approval,
  isVisible: row.is_visible,
  createdAt: row.created_at
});
var mapShift = (row) => ({
  id: row.id,
  eventId: row.event_id,
  date: row.date,
  timeSlot: row.time_slot,
  roleId: row.role_id,
  totalVacancies: row.total_vacancies,
  availableVacancies: row.total_vacancies,
  // Calc logic needed
  coordinatorIds: row.coordinator_ids || []
});
var mapBooking = (row) => ({
  id: row.id,
  userId: row.user_id,
  shiftId: row.shift_id || void 0,
  // Maybe null if event-level registration
  eventId: row.event_id,
  status: row.status,
  attendance: row.attendance,
  foodDelivered: row.food_delivered,
  requestedAt: row.requested_at,
  cancelledAt: row.cancelled_at,
  // Relations must be joined if needed
  shift: row.shifts ? {
    ...mapShift(row.shifts),
    role: row.shifts.roles ? mapRole(row.shifts.roles) : void 0
  } : void 0,
  user: row.users ? mapUser(row.users) : void 0
});
var mapMaterial = (row) => ({
  id: row.id,
  eventId: row.event_id,
  name: row.name,
  description: row.description,
  quantity: row.quantity,
  category: row.category,
  isRequired: row.is_required,
  createdAt: row.created_at
});
var mapStake = (row) => ({
  id: row.id,
  eventId: row.event_id,
  name: row.name,
  createdAt: row.created_at
});
var isWithin24Hours = (shiftDate, shiftTime) => {
  const [startTime] = shiftTime.split("-");
  const cleanStartTime = startTime ? startTime.trim() : "00:00";
  const shiftDateTime = /* @__PURE__ */ new Date(`${shiftDate}T${cleanStartTime}:00`);
  const now = /* @__PURE__ */ new Date();
  const diff = shiftDateTime.getTime() - now.getTime();
  const hoursUntilShift = diff / (1e3 * 60 * 60);
  return hoursUntilShift <= 24 && hoursUntilShift > 0;
};
var supabaseApi = {
  // ==================== AUTH ====================
  login: async (identifier, password) => {
    const { data: userProfile, error: profileError } = await supabase.from("users").select("*").or(`dni.eq.${identifier},email.eq.${identifier}`).maybeSingle();
    if (!userProfile) {
      throw new Error("Usuario no encontrado");
    }
    if (userProfile.status === "deleted") {
      const { data: superAdmins } = await supabase.from("users").select("*").eq("role", "superadmin");
      if (superAdmins) {
        const admins = superAdmins.map(mapUser);
        emailService.sendDeletedUserLoginAlert(mapUser(userProfile), admins).catch(console.error);
      }
      throw new Error("Su cuenta esta en proceso de revision, el administrador del sistema le contactara.");
    }
    const email = userProfile.email;
    if (!password) {
      throw new Error("Contrase\xF1a requerida");
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      if (error.message === "Invalid login credentials") throw new Error("Contrase\xF1a incorrecta");
      throw error;
    }
    if (!data.user) return null;
    return mapUser(userProfile);
  },
  recoverPassword: async (email) => {
    const prodUrl = "https://laconeo.github.io/voluntarios";
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const redirectUrl = isLocal ? window.location.origin : `${prodUrl}/`;
    console.log("Recovery Redirect URL:", redirectUrl);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    if (error) throw error;
  },
  register: async (newUser, eventId) => {
    const { data: existingUser } = await supabase.from("users").select("*").eq("dni", newUser.dni).maybeSingle();
    if (existingUser) {
      const { data: updated, error } = await supabase.from("users").update({
        full_name: newUser.fullName,
        phone: newUser.phone,
        tshirt_size: newUser.tshirtSize,
        is_member: newUser.isMember,
        attended_previous: newUser.attendedPrevious,
        is_over_18: newUser.isOver18,
        how_they_heard: newUser.howTheyHeard,
        stake_id: newUser.stakeId || null,
        status: "active"
        // Reactivate if it was deleted/suspended
        // DO NOT update ID or Email effectively here for Auth linkage
      }).eq("id", existingUser.id).select().single();
      if (error) throw error;
      return mapUser(updated);
    }
    const generatedPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newUser.email,
      password: generatedPassword
    });
    if (authError) {
      if (authError.message.includes("User already registered")) {
        throw new Error("El correo ya est\xE1 registrado en el sistema de Autenticaci\xF3n (Auth), pero no tiene perfil de voluntario. Esto ocurre si el usuario fue eliminado de la base de datos manualmente pero no de la lista de usuarios autorizados. Por favor, elimine el usuario desde el panel de 'Authentication' en Supabase para poder registrarlo nuevamente.");
      }
      throw authError;
    }
    if (!authData.user) throw new Error("Error creando usuario de autenticaci\xF3n");
    const dbUser = {
      id: authData.user.id,
      // CRITICAL: Link Auth ID
      dni: newUser.dni,
      full_name: newUser.fullName,
      email: newUser.email,
      phone: newUser.phone,
      tshirt_size: newUser.tshirtSize,
      is_member: newUser.isMember,
      attended_previous: newUser.attendedPrevious,
      is_over_18: newUser.isOver18,
      how_they_heard: newUser.howTheyHeard,
      role: newUser.role || "volunteer",
      stake_id: newUser.stakeId || null,
      status: "active"
    };
    const { data: profileData, error: profileError } = await supabase.from("users").insert(dbUser).select().single();
    if (profileError) {
      console.error("Profile creation failed. Details:", {
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code
      });
      throw new Error(`Error creando perfil: ${profileError.message}`);
    }
    const registered = mapUser(profileData);
    emailService.sendWelcomeEmail(registered, generatedPassword).catch(console.error);
    if (eventId) {
      try {
        await supabase.from("bookings").insert({
          id: `bk_gen_${Date.now()}`,
          user_id: registered.id,
          event_id: eventId,
          shift_id: null,
          status: "confirmed",
          requested_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (err) {
        console.warn("Could not auto-enroll user in event.", err);
      }
    }
    return registered;
  },
  updateUser: async (updatedUser) => {
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
      ecclesiastical_permission: updatedUser.ecclesiasticalPermission || "pending",
      status: updatedUser.status
    };
    const { data, error } = await supabase.from("users").update(dbUser).eq("id", updatedUser.id).select().single();
    if (error) throw error;
    return mapUser(data);
  },
  deleteUser: async (userId) => {
    const { data: confirmedBookings } = await supabase.from("bookings").select("shift_id").eq("user_id", userId).eq("status", "confirmed");
    await supabase.from("bookings").update({ status: "cancelled" }).eq("user_id", userId).neq("status", "cancelled");
    if (confirmedBookings && confirmedBookings.length > 0) {
      const shiftIds = [...new Set(confirmedBookings.map((b) => b.shift_id))];
      for (const shiftId of shiftIds) {
        await supabaseApi.processWaitlist(shiftId);
      }
    }
    const { error } = await supabase.from("users").update({ status: "deleted" }).eq("id", userId);
    if (error) throw error;
  },
  getAllUsers: async () => {
    const { data, error } = await supabase.from("users").select("*");
    if (error) throw error;
    return data.map(mapUser);
  },
  getUserById: async (userId) => {
    const { data, error } = await supabase.from("users").select("*").eq("id", userId).single();
    if (error) return null;
    return mapUser(data);
  },
  getUsersByIds: async (userIds) => {
    if (!userIds || userIds.length === 0) return [];
    const { data, error } = await supabase.from("users").select("*").in("id", userIds);
    if (error) throw error;
    return (data || []).map(mapUser);
  },
  // ==================== EVENTS ====================
  getAllEvents: async () => {
    const { data: events, error } = await supabase.from("events").select("*");
    if (error) throw error;
    const { data: bookings } = await supabase.from("bookings").select("event_id, user_id").eq("status", "confirmed");
    const eventsWithCounts = events.map((event) => {
      const mapped = mapEvent(event);
      if (bookings) {
        const eventBookings = bookings.filter((b) => b.event_id === event.id);
        const uniqueUsers = new Set(eventBookings.map((b) => b.user_id));
        mapped.voluntarios = uniqueUsers.size;
      }
      return mapped;
    });
    return eventsWithCounts;
  },
  getEventById: async (eventId) => {
    const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single();
    if (error) return null;
    return mapEvent(data);
  },
  getEventBySlug: async (slug) => {
    const { data, error } = await supabase.from("events").select("*").eq("slug", slug).single();
    if (error) return null;
    return mapEvent(data);
  },
  createEvent: async (eventData) => {
    const dbEvent = {
      id: `event_${Date.now()}`,
      slug: eventData.slug || eventData.nombre.toLowerCase().replace(/ /g, "-"),
      nombre: eventData.nombre,
      ubicacion: eventData.ubicacion,
      pais: eventData.pais,
      contact_email: eventData.contactEmail,
      fecha_inicio: eventData.fechaInicio,
      fecha_fin: eventData.fechaFin,
      descripcion: eventData.descripcion,
      estado: eventData.estado || "Activo"
    };
    const { data, error } = await supabase.from("events").insert(dbEvent).select().single();
    if (error) throw error;
    return mapEvent(data);
  },
  updateEvent: async (eventId, updates) => {
    const dbUpdates = {};
    if (updates.nombre) dbUpdates.nombre = updates.nombre;
    if (updates.slug) dbUpdates.slug = updates.slug;
    if (updates.ubicacion) dbUpdates.ubicacion = updates.ubicacion;
    if (updates.pais) dbUpdates.pais = updates.pais;
    if (updates.contactEmail !== void 0) dbUpdates.contact_email = updates.contactEmail;
    if (updates.fechaInicio) dbUpdates.fecha_inicio = updates.fechaInicio;
    if (updates.fechaFin) dbUpdates.fecha_fin = updates.fechaFin;
    if (updates.descripcion) dbUpdates.descripcion = updates.descripcion;
    if (updates.estado) dbUpdates.estado = updates.estado;
    const { data, error } = await supabase.from("events").update(dbUpdates).eq("id", eventId).select().single();
    if (error) throw error;
    return mapEvent(data);
  },
  archiveEvent: async (eventId) => {
    const { data, error } = await supabase.from("events").update({ estado: "Archivado" }).eq("id", eventId).select().single();
    if (error) throw error;
    return mapEvent(data);
  },
  deleteEvent: async (eventId) => {
    const { count } = await supabase.from("bookings").select("*", { count: "exact", head: true }).eq("event_id", eventId);
    if (count && count > 0) throw new Error("No se puede eliminar evento con voluntarios registrados");
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) throw error;
  },
  // ==================== EVENT ADMINS ====================
  assignAdminToEvent: async (userId, eventId, assignedBy) => {
    const newAssignment = {
      id: `ea_${Date.now()}`,
      user_id: userId,
      event_id: eventId,
      assigned_by: assignedBy
    };
    const { data, error } = await supabase.from("event_admins").insert(newAssignment).select().single();
    if (error) throw error;
    await supabase.from("users").update({ role: "admin" }).eq("id", userId);
    return {
      id: data.id,
      userId: data.user_id,
      eventId: data.event_id,
      assignedAt: data.assigned_at,
      assignedBy: data.assigned_by
    };
  },
  getEventAdmins: async (eventId) => {
    const { data: adminIds } = await supabase.from("event_admins").select("user_id").eq("event_id", eventId);
    if (!adminIds || adminIds.length === 0) return [];
    const ids = adminIds.map((a) => a.user_id);
    const { data: users } = await supabase.from("users").select("*").in("id", ids);
    return (users || []).map(mapUser);
  },
  revokeAdminFromEvent: async (userId, eventId) => {
    const { error } = await supabase.from("event_admins").delete().match({ user_id: userId, event_id: eventId });
    if (error) throw error;
    const { count } = await supabase.from("event_admins").select("*", { count: "exact", head: true }).eq("user_id", userId);
    if (count === 0) {
      await supabase.from("users").update({ role: "volunteer" }).eq("id", userId);
    }
  },
  // ==================== ROLES ====================
  getRolesByEvent: async (eventId) => {
    const { data, error } = await supabase.from("roles").select("*").eq("event_id", eventId);
    if (error) throw error;
    return data.map(mapRole);
  },
  getRoleById: async (roleId) => {
    const { data, error } = await supabase.from("roles").select("*").eq("id", roleId).single();
    if (error) return null;
    return mapRole(data);
  },
  getAllRoles: async () => {
    const { data, error } = await supabase.from("roles").select("*");
    if (error) throw error;
    return data.map(mapRole);
  },
  createRole: async (roleData) => {
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
    const { data, error } = await supabase.from("roles").insert(dbRole).select().single();
    if (error) throw error;
    return mapRole(data);
  },
  updateRole: async (roleId, updates) => {
    const dbUpdates = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.description) dbUpdates.description = updates.description;
    if (updates.detailedTasks) dbUpdates.detailed_tasks = updates.detailedTasks;
    if (updates.youtubeUrl !== void 0) dbUpdates.youtube_url = updates.youtubeUrl;
    if (updates.experienceLevel) dbUpdates.experience_level = updates.experienceLevel;
    if (updates.requiresApproval !== void 0) dbUpdates.requires_approval = updates.requiresApproval;
    if (updates.isVisible !== void 0) dbUpdates.is_visible = updates.isVisible;
    const { data, error } = await supabase.from("roles").update(dbUpdates).eq("id", roleId).select().single();
    if (error) throw error;
    return mapRole(data);
  },
  deleteRole: async (roleId) => {
    const { count } = await supabase.from("shifts").select("*", { count: "exact", head: true }).eq("role_id", roleId);
    if (count && count > 0) throw new Error("No se puede eliminar rol con turnos asignados");
    await supabase.from("roles").delete().eq("id", roleId);
  },
  // ==================== SHIFTS ====================
  getShiftsForDate: async (eventId, date) => {
    const { data: shifts, error } = await supabase.from("shifts").select("*").eq("event_id", eventId).eq("date", date);
    if (error) throw error;
    const shiftIds = shifts.map((s) => s.id);
    const { data: bookings } = await supabase.from("bookings").select("shift_id").in("shift_id", shiftIds).eq("status", "confirmed");
    return shifts.map((s) => {
      const bookedCount = bookings?.filter((b) => b.shift_id === s.id).length || 0;
      const coordinatorCount = s.coordinator_ids ? s.coordinator_ids.length : 0;
      return {
        ...mapShift(s),
        availableVacancies: Math.max(0, s.total_vacancies - bookedCount - coordinatorCount)
      };
    });
  },
  getShiftsByEvent: async (eventId) => {
    const { data, error } = await supabase.from("shifts").select("*").eq("event_id", eventId);
    if (error) throw error;
    return data.map(mapShift);
  },
  getShiftById: async (shiftId) => {
    const { data, error } = await supabase.from("shifts").select("*").eq("id", shiftId).single();
    if (error) return null;
    return mapShift(data);
  },
  createShift: async (shiftData) => {
    const dbShift = {
      id: `shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      event_id: shiftData.eventId,
      date: shiftData.date,
      time_slot: shiftData.timeSlot,
      role_id: shiftData.roleId,
      total_vacancies: shiftData.totalVacancies,
      coordinator_ids: shiftData.coordinatorIds || []
    };
    const { data, error } = await supabase.from("shifts").insert(dbShift).select().single();
    if (error) throw error;
    return mapShift(data);
  },
  updateShift: async (shiftId, updates) => {
    if (updates.totalVacancies !== void 0) {
      const { count: count2 } = await supabase.from("bookings").select("*", { count: "exact", head: true }).eq("shift_id", shiftId).eq("status", "confirmed");
      if (count2 && updates.totalVacancies < count2) {
        throw new Error(`No se puede reducir el cupo a ${updates.totalVacancies} porque ya hay ${count2} voluntarios inscritos.`);
      }
    }
    const { data: original } = await supabase.from("shifts").select("*").eq("id", shiftId).single();
    if (!original) throw new Error("Turno no encontrado");
    const dbUpdates = {};
    if (updates.date) dbUpdates.date = updates.date;
    if (updates.timeSlot) dbUpdates.time_slot = updates.timeSlot;
    if (updates.totalVacancies) dbUpdates.total_vacancies = updates.totalVacancies;
    if (updates.coordinatorIds) dbUpdates.coordinator_ids = updates.coordinatorIds;
    const { data: updated, error } = await supabase.from("shifts").update(dbUpdates).eq("id", shiftId).select().single();
    if (error) throw error;
    if (updates.timeSlot && updates.timeSlot !== original.time_slot || updates.date && updates.date !== original.date) {
      const { data: bookedUsers } = await supabase.from("bookings").select("user_id, users(*)").eq("shift_id", shiftId).eq("status", "confirmed");
      const { data: event } = await supabase.from("events").select("nombre").eq("id", original.event_id).single();
      if (bookedUsers && event) {
        bookedUsers.forEach((b) => {
          if (b.users) {
            emailService.sendShiftModificationAlert(
              mapUser(b.users),
              // joined data
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
    const { count } = await supabase.from("bookings").select("*", { count: "exact", head: true }).eq("shift_id", shiftId).eq("status", "confirmed");
    shiftMapped.availableVacancies = shiftMapped.totalVacancies - (count || 0);
    return shiftMapped;
  },
  deleteShift: async (shiftId, force = false) => {
    const { count } = await supabase.from("bookings").select("*", { count: "exact", head: true }).eq("shift_id", shiftId).neq("status", "cancelled");
    if (count && count > 0) {
      if (!force) {
        throw new Error("No se puede eliminar un turno con voluntarios inscritos");
      }
      await supabase.from("bookings").update({ status: "cancelled", cancelled_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("shift_id", shiftId).neq("status", "cancelled");
    }
    const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
    if (error) {
      if (error.code === "23503" && force) {
        await supabase.from("bookings").delete().eq("shift_id", shiftId);
        const { error: retryError } = await supabase.from("shifts").delete().eq("id", shiftId);
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }
  },
  getEventShiftDates: async (eventId) => {
    const { data } = await supabase.from("shifts").select("date").eq("event_id", eventId);
    if (!data) return [];
    const dates = Array.from(new Set(data.map((d) => d.date)));
    return dates.sort();
  },
  assignCoordinatorToShift: async (shiftId, userId) => {
    const { data: shift } = await supabase.from("shifts").select("*").eq("id", shiftId).single();
    if (!shift) throw new Error("Turno no encontrado");
    await supabase.from("users").update({ role: "coordinator" }).eq("id", userId);
    const { data: relatedShifts } = await supabase.from("shifts").select("id, coordinator_ids").eq("event_id", shift.event_id).eq("date", shift.date).eq("time_slot", shift.time_slot);
    if (relatedShifts && relatedShifts.length > 0) {
      for (const relatedShift of relatedShifts) {
        const currentIds = relatedShift.coordinator_ids || [];
        if (!currentIds.includes(userId)) {
          const newIds = [...currentIds, userId];
          await supabase.from("shifts").update({ coordinator_ids: newIds }).eq("id", relatedShift.id);
        }
      }
    }
    return mapShift({ ...shift, coordinator_ids: [...shift.coordinator_ids || [], userId] });
  },
  removeCoordinatorFromShift: async (shiftId, userId) => {
    const { data: shift } = await supabase.from("shifts").select("*").eq("id", shiftId).single();
    if (!shift) throw new Error("Turno no encontrado");
    const { data: relatedShifts } = await supabase.from("shifts").select("id, coordinator_ids").eq("event_id", shift.event_id).eq("date", shift.date).eq("time_slot", shift.time_slot);
    if (relatedShifts && relatedShifts.length > 0) {
      for (const relatedShift of relatedShifts) {
        const currentIds = relatedShift.coordinator_ids || [];
        const newIds = currentIds.filter((id) => id !== userId);
        if (currentIds.length !== newIds.length) {
          await supabase.from("shifts").update({ coordinator_ids: newIds }).eq("id", relatedShift.id);
        }
      }
    }
    const { count: coordCount } = await supabase.from("shifts").select("*", { count: "exact", head: true }).contains("coordinator_ids", [userId]);
    if (coordCount === 0) {
      await supabase.from("users").update({ role: "volunteer" }).eq("id", userId);
    }
    const { count: bookingCount } = await supabase.from("bookings").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("event_id", shift.event_id).neq("status", "cancelled");
    const { count: eventCoordCount } = await supabase.from("shifts").select("*", { count: "exact", head: true }).eq("event_id", shift.event_id).contains("coordinator_ids", [userId]);
    if (bookingCount === 0 && eventCoordCount === 0) {
      const generalBookingId = `booking_${Date.now()}_general`;
      await supabase.from("bookings").insert({
        id: generalBookingId,
        user_id: userId,
        event_id: shift.event_id,
        shift_id: null,
        status: "confirmed",
        requested_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return mapShift({ ...shift, coordinator_ids: (shift.coordinator_ids || []).filter((id) => id !== userId) });
  },
  // ==================== BOOKINGS ====================
  createBooking: async (userId, shiftId) => {
    const { data: shift } = await supabase.from("shifts").select("*").eq("id", shiftId).single();
    if (!shift) throw new Error("Turno no encontrado.");
    const { data: role } = await supabase.from("roles").select("*").eq("id", shift.role_id).single();
    const initialStatus = role?.requires_approval ? "pending_approval" : "confirmed";
    let bookingId;
    const { data: rpcResult, error: rpcError } = await supabase.rpc("book_shift", {
      p_user_id: userId,
      p_shift_id: shiftId,
      p_status: initialStatus
    });
    if (!rpcError) {
      if (!rpcResult.success) {
        if (rpcResult.code === "FULL") {
          const { count: posCount } = await supabase.from("waitlist").select("*", { count: "exact", head: true }).eq("shift_id", shiftId);
          const position = (posCount || 0) + 1;
          await supabase.from("waitlist").insert({
            id: `wl_${Date.now()}`,
            user_id: userId,
            shift_id: shiftId,
            event_id: shift.event_id,
            position
          });
          const newBooking = {
            id: `booking_${Date.now()}`,
            user_id: userId,
            shift_id: shiftId,
            event_id: shift.event_id,
            status: "waitlist",
            requested_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          await supabase.from("bookings").insert(newBooking);
          throw new Error("No hay vacantes disponibles. Te agregamos a la lista de espera.");
        } else {
          throw new Error(rpcResult.message);
        }
      } else {
        console.log("%c\u2705 [DEBUG] Inscripci\xF3n procesada con RPC (M\xE9todo Seguro)", "color: green; font-weight: bold; font-size: 12px;");
        bookingId = rpcResult.booking_id;
      }
    } else {
      console.log("%c\u26A0\uFE0F [DEBUG] RPC fall\xF3. Usando m\xE9todo FALLBACK (Legacy)", "color: orange; font-weight: bold; font-size: 12px;", rpcError);
      console.warn("Detalle error RPC:", rpcError);
      const { data: existing } = await supabase.from("bookings").select("*").eq("user_id", userId).eq("shift_id", shiftId).neq("status", "cancelled").maybeSingle();
      if (existing) throw new Error("Ya est\xE1s inscripto en este turno.");
      const { count } = await supabase.from("bookings").select("*", { count: "exact", head: true }).eq("shift_id", shiftId).eq("status", "confirmed");
      if (count !== null && count >= shift.total_vacancies) {
        const { count: posCount } = await supabase.from("waitlist").select("*", { count: "exact", head: true }).eq("shift_id", shiftId);
        const position = (posCount || 0) + 1;
        await supabase.from("waitlist").insert({
          id: `wl_${Date.now()}`,
          user_id: userId,
          shift_id: shiftId,
          event_id: shift.event_id,
          position
        });
        const newBooking2 = {
          id: `booking_${Date.now()}`,
          user_id: userId,
          shift_id: shiftId,
          event_id: shift.event_id,
          status: "waitlist",
          requested_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        await supabase.from("bookings").insert(newBooking2);
        throw new Error("No hay vacantes disponibles. Te agregamos a la lista de espera.");
      }
      const newBooking = {
        id: `booking_${Date.now()}`,
        user_id: userId,
        shift_id: shiftId,
        event_id: shift.event_id,
        status: initialStatus,
        requested_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const { data: bookingData2, error: insertError } = await supabase.from("bookings").insert(newBooking).select().single();
      if (insertError) throw new Error("Error t\xE9cnico al inscribir (Fallback).");
      bookingId = bookingData2.id;
    }
    if (!bookingId) throw new Error("Error inesperado: No se pudo confirmar la reserva.");
    const { data: bookingData } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
    if (role && role.name.toLowerCase().includes("coordinador")) {
      try {
        const { data: relatedShifts } = await supabase.from("shifts").select("id, coordinator_ids").eq("event_id", shift.event_id).eq("date", shift.date).eq("time_slot", shift.time_slot);
        if (relatedShifts && relatedShifts.length > 0) {
          for (const relatedShift of relatedShifts) {
            const currentIds = relatedShift.coordinator_ids || [];
            if (!currentIds.includes(userId)) {
              const newIds = [...currentIds, userId];
              await supabase.from("shifts").update({ coordinator_ids: newIds }).eq("id", relatedShift.id);
            }
          }
        }
      } catch (error) {
        console.error("Error auto-assigning coordinator:", error);
      }
    }
    const { data: event } = await supabase.from("events").select("*").eq("id", shift.event_id).single();
    const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();
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
  enrollUserInEvent: async (userId, eventId) => {
    const { data: existing } = await supabase.from("bookings").select("*").eq("user_id", userId).eq("event_id", eventId).neq("status", "cancelled").maybeSingle();
    if (existing) throw new Error("El usuario ya est\xE1 inscripto en este evento.");
    const newBooking = {
      id: `bk_man_${Date.now()}`,
      user_id: userId,
      event_id: eventId,
      shift_id: null,
      status: "confirmed",
      requested_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data, error } = await supabase.from("bookings").insert(newBooking).select().single();
    if (error) throw error;
    return mapBooking(data);
  },
  getBookingsByEvent: async (eventId) => {
    const { data } = await supabase.from("bookings").select("*").eq("event_id", eventId).neq("status", "cancelled");
    return (data || []).map(mapBooking);
  },
  getUserBookings: async (userId, eventId) => {
    let query = supabase.from("bookings").select("*, shifts(*, roles(*))").eq("user_id", userId).neq("status", "cancelled");
    if (eventId) {
      query = query.eq("event_id", eventId);
    }
    const { data } = await query;
    if (!data) return [];
    return data.map((b) => {
      const booking = mapBooking(b);
      if (b.shifts) {
        booking.shift = mapShift(b.shifts);
        if (b.shifts.roles) {
          booking.shift.role = mapRole(b.shifts.roles);
        }
      }
      return booking;
    }).sort((a, b) => new Date(a.shift?.date).getTime() - new Date(b.shift?.date).getTime());
  },
  getBookingsForShifts: async (shiftIds) => {
    if (!shiftIds || shiftIds.length === 0) return [];
    const { data } = await supabase.from("bookings").select("*, users(*), shifts(*, roles(*))").in("shift_id", shiftIds).eq("status", "confirmed");
    if (!data) return [];
    return data.map((b) => {
      const booking = mapBooking(b);
      booking.user = b.users ? mapUser(b.users) : void 0;
      if (b.shifts) {
        booking.shift = mapShift(b.shifts);
        if (b.shifts.roles) {
          booking.shift.role = mapRole(b.shifts.roles);
        }
      }
      return booking;
    });
  },
  requestBookingCancellation: async (bookingId) => {
    const { data: booking } = await supabase.from("bookings").select("*, shifts(*), events(*)").eq("id", bookingId).single();
    if (!booking) throw new Error("Inscripci\xF3n no encontrada.");
    const shift = booking.shifts;
    const cancelledAt = (/* @__PURE__ */ new Date()).toISOString();
    const within24 = isWithin24Hours(shift.date, shift.time_slot);
    if (within24) {
      const { data: updated } = await supabase.from("bookings").update({ status: "cancelled", cancelled_at: cancelledAt }).eq("id", bookingId).select().single();
      await supabaseApi.processWaitlist(shift.id);
      return mapBooking(updated);
    } else {
      const { data: updated } = await supabase.from("bookings").update({ status: "cancellation_requested", cancelled_at: cancelledAt }).eq("id", bookingId).select().single();
      const { data: user } = await supabase.from("users").select("*").eq("id", booking.user_id).single();
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
  adminCancelBooking: async (bookingId) => {
    const { data: booking } = await supabase.from("bookings").select("*, shifts(*), events(*), users(*)").eq("id", bookingId).single();
    if (!booking) throw new Error("Inscripci\xF3n no encontrada.");
    const cancelledAt = (/* @__PURE__ */ new Date()).toISOString();
    await supabase.from("bookings").update({ status: "cancelled", cancelled_at: cancelledAt }).eq("id", bookingId);
    if (booking.shifts) {
      const { data: role } = await supabase.from("roles").select("*").eq("id", booking.shifts.role_id).single();
      if (role && role.name.toLowerCase().includes("coordinador")) {
        try {
          const { data: relatedShifts } = await supabase.from("shifts").select("id, coordinator_ids").eq("event_id", booking.event_id).eq("date", booking.shifts.date).eq("time_slot", booking.shifts.time_slot);
          if (relatedShifts && relatedShifts.length > 0) {
            console.log(`\u2705 Found ${relatedShifts.length} shifts with date ${booking.shifts.date} and time ${booking.shifts.time_slot}`);
            for (const relatedShift of relatedShifts) {
              const currentIds = relatedShift.coordinator_ids || [];
              const newIds = currentIds.filter((id) => id !== booking.user_id);
              if (currentIds.length !== newIds.length) {
                await supabase.from("shifts").update({ coordinator_ids: newIds }).eq("id", relatedShift.id);
                console.log(`\u2705 Removed coordinator ${booking.user_id} from shift ${relatedShift.id}`);
              }
            }
            console.log(`\u2705 Auto-removed user ${booking.user_id} as coordinator from ${relatedShifts.length} shifts`);
          }
        } catch (error) {
          console.error("Error auto-removing coordinator:", error);
        }
      }
    }
    await supabaseApi.processWaitlist(booking.shift_id);
    if (booking.users && booking.events && booking.shifts) {
      emailService.sendBookingCancelledByAdmin(
        mapUser(booking.users),
        booking.events.nombre,
        booking.shifts.date,
        booking.shifts.time_slot
      ).catch(console.error);
    }
  },
  processWaitlist: async (shiftId) => {
    const { data: entries } = await supabase.from("waitlist").select("*").eq("shift_id", shiftId).order("position", { ascending: true });
    if (entries && entries.length > 0) {
      const next = entries[0];
      await supabase.from("bookings").update({ status: "confirmed" }).eq("user_id", next.user_id).eq("shift_id", shiftId);
      await supabase.from("waitlist").delete().eq("id", next.id);
    }
  },
  updateBookingAttendance: async (bookingId, attendance) => {
    await supabase.from("bookings").update({ attendance }).eq("id", bookingId);
    if (attendance !== "pending") {
      const { data: booking } = await supabase.from("bookings").select("*, users(*), shifts(*, roles(*)), events(*)").eq("id", bookingId).single();
      if (booking && booking.users) {
        const user = mapUser(booking.users);
        const evtName = booking.events?.nombre;
        const roleName = booking.shifts?.roles?.name;
        const date = booking.shifts?.date;
        const time = booking.shifts?.time_slot;
        if (attendance === "attended") {
          emailService.sendAttendanceThankYou(user, evtName, roleName, date, time).catch(console.error);
        } else {
          emailService.sendAbsenceFollowUp(user, evtName, date, time).catch(console.error);
        }
      }
    }
  },
  updateBookingFoodStatus: async (bookingId, delivered) => {
    const { error } = await supabase.from("bookings").update({ food_delivered: delivered }).eq("id", bookingId);
    if (error) throw error;
  },
  getUserEvents: async (userId) => {
    const { data: bookings } = await supabase.from("bookings").select("event_id, events(*)").eq("user_id", userId).neq("status", "cancelled");
    if (!bookings) return [];
    const eventsMap = /* @__PURE__ */ new Map();
    bookings.forEach((b) => {
      if (b.events) {
        eventsMap.set(b.events.id, mapEvent(b.events));
      }
    });
    const { data: coordShifts } = await supabase.from("shifts").select("event_id, events(*)").contains("coordinator_ids", [userId]);
    if (coordShifts) {
      coordShifts.forEach((s) => {
        if (s.events) {
          eventsMap.set(s.events.id, mapEvent(s.events));
        }
      });
    }
    return Array.from(eventsMap.values());
  },
  // ==================== ADMIN METRICS ETC ====================
  getPendingCancellations: async (eventId) => {
    let query = supabase.from("bookings").select("*, users(*), shifts(*, roles(*))").eq("status", "cancellation_requested");
    if (eventId) query = query.eq("event_id", eventId);
    const { data } = await query;
    return (data || []).map((b) => {
      const booking = mapBooking(b);
      booking.user = mapUser(b.users);
      if (b.shifts) {
        booking.shift = mapShift(b.shifts);
        booking.shift.role = mapRole(b.shifts.roles);
      }
      return booking;
    });
  },
  approveCancellation: async (bookingId) => {
    const { data: updated } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId).select("*, shifts(*), events(*), users(*)").single();
    await supabaseApi.processWaitlist(updated.shift_id);
    if (updated.events && updated.shifts) {
      emailService.sendCancellationApproved(mapUser(updated.users), updated.events.nombre, updated.shifts.date).catch(console.error);
    }
    return mapBooking(updated);
  },
  rejectCancellation: async (bookingId) => {
    const { data: updated } = await supabase.from("bookings").update({ status: "confirmed" }).eq("id", bookingId).select("*, shifts(*), events(*), users(*)").single();
    if (updated.events && updated.shifts) {
      emailService.sendCancellationRejected(mapUser(updated.users), updated.events.nombre, updated.shifts.date, updated.shifts.time_slot).catch(console.error);
    }
    return mapBooking(updated);
  },
  getPrintableRoster: async (eventId, date, timeSlot) => {
    const { data: bookings } = await supabase.from("bookings").select("*, users(full_name, dni), shifts(role_id, roles(name))").eq("event_id", eventId).eq("status", "confirmed");
    const { data } = await supabase.from("bookings").select("users(full_name, dni), shifts!inner(role_id, date, time_slot, roles(name))").eq("event_id", eventId).eq("status", "confirmed").eq("shifts.date", date).eq("shifts.time_slot", timeSlot);
    return (data || []).map((row) => ({
      fullName: row.users.full_name || "N/A",
      dni: row.users.dni || "N/A",
      role: row.shifts.roles.name || "N/A"
    })).sort((a, b) => a.role.localeCompare(b.role));
  },
  getDashboardMetrics: async (eventId) => {
    const { data: shifts } = await supabase.from("shifts").select("*").eq("event_id", eventId);
    const { data: bookings } = await supabase.from("bookings").select("*").eq("event_id", eventId).eq("status", "confirmed");
    const { data: allBookings } = await supabase.from("bookings").select("*").eq("event_id", eventId);
    const { data: waitlist } = await supabase.from("waitlist").select("*").eq("event_id", eventId);
    const { data: roles } = await supabase.from("roles").select("*").eq("event_id", eventId);
    const { data: users } = await supabase.from("users").select("*");
    const { data: userMaterials } = await supabase.from("user_materials").select("user_id").eq("event_id", eventId);
    if (!shifts || !bookings || !roles || !users || !userMaterials) {
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
        ecclesiasticalApprovalPercentage: 0
      };
    }
    let totalOccupiedSlots = 0;
    const allOccupantIds = /* @__PURE__ */ new Set();
    shifts.forEach((shift) => {
      const shiftBookings = bookings.filter((b) => b.shift_id === shift.id);
      const shiftBookedIds = shiftBookings.map((b) => b.user_id);
      const shiftCoordIds = shift.coordinator_ids || [];
      const uniqueShiftOccupants = /* @__PURE__ */ new Set([...shiftBookedIds, ...shiftCoordIds]);
      totalOccupiedSlots += uniqueShiftOccupants.size;
      uniqueShiftOccupants.forEach((id) => allOccupantIds.add(id));
    });
    const totalVacancies = shifts.reduce((sum, s) => sum + s.total_vacancies, 0);
    const occupiedVacancies = totalOccupiedSlots;
    const availableVacancies = Math.max(0, totalVacancies - occupiedVacancies);
    const occupationPercentage = totalVacancies > 0 ? Math.round(occupiedVacancies / totalVacancies * 100) : 0;
    const uniqueVolunteers = allOccupantIds.size;
    const avgShiftsPerVolunteer = uniqueVolunteers > 0 ? (occupiedVacancies / uniqueVolunteers).toFixed(1) : 0;
    const pendingCancellations = allBookings ? allBookings.filter((b) => b.status === "cancellation_requested").length : 0;
    const pendingCoordinatorRequests = allBookings ? allBookings.filter((b) => b.status === "pending_approval").length : 0;
    const waitlistCount = waitlist ? waitlist.length : 0;
    const roleDistribution = bookings.reduce((acc, b) => {
      const shift = shifts.find((s) => s.id === b.shift_id);
      const role = roles.find((r) => r.id === shift?.role_id);
      if (role) {
        const existing = acc.find((r) => r.roleName === role.name);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ roleName: role.name, count: 1, color: "#4F46E5" });
        }
      }
      return acc;
    }, []);
    const unbookedCoordsPerShift = [];
    shifts.forEach((s) => {
      const shiftBookings = bookings.filter((b) => b.shift_id === s.id);
      const bookedUserIds = shiftBookings.map((b) => b.user_id);
      const coordIds = s.coordinator_ids || [];
      coordIds.forEach((cId) => {
        if (!bookedUserIds.includes(cId)) {
          unbookedCoordsPerShift.push({ shift: s, userId: cId });
        }
      });
    });
    unbookedCoordsPerShift.forEach((item) => {
      const role = roles.find((r) => r.id === item.shift.role_id);
      if (role) {
        const existing = roleDistribution.find((r) => r.roleName === role.name);
        if (existing) {
          existing.count++;
        } else {
          roleDistribution.push({ roleName: role.name, count: 1, color: "#10B981" });
        }
      }
    });
    const uniqueDates = [...new Set(shifts.map((s) => s.date))].sort();
    const dailyOccupation = uniqueDates.map((date) => {
      const dateShifts = shifts.filter((s) => s.date === date);
      let dateOccupied = 0;
      let dateTotal = 0;
      dateShifts.forEach((shift) => {
        const shiftBookings = bookings.filter((b) => b.shift_id === shift.id);
        const shiftBookedIds = shiftBookings.map((b) => b.user_id);
        const shiftCoordIds = shift.coordinator_ids || [];
        const uniqueShiftOccupants = (/* @__PURE__ */ new Set([...shiftBookedIds, ...shiftCoordIds])).size;
        dateOccupied += uniqueShiftOccupants;
        dateTotal += shift.total_vacancies;
      });
      const occupation = dateTotal > 0 ? Math.round(dateOccupied / dateTotal * 100) : 0;
      return { date, occupation };
    });
    const shiftOccupation = {};
    const uniqueTimeSlots = [...new Set(shifts.map((s) => s.time_slot))].sort();
    uniqueTimeSlots.forEach((slot) => {
      const slotShifts = shifts.filter((s) => s.time_slot === slot);
      let slotOccupied = 0;
      let slotTotal = 0;
      slotShifts.forEach((shift) => {
        const shiftBookings = bookings.filter((b) => b.shift_id === shift.id);
        const shiftBookedIds = shiftBookings.map((b) => b.user_id);
        const shiftCoordIds = shift.coordinator_ids || [];
        const uniqueShiftOccupants = (/* @__PURE__ */ new Set([...shiftBookedIds, ...shiftCoordIds])).size;
        slotOccupied += uniqueShiftOccupants;
        slotTotal += shift.total_vacancies;
      });
      shiftOccupation[slot] = slotTotal > 0 ? Math.round(slotOccupied / slotTotal * 100) : 0;
    });
    const attendedCount = bookings.filter((b) => b.attendance === "attended").length;
    const absentCount = bookings.filter((b) => b.attendance === "absent").length;
    const totalMarked = attendedCount + absentCount;
    const attendancePercentage = totalMarked > 0 ? Math.round(attendedCount / totalMarked * 100) : 0;
    let experiencedCount = 0;
    let approvedEcclesiasticalCount = 0;
    allOccupantIds.forEach((uid) => {
      const u = users.find((user) => user.id === uid);
      if (u) {
        if (u.attended_previous) experiencedCount++;
        if (u.ecclesiastical_permission === "verified") approvedEcclesiasticalCount++;
      }
    });
    const previousExperiencePercentage = uniqueVolunteers > 0 ? Math.round(experiencedCount / uniqueVolunteers * 100) : 0;
    const ecclesiasticalApprovalPercentage = uniqueVolunteers > 0 ? Math.round(approvedEcclesiasticalCount / uniqueVolunteers * 100) : 0;
    const uniqueMaterialRecipients = new Set((userMaterials || []).map((m) => m.user_id)).size;
    const materialsDeliveryPercentage = uniqueVolunteers > 0 ? Math.round(uniqueMaterialRecipients / uniqueVolunteers * 100) : 0;
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
  getPendingCoordinatorRequests: async (eventId) => {
    let query = supabase.from("bookings").select("*, users(*), shifts(*, roles(*))").eq("status", "pending_approval");
    if (eventId) query = query.eq("event_id", eventId);
    const { data } = await query;
    return (data || []).map((b) => {
      const booking = mapBooking(b);
      booking.user = mapUser(b.users);
      if (b.shifts) {
        booking.shift = mapShift(b.shifts);
        if (b.shifts.roles) {
          booking.shift.role = mapRole(b.shifts.roles);
        }
      }
      return booking;
    });
  },
  approveCoordinatorRequest: async (bookingId) => {
    const { data: booking, error } = await supabase.from("bookings").update({ status: "confirmed" }).eq("id", bookingId).select("*, users(*), shifts(*, roles(*)), events(*)").single();
    if (error || !booking) throw error || new Error("Error approving request");
    if (booking.user_id) {
      await supabase.from("users").update({ role: "coordinator" }).eq("id", booking.user_id);
      if (booking.shift_id && booking.shifts) {
        const { data: relatedShifts } = await supabase.from("shifts").select("id, coordinator_ids").eq("event_id", booking.event_id).eq("date", booking.shifts.date).eq("time_slot", booking.shifts.time_slot);
        if (relatedShifts && relatedShifts.length > 0) {
          for (const relatedShift of relatedShifts) {
            const currentIds = relatedShift.coordinator_ids || [];
            if (!currentIds.includes(booking.user_id)) {
              const newIds = [...currentIds, booking.user_id];
              await supabase.from("shifts").update({ coordinator_ids: newIds }).eq("id", relatedShift.id);
            }
          }
        }
      }
    }
    return;
  },
  rejectCoordinatorRequest: async (bookingId) => {
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
    if (error) throw error;
  },
  // ==================== MATERIALS ====================
  getMaterialsByEvent: async (eventId) => {
    const { data, error } = await supabase.from("materials").select("*").eq("event_id", eventId);
    if (error) throw error;
    return data.map(mapMaterial);
  },
  createMaterial: async (material) => {
    const dbMaterial = {
      event_id: material.eventId,
      name: material.name,
      description: material.description,
      quantity: material.quantity,
      category: material.category,
      is_required: material.isRequired
    };
    const { data, error } = await supabase.from("materials").insert(dbMaterial).select().single();
    if (error) throw error;
    return mapMaterial(data);
  },
  updateMaterial: async (id, updates) => {
    const dbUpdates = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.description) dbUpdates.description = updates.description;
    if (updates.quantity !== void 0) dbUpdates.quantity = updates.quantity;
    if (updates.category) dbUpdates.category = updates.category;
    if (updates.isRequired !== void 0) dbUpdates.is_required = updates.isRequired;
    const { data, error } = await supabase.from("materials").update(dbUpdates).eq("id", id).select().single();
    if (error) throw error;
    return mapMaterial(data);
  },
  deleteMaterial: async (id) => {
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) throw error;
  },
  // ==================== DELIVERY ====================
  getUserMaterials: async (eventId) => {
    const { data, error } = await supabase.from("user_materials").select("*").eq("event_id", eventId);
    if (error) {
      if (error.code === "42P01") return [];
      throw error;
    }
    return data || [];
  },
  toggleUserMaterial: async (eventId, userId, materialId, delivered) => {
    if (delivered) {
      const { error } = await supabase.from("user_materials").insert({ event_id: eventId, user_id: userId, material_id: materialId });
      if (error && error.code !== "23505") throw error;
    } else {
      const { error } = await supabase.from("user_materials").delete().match({ event_id: eventId, user_id: userId, material_id: materialId });
      if (error) throw error;
    }
  },
  // ==================== COORDINATOR MANAGEMENT ====================
  addCoordinatorToShift: async (shiftId, userId) => {
    const { data: shift } = await supabase.from("shifts").select("coordinator_ids").eq("id", shiftId).single();
    if (!shift) throw new Error("Shift not found");
    const currentIds = shift.coordinator_ids || [];
    if (currentIds.includes(userId)) return;
    const newIds = [...currentIds, userId];
    const { error } = await supabase.from("shifts").update({ coordinator_ids: newIds }).eq("id", shiftId);
    if (error) throw error;
  },
  // ==================== STAKES ====================
  getStakesByEvent: async (eventId) => {
    const { data, error } = await supabase.from("stakes").select("*").eq("event_id", eventId);
    if (error) throw error;
    return (data || []).map(mapStake);
  },
  createStake: async (stake) => {
    const dbStake = {
      event_id: stake.eventId,
      name: stake.name
    };
    const { data, error } = await supabase.from("stakes").insert(dbStake).select().single();
    if (error) throw error;
    return mapStake(data);
  },
  deleteStake: async (id) => {
    const { error } = await supabase.from("stakes").delete().eq("id", id);
    if (error) throw error;
  },
  getVolunteersByEventStakes: async (eventId) => {
    const { data: stakes, error: stakeError } = await supabase.from("stakes").select("id").eq("event_id", eventId);
    if (stakeError) throw stakeError;
    if (!stakes || stakes.length === 0) return [];
    const stakeIds = stakes.map((s) => s.id);
    const { data: users, error: userError } = await supabase.from("users").select("*").in("stake_id", stakeIds);
    if (userError) throw userError;
    return (users || []).map(mapUser);
  }
};
export {
  supabaseApi
};
