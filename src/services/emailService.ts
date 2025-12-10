import type { User, Event, Role } from '../types';

// EmailJS Configuration
// User provided Public Key: 3OJkvoQ7fpMgoTjra
const PUBLIC_KEY = '3OJkvoQ7fpMgoTjra';
const SERVICE_ID = 'service_yx5vrg8';
const TEMPLATE_ID = 'template_hg6gecb';

interface EmailPayload {
    to: { email: string; name: string }[];
    subject: string;
    htmlContent: string;
}

const sendEmail = async (payload: EmailPayload) => {
    if (!SERVICE_ID || !TEMPLATE_ID) {
        console.warn('⚠️ Falta configuración de EmailJS (SERVICE_ID o TEMPLATE_ID) en .env.local');
        return;
    }

    const templateParams = {
        email: payload.to[0].email,
        to_name: payload.to[0].name,
        subject: payload.subject,
        html_content: payload.htmlContent,
    };

    try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                service_id: SERVICE_ID,
                template_id: TEMPLATE_ID,
                user_id: PUBLIC_KEY,
                template_params: templateParams,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error EmailJS: ${errorText}`);
        }

    } catch (error) {
        console.error('❌ Error al enviar email:', error);
    }
};

export const emailService = {
    // 1. Registro (CU-01)
    sendWelcomeEmail: async (user: User) => {
        const subject = "¡Bienvenido al equipo de voluntarios de FamilySearch!";
        const htmlContent = `
      <h1>¡Hola ${user.fullName.split(' ')[0]}!</h1>
      <p>Tu registro ha sido exitoso. Estamos muy felices de que te unas a nosotros.</p>
      <p><strong>Tus datos registrados:</strong></p>
      <ul>
        <li>DNI: ${user.dni}</li>
        <li>Email: ${user.email}</li>
        <li>Teléfono: ${user.phone}</li>
      </ul>
      <p>Puedes ingresar al portal para empezar a tomar turnos en nuestros eventos.</p>
      <div style="margin: 20px 0;">
        <a href="${window.location.origin}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ir al Portal</a>
      </div>
    `;
        await sendEmail({
            to: [{ email: user.email, name: user.fullName }],
            subject,
            htmlContent,
        });
    },

    // 2. Confirmación de Turno (CU-04)
    sendBookingConfirmation: async (user: User, event: Event, roleName: string, date: string, time: string) => {
        const subject = `Confirmación de Turno - ${event.nombre}`;

        // --- Helper Logic for Calendar Links ---
        let googleUrl = "#";
        let outlookUrl = "#";
        try {
            // Split using regex to handle "13:00-16:00" or "13:00 - 16:00"
            const parts = time.split(/-|–/).map(t => t.trim());
            const startTime = parts[0];
            const endTime = parts[1] || startTime; // Fallback if no end time

            // Construct Dates (assuming Local Time)
            const d = new Date(date + "T" + startTime + ":00");
            const dEnd = new Date(date + "T" + endTime + ":00");

            // Format YYYYMMDDTHHMM00
            const format = (dateObj: Date) => {
                const pad = (n: number) => n < 10 ? '0' + n : n.toString();
                return dateObj.getFullYear() +
                    pad(dateObj.getMonth() + 1) +
                    pad(dateObj.getDate()) + 'T' +
                    pad(dateObj.getHours()) +
                    pad(dateObj.getMinutes()) + '00';
            };

            const startStr = format(d);
            const endStr = format(dEnd);

            const title = encodeURIComponent(`Voluntariado: ${event.nombre} - ${roleName}`);
            const details = encodeURIComponent(`Turno de voluntariado para ${event.nombre}.\nRol: ${roleName}\nUbicación: ${event.ubicacion}`);
            const loc = encodeURIComponent(event.ubicacion);

            googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${loc}`;
            outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${details}&startdt=${d.toISOString()}&enddt=${dEnd.toISOString()}&location=${loc}`;
        } catch (e) {
            console.error("Error generating calendar links", e);
        }
        // ---------------------------------------

        const htmlContent = `
      <h1>Turno Confirmado</h1>
      <p>Hola ${user.fullName.split(' ')[0]}, tu inscripción ha sido guardada con éxito.</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Evento:</strong> ${event.nombre}</p>
        <p><strong>Rol:</strong> ${roleName}</p>
        <p><strong>Fecha:</strong> ${date}</p>
        <p><strong>Horario:</strong> ${time}</p>
        <p><strong>Ubicación:</strong> ${event.ubicacion}</p>
      </div>
      <p><strong>Agendar:</strong> <a href="${googleUrl}" target="_blank">Agregar a Google Calendar</a> | <a href="${outlookUrl}" target="_blank">Outlook</a></p>
      
      <div style="margin: 20px 0;">
        <a href="${window.location.origin}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ir a la Aplicación</a>
      </div>

      <p>Por favor, llega 15 minutos antes de tu horario.</p>
    `;
        await sendEmail({
            to: [{ email: user.email, name: user.fullName }],
            subject,
            htmlContent,
        });
    },

    // 3. Solicitud de Baja (CU-05) - Para el voluntario
    sendCancellationRequestReceived: async (user: User, eventName: string, date: string, time: string) => {
        const subject = "Hemos recibido tu solicitud de baja";
        const htmlContent = `
      <p>Hola ${user.fullName.split(' ')[0]},</p>
      <p>Hemos recibido tu solicitud para cancelar tu turno en <strong>${eventName}</strong> el ${date} a las ${time}.</p>
      <p>Tu solicitud está <strong>pendiente de aprobación</strong> por un coordinador. Sigues figurando como responsable del turno hasta que recibas la confirmación de la baja.</p>
    `;
        await sendEmail({
            to: [{ email: user.email, name: user.fullName }],
            subject,
            htmlContent,
        });
    },

    // 4. Aprobación de Baja (CU-06)
    sendCancellationApproved: async (user: User, eventName: string, date: string) => {
        const subject = "Tu baja ha sido aprobada";
        const htmlContent = `
      <p>Hola ${user.fullName.split(' ')[0]},</p>
      <p>Te confirmamos que tu solicitud de baja para el evento <strong>${eventName}</strong> del día ${date} ha sido aprobada.</p>
      <p>La vacante ha sido liberada. ¡Gracias por avisar!</p>
    `;
        await sendEmail({
            to: [{ email: user.email, name: user.fullName }],
            subject,
            htmlContent,
        });
    },

    sendCancellationRejected: async (user: User, eventName: string, date: string, time: string) => {
        const subject = "Información sobre tu solicitud de baja";
        const htmlContent = `
            <p>Hola ${user.fullName.split(' ')[0]},</p>
            <p>Te informamos que tu solicitud de baja para el evento <strong>${eventName}</strong> del día ${date} a las ${time} no ha podido ser procesada en este momento.</p>
            <p><strong>Por lo tanto, tu turno sigue vigente.</strong></p>
            <p>Si tienes alguna duda, por favor comunícate con tu coordinador.</p>
            <div style="margin: 20px 0;">
                <a href="${window.location.origin}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Revisar mis Turnos</a>
            </div>
        `;
        await sendEmail({
            to: [{ email: user.email, name: user.fullName }],
            subject,
            htmlContent
        });
    },

    // 5. Modificación Crítica de Turno (CU-02)
    sendShiftModificationAlert: async (user: User, eventName: string, oldTime: string, newTime: string, date: string) => {
        const subject = "URGENTE: Cambio en tu turno programado";
        const htmlContent = `
      <h2 style="color: #dc2626;">¡Atención! Cambio de Horario</h2>
      <p>Hola ${user.fullName.split(' ')[0]},</p>
      <p>El coordinador ha modificado los horarios del evento <strong>${eventName}</strong> para el día ${date}.</p>
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
            htmlContent,
        });
    },

    // 6. Recordatorio (Simulado)
    sendReminderEmail: async (user: User, eventName: string, roleName: string, date: string, time: string, location: string) => {
        const subject = "Recordatorio: Tu turno es mañana";
        const htmlContent = `
      <h1>¡Te esperamos mañana!</h1>
      <p>Hola ${user.fullName.split(' ')[0]}, recuerda que tienes un turno programado.</p>
      <ul>
        <li><strong>Evento:</strong> ${eventName}</li>
        <li><strong>Rol:</strong> ${roleName}</li>
        <li><strong>Horario:</strong> ${time} (${date})</li>
        <li><strong>Lugar:</strong> ${location}</li>
      </ul>
      <p>Recuerda llevar ropa cómoda y tu mejor sonrisa :)</p>
     `;
        await sendEmail({
            to: [{ email: user.email, name: user.fullName }],
            subject,
            htmlContent,
        });
    },

    // 7. Agradecimiento por Asistencia
    sendAttendanceThankYou: async (user: User, eventName: string, roleName: string, date: string, time: string) => {
        const subject = "¡Muchas gracias por tu servicio hoy!";
        const htmlContent = `
      <h1>¡Gracias ${user.fullName.split(' ')[0]}!</h1>
      <p>Queremos agradecerte sinceramente por tu tiempo y dedicación en el evento <strong>${eventName}</strong>.</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Detalles del Turno:</strong></p>
        <p>Rol: ${roleName}</p>
        <p>Fecha: ${date}</p>
        <p>Horario: ${time}</p>
      </div>
      <p>Tu servicio ha sido fundamental para el éxito de hoy.</p>
      <p>Esperamos contar contigo nuevamente.</p>
      <p><em>"Cuando estamos al servicio de nuestros semejantes, solo estamos al servicio de nuestro Dios."</em></p>
      <div style="margin: 20px 0;">
         <a href="${window.location.origin}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ir al Portal</a>
      </div>
     `;
        await sendEmail({
            to: [{ email: user.email, name: user.fullName }],
            subject,
            htmlContent,
        });
    },

    // 8. Seguimiento de Ausencia
    sendAbsenceFollowUp: async (user: User, eventName: string, date: string, time: string) => {
        const subject = "Te extrañamos hoy";
        const htmlContent = `
      <h1>¡Hola ${user.fullName.split(' ')[0]}!</h1>
      <p>Notamos que no pudiste asistir a tu turno programado para hoy en <strong>${eventName}</strong>.</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Detalles del Turno:</strong></p>
        <p>Fecha: ${date}</p>
        <p>Horario: ${time}</p>
      </div>
      <p>Te echamos de menos en el equipo y esperamos verte en una próxima oportunidad.</p>
      <div style="margin: 20px 0;">
         <a href="${window.location.origin}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Revisar mis turnos</a>
      </div>
     `;
        await sendEmail({
            to: [{ email: user.email, name: user.fullName }],
            subject,
            htmlContent,
        });
    },

    // 9. Recuperación de Contraseña (Solicitado por User)
    sendPasswordRecovery: async (user: User) => {
        const subject = "Recuperación de Contraseña - Voluntarios";
        const htmlContent = `
            <h1>Hola ${user.fullName.split(' ')[0]}</h1>
            <p>Has solicitado recuperar tu contraseña para acceder al sistema de gestión de voluntarios.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center;">
                <p>Tu contraseña actual es:</p>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${user.password}</p>
            </div>
            <p>Te recomendamos eliminar este correo después de iniciar sesión por seguridad.</p>
            <div style="margin: 20px 0;">
                 <a href="${window.location.origin}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ir a Iniciar Sesión</a>
            </div>
        `;
        await sendEmail({
            to: [{ email: user.email, name: user.fullName }],
            subject,
            htmlContent
        });
    },

    // 10. Envío de credenciales para Admin/Coordinador
    sendAdminCredentials: async (user: User, passwordStr: string) => {
        const subject = "Asignación de Rol y Credenciales - Voluntarios";
        const roleLabel = user.role === 'admin' ? 'Administrador' : user.role === 'coordinator' ? 'Coordinador' : 'Usuario';

        const htmlContent = `
            <h1>Hola ${user.fullName.split(' ')[0]}</h1>
            <p>Se te ha asignado el rol de <strong>${roleLabel}</strong> en la plataforma de voluntarios.</p>
            <p>A continuación tus credenciales para ingresar:</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p><strong>Usuario (DNI o Email):</strong> ${user.dni || user.email}</p>
                <p><strong>Contraseña:</strong> ${passwordStr}</p>
            </div>
            <p>Por favor, ingresa al sistema y gestiona tus tareas.</p>
            <div style="margin: 20px 0;">
                 <a href="${window.location.origin}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ingresar al Sistema</a>
            </div>
        `;
        await sendEmail({
            to: [{ email: user.email, name: user.fullName }],
            subject,
            htmlContent
        });
    }
};
