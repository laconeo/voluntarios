import type { User, Event, Role } from '../types';

const BREVO_API_KEY = import.meta.env.VITE_BREVO_API_KEY; // User must create this in .env
const SENDER_EMAIL = import.meta.env.VITE_SENDER_EMAIL || 'noreply@voluntariado-fs.org'; // Must be a verified sender in Brevo
const SENDER_NAME = 'Voluntariado FamilySearch';

interface EmailPayload {
    to: { email: string; name: string }[];
    subject: string;
    htmlContent: string;
}

const sendEmail = async (payload: EmailPayload) => {
    if (!BREVO_API_KEY) {
        console.warn('⚠️ No Brevo API Key found. Email sending skipped.');
        return;
    }

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                sender: { name: SENDER_NAME, email: SENDER_EMAIL },
                ...payload,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Error sending email: ${JSON.stringify(errorData)}`);
        }
    } catch (error) {
        console.error('❌ Failed to send email:', error);
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
      <p><strong>Agendar:</strong> <a href="#">Agregar a Google Calendar</a> | <a href="#">Outlook</a></p>
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
    }
};
