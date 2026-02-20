# PC Stand Controller — Extensión de Chrome

## ¿Qué hace?

Esta extensión de Chrome reemplaza al script `pc_blocker.py`. Controla el tiempo de uso de cada PC del stand de FamilySearch, sin necesidad de instalar Python ni ninguna dependencia.

Funciona en **Windows, ChromeOS Flex y Mac** — cualquier sistema que corra Chrome.

## Flujo de Trabajo

1. **PC disponible** → La extensión muestra un overlay de pantalla completa con el formulario de login (selector de voluntario).
2. **Sesión activa** → El overlay desaparece y aparece un **timer flotante** en la esquina inferior derecha mostrando el tiempo restante.
3. **Tiempo expirado** → La extensión vuelve a bloquear la pantalla con el formulario de reporte de actividad.
4. **Reporte enviado** → La PC queda libre y vuelve al estado "Disponible".

## Instalación en la feria (3 pasos)

### Paso 1: Copiar la carpeta al pendrive
Copiá toda la carpeta `chrome-extension/` a un pendrive USB.

### Paso 2: Cargar la extensión en Chrome
1. Abrí Chrome y navegá a `chrome://extensions`
2. Activá **"Modo desarrollador"** (toggle en la esquina superior derecha)
3. Hacé clic en **"Cargar extensión sin empaquetar"**
4. Seleccioná la carpeta `chrome-extension/` del pendrive
5. La extensión aparece instalada ✅

### Paso 3: Configurar el número de PC
1. Hacé clic en el ícono 💻 de la extensión en la barra de Chrome
2. Ingresá el **número de PC** asignado por el administrador (ej: `1`, `2`, `3`...)
3. Hacé clic en **"Guardar"**
4. La extensión se activa inmediatamente

## Archivos de la extensión

```
chrome-extension/
├── manifest.json          # Configuración de la extensión (Manifest V3)
├── background.js          # Service Worker: polling a Supabase, lógica de sesión
├── content.js             # Overlay fullscreen + timer flotante inyectado en páginas
├── content.css            # Estilos del content script
├── popup.html             # UI del popup al clickear el ícono
├── popup.js               # Lógica del popup
├── generate_icons.py      # Script para regenerar íconos (Python puro)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Configuración Supabase

La extensión se conecta a la misma tabla `pcs_status` que usaba el script de Python. 
Las credenciales están hardcodeadas en `background.js`:

```
SUPABASE_URL = "https://apmykrlvahdllakrjdbp.supabase.co"
SUPABASE_KEY = "sb_publishable_..."
```

## Regenerar íconos

Si necesitás regenerar los íconos PNG:

```bash
python generate_icons.py
```

No requiere instalar ninguna librería adicional — usa solo Python estándar.

## Atajo de salida de emergencia

Para salir del overlay en casos de emergencia, abrí el popup de la extensión y usá el botón **"Cambiar PC"**.

## Diferencias con el script Python

| Feature | Python (pc_blocker.py) | Extensión Chrome |
|---------|----------------------|-----------------|
| Instalación | Python + PySide6 + requests | Solo copiar carpeta |
| SO soportados | Solo Windows | Windows, ChromeOS, Mac |
| Timer visible | No | ✅ Timer flotante |
| Overlay | Ventana separada | Inyectado en el navegador |
| FamilySearch real | En ventana separada | Directo en Chrome |
| Mantenimiento | Alto | Bajo |
