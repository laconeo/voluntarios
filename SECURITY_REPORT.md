# Reporte de Auditoría de Seguridad

## Resumen
Se realizó un escaneo automatizado de dependencias (`npm audit`) y una revisión manual de la arquitectura de seguridad. A continuación se detallan los hallazgos.

### 1. Dependencias (npm audit)
*   **Estado**: ✅ Aprobado
*   **Vulnerabilidades Encontradas**: 0
*   **Acción**: Ninguna requerida.

### 2. Vulnerabilidades de Arquitectura (No corregibles automáticamente)

La aplicación, en su estado actual de migración desde un "Mock" (Simulación) a una base de datos real, presenta vulnerabilidades críticas debido a la falta de un sistema de autenticación robusto.

| Vulnerabilidad | Severidad | Descripción | Acción Recomendada (Futura) |
| :--- | :--- | :--- | :--- |
| **Falta de Autenticación (Broken Access Control)** | 🔴 Crítica | El sistema utiliza un "login simulado" donde el cliente (navegador) decide qué rol tiene el usuario. Todas las peticiones a la base de datos se hacen con la llave pública (`anon key`), lo que significa que un usuario con conocimientos técnicos podría hacerse pasar por administrador. | Migrar a **Supabase Auth** (GoTrue). Implementar Login real, protección de rutas y Row Level Security (RLS) basado en `auth.uid()`. |
| **Almacenamiento de Contraseñas en Texto Plano** | 🔴 Crítica | Las contraseñas de los administradores se almacenan tal cual en la tabla `users` y se envían al navegador para ser verificadas. Si la base de datos es accedida, las contraseñas son legibles. | Implementar Hashing (bcrypt) o delegar la autenticación completamente a Supabase Auth. **Nunca** enviar columnas de contraseña al cliente. |
| **Exposición de Datos Sensibles** | 🟠 Alta | Para permitir el registro y login (verificar si el DNI existe), la tabla `users` debe ser legible públicamente (o al menos searchable). Esto permite enumeración de usuarios. | Restringir el acceso a la tabla `users` mediante RLS y usar "Edge Functions" seguras para verificar existencia de usuarios sin exponer toda la tabla. |
| **Falta de Row Level Security (RLS)** | 🟠 Alta | Las tablas de la base de datos no tienen políticas de seguridad estrictas activadas, confiando en que el "frontend" se porte bien. Un atacante directo a la API podría modificar datos. | Activar RLS en todas las tablas y definir políticas (Policies) estrictas (ej: Solo Admins pueden borrar Eventos). |

## Correcciones Aplicadas
1.  **Content Security Policy (CSP)**: Se agregó una política de seguridad de contenido en `index.html` para prevenir ataques de Cross-Site Scripting (XSS) y restringir orígenes de datos no autorizados.
2.  **Validación de Registro**: Se implementó lógica en el backend (API Service) para evitar duplicados y manejar actualizaciones de usuarios seguramente, previniendo errores de integridad de datos.
