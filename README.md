
# Voluntarios - Sistema de Gestión de Voluntarios

> Sistema integral de booking y gestión de voluntarios para eventos de FamilySearch

[![React](https://img.shields.io/badge/React-19.2.0-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1.17-38B2AC.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 📋 Tabla de Contenidos

- [Descripción](#-descripción)
- [Características](#-características)
- [Casos de Uso](#-casos-de-uso)
- [Tecnologías](#-tecnologías)
- [Instalación](#-instalación)
- [Uso](#-uso)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Roadmap](#-roadmap)
- [Contribución](#-contribución)
- [Licencia](#-licencia)

---

## 🎯 Descripción

**ConVocación** es un sistema web diseñado para facilitar la gestión, registro y coordinación de voluntarios en eventos organizados por FamilySearch. El sistema permite a los voluntarios inscribirse en turnos específicos, consultar disponibilidad en tiempo real, y gestionar sus compromisos, mientras que los administradores pueden supervisar la ocupación, aprobar bajas, generar reportes y asignar coordinadores.

### Problema que Resuelve

Anteriormente, la gestión de voluntarios se realizaba mediante formularios de Google y hojas de cálculo, lo que generaba:
- ❌ Sobrebooking de vacantes (múltiples personas intentando registrarse simultáneamente)
- ❌ Falta de claridad sobre el compromiso (voluntarios confundían "disponibilidad" con "compromiso")
- ❌ Dificultad para rastrear bajas y gestionar listas de espera
- ❌ Ausencia de métricas en tiempo real para la toma de decisiones
- ❌ Proceso manual y propenso a errores para coordinadores

### Solución

ConVocación centraliza todo el proceso en una plataforma intuitiva que:
- ✅ Garantiza control de concurrencia para evitar sobrebooking
- ✅ Enfatiza el concepto de "compromiso" en cada registro
- ✅ Automatiza la gestión de bajas con validación temporal (<24hs vs >24hs)
- ✅ Implementa listas de espera automáticas
- ✅ Provee dashboards con métricas en tiempo real
- ✅ Genera listados imprimibles para coordinadores
- ✅ Soporta múltiples eventos simultáneos

---

## ✨ Características

### Para Voluntarios
- 🔐 **Autenticación simple con DNI** - Sin necesidad de crear contraseñas
- 📅 **Calendario visual** - Consulta disponibilidad de turnos por día
- 🎯 **Registro transaccional** - Cada turno es un compromiso individual
- 📹 **Videos explicativos** - Conoce cada rol antes de inscribirte
- 📧 **Notificaciones automáticas** - Confirmación y recordatorios por email
- ⏰ **Gestión de bajas** - Solicita bajas con validación automática o manual según el tiempo
- 📋 **Mis Turnos** - Visualiza todos tus compromisos en un solo lugar
- 🔄 **Lista de espera** - Únete automáticamente si un turno está lleno

### Para Administradores
- 📊 **Dashboard de métricas** - Visualiza ocupación, distribución de roles y tendencias
- ✅ **Validación de bajas** - Aprueba o rechaza solicitudes con más de 24hs de anticipación
- 👥 **Gestión de roles** - Crea y configura roles con vacantes por turno
- 📆 **Gestión de turnos** - Define turnos, horarios y capacidades
- 🖨️ **Reportes imprimibles** - Genera listados para control de asistencia
- 📤 **Exportación de datos** - Descarga información en Excel/CSV
- 🔔 **Alertas en tiempo real** - Notificaciones de bajas pendientes

### Para Super Administradores
- 🌍 **Gestión multi-evento** - Administra múltiples ferias simultáneamente
- 👨‍💼 **Asignación de administradores** - Delega permisos por evento
- 🏛️ **Histórico de eventos** - Consulta datos de eventos anteriores
- 📈 **Métricas comparativas** - Analiza rendimiento entre eventos

### Para Coordinadores
- 👀 **Vista de turno** - Accede al listado de voluntarios de tu turno
- ✔️ **Control de asistencia** - Marca presentes/ausentes digital o en papel
- 💬 **Observaciones** - Registra feedback sobre el desempeño de voluntarios
- 📧 **Notificaciones automáticas** - Recibe listado de tu turno 48hs antes

---

## 🎬 Casos de Uso

### Voluntarios
- **CU-15:** Autenticarse con DNI
- **CU-16:** Consultar disponibilidad de turnos
- **CU-17:** Registrarse en turno/rol
- **CU-18:** Solicitar baja
- **CU-19:** Ver mis turnos
- **CU-20:** Editar datos personales
- **CU-21:** Registrarse en lista de espera

### Administradores
- **CU-04:** Gestionar roles y vacantes
- **CU-05:** Validar bajas >24hs
- **CU-06:** Asignar coordinadores
- **CU-07:** Editar datos de voluntarios
- **CU-08:** Ver dashboard y métricas
- **CU-09:** Exportar reportes
- **CU-10:** Ver registros cancelados

### Coordinadores
- **CU-11:** Ver voluntarios de turno
- **CU-12:** Marcar asistencia
- **CU-13:** Imprimir listado
- **CU-14:** Agregar observaciones

### Super Administradores
- **CU-01:** Gestionar eventos
- **CU-02:** Asignar administradores a eventos
- **CU-03:** Ver histórico multi-evento

---

## 🛠️ Tecnologías

### Frontend
- **React 19.2.0** - Biblioteca de UI
- **TypeScript 5.8.2** - Tipado estático
- **Vite 6.2.0** - Build tool y dev server
- **Tailwind CSS 4.1.17** - Framework de CSS utility-first
- **Lucide React** - Iconografía
- **React Hot Toast** - Notificaciones

### Backend (Planeado)
- **Supabase** - PostgreSQL + Auth + Realtime
- **Supabase Edge Functions** - Serverless para emails y lógica de negocio

### Servicios Externos
- **Brevo/SendGrid** - Envío de emails (300 emails/día gratis)
- **GitHub Pages** - Hosting del frontend

### Estándares de Diseño
- **FamilySearch Brand Standards** - Colores, tipografías y guías oficiales
- **Noto Sans** - Fuente corporativa
- **Colores:** Verde primario `#87b940` (PMS 368 C)

---

## 🚀 Instalación

### Prerrequisitos
- Node.js 18+ 
- npm o yarn

### Pasos

1. **Clonar el repositorio**
```bash
git clone https://github.com/tu-usuario/convocacion-volunteer-system.git
cd convocacion-volunteer-system
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno** (opcional, para producción)
```bash
cp .env.example .env
# Editar .env con tus credenciales de Supabase y Brevo
```

4. **Iniciar servidor de desarrollo**
```bash
npm run dev
```

5. **Abrir en el navegador**
```
http://localhost:3000
```

---

## 📖 Uso

### Acceso como Voluntario

1. Ingresa a la aplicación
2. Introduce tu DNI (sin puntos)
3. Si es tu primera vez, completa el formulario de registro:
   - Datos personales (nombre, email, teléfono)
   - Talle de remera
   - Información adicional
   - ⚠️ **Acepta el disclaimer de compromiso**
4. Navega por el calendario y selecciona una fecha
5. Explora los turnos disponibles (13-16hs o 16-22hs)
6. Haz clic en "Ver Detalles" para conocer el rol
7. Haz clic en "Inscribirme" y confirma tu compromiso
8. Recibirás un email de confirmación

### Acceso como Administrador

**Credenciales de prueba:**
- Email/DNI: `admin@feria.com` o `11111111`

1. Accede con tus credenciales de administrador
2. Dashboard principal muestra:
   - Solicitudes de baja pendientes
   - Métricas de ocupación en tiempo real
   - Distribución de voluntarios por rol
3. Usa las pestañas para:
   - **Solicitudes:** Aprobar/rechazar bajas
   - **Reportes:** Generar listados imprimibles
   - **Turnos:** Crear nuevos turnos y roles
   - **Dashboard:** Ver métricas detalladas

### Acceso como Super Administrador

**Credenciales de prueba:**
- Email/DNI: `superadmin@familysearch.org` o `99999999`

1. Accede con credenciales de super admin
2. Gestiona múltiples eventos:
   - Crear/editar/archivar eventos
   - Ver métricas comparativas
   - Asignar administradores por evento

### Flujo de Bajas

**Menos de 24 horas antes del turno:**
- ✅ Baja automática (se libera la vacante inmediatamente)
- 🔄 Se procesa la lista de espera automáticamente

**Más de 24 horas antes del turno:**
- ⏳ Solicitud enviada a administradores
- 👨‍💼 Admin revisa y aprueba/rechaza
- 📧 Voluntario recibe notificación de la decisión

---

## 📁 Estructura del Proyecto

```
convocacion-volunteer-system/
├── public/
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── SuperAdmin/
│   │   │   └── SuperAdminDashboard.tsx    # Gestión de eventos
│   │   ├── Admin/
│   │   │   ├── AdminDashboard.tsx         # Panel de administración
│   │   │   └── MetricsDashboard.tsx       # Dashboard con gráficos
│   │   ├── Coordinador/
│   │   │   └── [pendiente]
│   │   ├── Voluntario/
│   │   │   ├── VolunteerPortal.tsx        # Portal principal
│   │   │   ├── Login.tsx                  # Autenticación
│   │   │   └── UserProfile.tsx            # Edición de perfil
│   │   ├── shared/
│   │   │   ├── Header.tsx
│   │   │   └── RoleDetailModal.tsx
│   │   └── layout/
│   ├── services/
│   │   ├── mockApiService.ts              # API simulada (mock)
│   │   └── mockData.ts                    # Datos de prueba
│   ├── types.ts                            # Definiciones TypeScript
│   ├── App.tsx                             # Componente raíz
│   ├── index.css                           # Estilos globales
│   └── index.tsx                           # Entry point
├── .gitignore
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🗓️ Roadmap

### Fase 1: MVP (Completado)
- ✅ Autenticación con DNI
- ✅ Consulta de disponibilidad
- ✅ Registro en turnos
- ✅ Gestión de bajas
- ✅ Panel de administración básico
- ✅ Mock API funcional

### Fase 2: Backend Real (En Progreso)
- 🔄 Integración con Supabase
- 🔄 Sistema de emails con Brevo
- 🔄 Autenticación persistente
- 🔄 Base de datos PostgreSQL

### Fase 3: Funcionalidades Avanzadas (Planeado)
- 📅 Gestión de coordinadores completa
- 📊 Reportes avanzados con gráficos
- 📱 Versión mobile optimizada
- 🌐 Internacionalización (i18n)
- 🔔 Notificaciones push
- 📤 Exportación masiva de datos

### Fase 4: Escalabilidad (Futuro)
- 🏢 Soporte multi-organización
- 🔐 Roles y permisos granulares
- 📈 Analytics avanzado
- 🤖 Recomendaciones de turnos con IA
- 📲 App móvil nativa (React Native)

---

## 🎨 Guía de Estilos

El proyecto sigue estrictamente el [FamilySearch Brand Standards](https://www.familysearch.org/en/brand).

### Colores Principales
```css
/* Verde Primary (PMS 368 C) */
--primary: #87b940;
--primary-dark: #6d9433;
--primary-light: #e8f3d8;

/* Neutrales */
--grey-00: #FFFFFF;
--grey-50: #76797C;
--grey-100: #202121;

/* Body Text */
--body-text: #786e63;
```

### Tipografía
- **Headlines:** Georgia, serif (simula Museo Slab)
- **Body:** Noto Sans, system-ui, sans-serif

### Principios de Diseño
- **Authentic:** Real, personal, simple, accesible
- **Joyful:** Positivo, atractivo, invitador
- **Inspiring:** Colorido, brillante, cálido, creativo
- **Trusted:** Conocedor, respetado, líder, útil

---

## 🤝 Contribución

¡Las contribuciones son bienvenidas! Por favor, sigue estos pasos:

1. **Fork** el proyecto
2. **Crea una rama** para tu feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. **Push** a la rama (`git push origin feature/AmazingFeature`)
5. **Abre un Pull Request**

### Guías de Contribución
- Sigue el estilo de código existente (TypeScript + ESLint)
- Escribe mensajes de commit descriptivos
- Actualiza la documentación si es necesario
- Agrega tests para nuevas funcionalidades
- Respeta los Brand Standards de FamilySearch

---

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 👥 Autores

- **Equipo de Desarrollo** - *Trabajo inicial y mantenimiento*
- **FamilySearch** - *Brand guidelines y soporte*

---

## 🙏 Agradecimientos

- FamilySearch por los Brand Standards y la oportunidad de servir
- Comunidad de voluntarios por su feedback valioso
- Todos los contribuidores que hacen posible este proyecto

---

## 📞 Contacto

¿Preguntas o sugerencias? Abre un [Issue](https://github.com/tu-usuario/convocacion-volunteer-system/issues) en GitHub.

---

<div align="center">

**Hecho con ❤️ para la comunidad de voluntarios de FamilySearch**

[⬆ Volver arriba](#convocación---sistema-de-gestión-de-voluntarios)

</div>
