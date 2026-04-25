// ============================================================
// PC STAND CONTROLLER - Service Worker (background.js)
//
// Polling con chrome.alarms en lugar de setInterval.
// Los alarms sobreviven aunque Chrome suspenda el service worker
// (crítico para eventos de 20 días continuos).
// ============================================================

const SUPABASE_URL = "https://apmykrlvahdllakrjdbp.supabase.co";
const SUPABASE_KEY = "sb_publishable_sbG7mEBN9__P-JnZlwnjng_tbbuNMnT";

// Nombre del alarm — único identificador
const ALARM_NAME = 'pc-stand-poll';
const ALARM_PERIOD_MIN = 0.2;  // cada ~12 segundos (reducido para mejorar estabilidad)

let pcId = null;
let eventoId = null;
let currentState = null;
let isOverlayActive = false;

// Locks y Caches para evitar saturación
let isCheckingStatus = false;
let volunteersCache = null;
let volunteersCacheTime = 0;
const VOLUNTEERS_CACHE_TTL = 60000; // 1 minuto

// ============================================================
// INICIALIZACIÓN
// Chrome puede despertar el service worker en cualquier momento.
// Siempre recargamos config desde storage primero.
// ============================================================

chrome.runtime.onInstalled.addListener(async () => {
    await loadConfig();
    scheduleAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
    await loadConfig();
    scheduleAlarm();
});

// El alarm despierta el service worker aunque haya sido suspendido
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;

    // Re-hidratar estado desde storage (el worker puede estar "frío")
    if (!pcId) await loadConfig();

    if (pcId) await checkStatus();
});

// Mensajes del popup y content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true;
});

// Cuando carga una nueva pestaña, re-inyectar overlay/timer si corresponde
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    if (isExtensionPage(tab.url)) return;
    if (!pcId) return;

    if (isOverlayActive && currentState) {
        safeSend(tabId, { type: 'SHOW_OVERLAY', pcId, currentState });
    } else if (currentState?.estado === 'ocupada') {
        const rem = getRemainingSeconds(currentState.tiempo_limite);
        if (rem > 0) safeSend(tabId, { type: 'TIMER_UPDATE', remaining: rem, voluntarioNombre: currentState.voluntario_nombre });
    }
});

// ============================================================
// ALARM — crear/asegurar que existe
// ============================================================

function scheduleAlarm() {
    // clearAlarm primero para evitar duplicados al reinstalar
    chrome.alarms.clear(ALARM_NAME, () => {
        chrome.alarms.create(ALARM_NAME, {
            delayInMinutes: ALARM_PERIOD_MIN,
            periodInMinutes: ALARM_PERIOD_MIN,
        });
        console.log(`[PC] Alarm programado cada ${ALARM_PERIOD_MIN * 60}s`);
    });
}

// ============================================================
// CONFIGURACIÓN
// ============================================================

async function loadConfig() {
    const stored = await chrome.storage.local.get(['pcId', 'eventoId', 'configured', 'currentState', 'isOverlayActive']);
    if (stored.configured && stored.pcId) {
        pcId = parseInt(stored.pcId);
        eventoId = stored.eventoId || null;
        currentState = stored.currentState || null;
        isOverlayActive = stored.isOverlayActive || false;
        console.log(`[PC] Config cargada: PC=${pcId} | Evento=${eventoId}`);
    }
}

async function configure(newPcId, newEventoId, newEventoNombre) {
    pcId = parseInt(newPcId);
    eventoId = newEventoId || null;
    const eventoNombre = newEventoNombre || null;
    await chrome.storage.local.set({ pcId, eventoId, eventoNombre, configured: true });
    
    // Al identificar la PC con el evento, forzamos estado 'disponible' en la DB
    // Usamos UPSERT para que si ya existe (en otro evento o estado), se actualice correctamente
    try {
        await registerPc(pcId, eventoId);
        console.log(`[PC] DB actualizada: PC ${pcId} ahora disponible para evento ${eventoId}`);
    } catch (err) {
        console.error('[PC] Error al registrar/actualizar PC en configure:', err.message);
        throw err; // Re-lanzar para que el popup muestre el error al usuario
    }

    scheduleAlarm();           // asegurar alarm activo al configurar
    await checkStatus();       // check inmediato
    console.log(`[PC] Configurado PC=${pcId} | Evento=${eventoId} (${eventoNombre})`);
}

async function resetConfig() {
    // Al "Cambiar PC", marcamos la PC actual como offline (sin_conexion) antes de limpiar
    if (pcId) {
        try {
            await supabasePatch(`pcs_status?id=eq.${pcId}`, { 
                estado: 'sin_conexion',
                voluntario_id: null,
                inicio_sesion: null,
                tiempo_limite: null
            });
        } catch (err) {
            console.warn('[PC] Error al poner offline en resetConfig:', err.message);
        }
    }

    chrome.alarms.clear(ALARM_NAME);
    pcId = null; eventoId = null; currentState = null; isOverlayActive = false;
    await chrome.storage.local.set({
        pcId: null, eventoId: null, configured: false,
        currentState: null, isOverlayActive: false
    });
    broadcastToTabs({ type: 'HIDE_OVERLAY' });
}

// ============================================================
// LÓGICA DE POLLING
// ============================================================

async function checkStatus() {
    if (!pcId || isCheckingStatus) return;
    isCheckingStatus = true;

    let pcData = null;
    try {
        pcData = await fetchPcStatus(pcId, eventoId);
    } catch (err) {
        console.error('[PC] Error al consultar Supabase:', err.message);
        isCheckingStatus = false;
        return; 
    }

    if (!pcData) {
        // La PC no existe en DB → registrarla
        try { await registerPc(pcId, eventoId); } catch { /* ya existe */ }
        await syncState({ estado: 'disponible', tiempo_limite: null, voluntario_id: null, voluntario_nombre: null });
        isCheckingStatus = false;
        return;
    }

    await syncState({
        estado: pcData.estado || 'disponible',
        tiempo_limite: pcData.tiempo_limite || null,
        voluntario_id: pcData.voluntario_id || null,
        voluntario_nombre: pcData.voluntario?.full_name || pcData.voluntario_nombre_libre || null,
        voluntario_nombre_libre: pcData.voluntario_nombre_libre || null,
    });
    
    isCheckingStatus = false;
}

async function syncState(newState) {
    const prevEstado = currentState?.estado;
    const prevStateStr = JSON.stringify(currentState);
    const newStateStr = JSON.stringify(newState);
    
    currentState = newState;

    // Persistir en storage
    await chrome.storage.local.set({ currentState, isOverlayActive });

    let shouldBlock = true;

    if (newState.estado === 'ocupada' && newState.tiempo_limite) {
        const remaining = getRemainingSeconds(newState.tiempo_limite);
        if (remaining > 0) {
            shouldBlock = false;
            // Solo broadcast si el estado cambió significativamente o pasaron los 12s del alarm
            broadcastToTabs({
                type: 'TIMER_UPDATE',
                remaining,
                voluntarioNombre: newState.voluntario_nombre,
                estado: newState.estado
            });
        }
    } else if (newState.estado === 'pausa') {
        shouldBlock = true;
    } else if (newState.estado === 'disponible') {
        shouldBlock = true;
    }

    // Lógica de Overlay
    if (shouldBlock && !isOverlayActive) {
        isOverlayActive = true;
        await chrome.storage.local.set({ isOverlayActive });
        broadcastToTabs({ type: 'SHOW_OVERLAY', pcId, currentState: newState });
    } else if (!shouldBlock && isOverlayActive) {
        isOverlayActive = false;
        await chrome.storage.local.set({ isOverlayActive });
        broadcastToTabs({ type: 'HIDE_OVERLAY' });
    } else if (isOverlayActive) {
        // Si ya estaba activo, solo reenviar si hay cambios reales en el objeto de estado
        if (prevStateStr !== newStateStr) {
            broadcastToTabs({ type: 'SHOW_OVERLAY', pcId, currentState: newState });
        }
    }

    console.log(`[PC] Estado=${newState.estado} | Overlay=${isOverlayActive}`);
}

// ============================================================
// BROADCAST A PESTAÑAS
// ============================================================

async function broadcastToTabs(message) {
    let tabs = [];
    try { tabs = await chrome.tabs.query({}); } catch { return; }
    for (const tab of tabs) {
        if (!isExtensionPage(tab.url) && tab.id) {
            safeSend(tab.id, message);
        }
    }
}

function safeSend(tabId, message) {
    chrome.tabs.sendMessage(tabId, message).catch(() => {/* sin content script */ });
}

// ============================================================
// API SUPABASE
// ============================================================

async function supabaseGet(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`GET ${path} → ${res.status}: ${t}`); }
    const t = await res.text();
    return t ? JSON.parse(t) : [];
}

async function supabasePatch(path, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`PATCH ${path} → ${res.status}: ${t}`); }
}

async function supabasePost(path, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`POST ${path} → ${res.status}: ${t}`); }
}

// ============================================================
// FUNCIONES DE NEGOCIO
// ============================================================

async function fetchPcStatus(id, evId) {
    let q = `pcs_status?select=id,estado,voluntario_id,inicio_sesion,tiempo_limite,evento_id,voluntario:users(full_name)&id=eq.${id}`;
    if (evId) q += `&evento_id=eq.${evId}`;
    const data = await supabaseGet(q);
    return data?.length > 0 ? data[0] : null;
}

async function registerPc(id, evId) {
    const body = { 
        id, 
        estado: 'disponible',
        evento_id: evId || null,
        voluntario_id: null,
        inicio_sesion: null,
        tiempo_limite: null
    };
    
    // Usar UPSERT (POST con Prefer: resolution=merge-duplicates)
    // Esto asegura que si el ID ya existe, se actualice el evento y el estado.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/pcs_status`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY, 
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json', 
            'Prefer': 'resolution=merge-duplicates' 
        },
        body: JSON.stringify(body),
    });
    
    if (!res.ok) { 
        const t = await res.text(); 
        throw new Error(`UPSERT pcs_status → ${res.status}: ${t}`); 
    }
}

async function getEvents() {
    try {
        const data = await supabaseGet('events?select=id,nombre,estado&estado=eq.Activo&order=nombre.asc');
        if (data?.length > 0) return data.map(e => ({ id: e.id, nombre: e.nombre }));
    } catch (e) {
        console.warn('[PC] Fallback eventos:', e.message);
    }
    const data = await supabaseGet('events?select=id,nombre&order=nombre.asc');
    return (data || []).map(e => ({ id: e.id, nombre: e.nombre }));
}

async function startSession(id, userId, nombreLibre, durationMinutes = 20) {
    const now = new Date();
    const limit = new Date(now.getTime() + durationMinutes * 60000);
    const body = {
        estado: 'ocupada',
        voluntario_id: userId || null,
        voluntario_nombre_libre: nombreLibre || null,  // comodín si no está en el SGV
        inicio_sesion: now.toISOString(),
        tiempo_limite: limit.toISOString(),
    };
    if (eventoId) body.evento_id = eventoId;
    await supabasePatch(`pcs_status?id=eq.${id}`, body);
    // Resetear contador de extensiones al iniciar sesión
    await chrome.storage.local.set({ extensionsCount: 0 });
}

async function pauseSession(id) {
    await supabasePatch(`pcs_status?id=eq.${id}`, {
        estado: 'pausa',
        inicio_sesion: new Date().toISOString()
    });
}

async function resumeSession(id) {
    await supabasePatch(`pcs_status?id=eq.${id}`, {
        estado: 'ocupada'
    });
}

async function snoozePc(id) {
    const data = await supabaseGet(`pcs_status?select=tiempo_limite&id=eq.${id}`);
    if (!data?.[0]?.tiempo_limite) throw new Error('No se encontró tiempo_limite');
    // Extender desde el límite actual o desde ahora, lo que sea mayor
    const base = Math.max(new Date(data[0].tiempo_limite).getTime(), Date.now());
    await supabasePatch(`pcs_status?id=eq.${id}`, {
        tiempo_limite: new Date(base + 5 * 60000).toISOString(),
    });

    // Incrementar contador de extensiones
    const stored = await chrome.storage.local.get(['extensionsCount']);
    const count = (stored.extensionsCount || 0) + 1;
    await chrome.storage.local.set({ extensionsCount: count });
}

async function submitReport(id, voluntarioId, nombreLibre, actions, peopleCount) {
    const stored = await chrome.storage.local.get(['extensionsCount']);
    const extCount = stored.extensionsCount || 0;

    const bitacora = {
        pc_id: id,
        voluntario_id: voluntarioId || null,
        voluntario_nombre_libre: nombreLibre || null,
        acciones_reportadas: { description: actions, people_helped: peopleCount, extensions: extCount },
        duracion_total: 20 + extCount * 5,
    };
    if (eventoId) bitacora.evento_id = eventoId;
    await supabasePost('bitacora_uso', bitacora);

    // Limpiar contador tras reportar
    await chrome.storage.local.set({ extensionsCount: 0 });
    await supabasePatch(`pcs_status?id=eq.${id}`, {
        estado: 'disponible', voluntario_id: null, voluntario_nombre_libre: null,
        inicio_sesion: null, tiempo_limite: null,
    });
}

async function getActiveVolunteers() {
    if (!eventoId) throw new Error('Debes configurar a qué Evento pertenece esta PC primero.');
    
    // Usar cache si es reciente (< 60s)
    const now = Date.now();
    if (volunteersCache && (now - volunteersCacheTime < VOLUNTEERS_CACHE_TTL)) {
        return volunteersCache;
    }

    try {
        const bookingsData = await supabaseGet(`bookings?select=user_id,users(id,full_name)&event_id=eq.${eventoId}&status=eq.confirmed`);
        
        if (!bookingsData || bookingsData.length === 0) {
            throw new Error('No hay voluntarios confirmados aún.');
        }
        
        const seen = new Set();
        const result = bookingsData
            .filter(b => b.users && !seen.has(b.user_id) && seen.add(b.user_id))
            .map(b => ({ id: b.user_id, fullName: b.users.full_name || 'Sin nombre' }))
            .sort((a, b) => a.fullName.localeCompare(b.fullName));
            
        volunteersCache = result;
        volunteersCacheTime = now;
        return result;
            
    } catch (e) {
        throw e;
    }
}

// ============================================================
// MANEJADOR DE MENSAJES
// ============================================================

async function handleMessage(message, sender, sendResponse) {
    // Re-hidratar si el worker estaba "frío"
    if (!pcId) await loadConfig();

    try {
        switch (message.type) {

            case 'GET_STATE': {
                const stored = await chrome.storage.local.get(['pcId', 'eventoId', 'eventoNombre', 'configured', 'currentState']);
                sendResponse({
                    pcId: stored.pcId, eventoId: stored.eventoId || null,
                    eventoNombre: stored.eventoNombre || null,
                    configured: !!stored.configured,
                    currentState: stored.currentState || null,
                    isOverlayActive,
                });
                break;
            }

            case 'GET_EVENTS': {
                const events = await getEvents();
                sendResponse({ success: true, events });
                break;
            }

            case 'CONFIGURE': {
                await configure(message.pcId, message.eventoId, message.eventoNombre);
                sendResponse({ success: true });
                break;
            }

            case 'RESET_CONFIG': {
                await resetConfig();
                sendResponse({ success: true });
                break;
            }

            case 'START_SESSION': {
                if (!pcId) throw new Error('PC no configurada');
                await startSession(pcId, message.userId, message.nombreLibre, 20);
                await checkStatus();
                sendResponse({ success: true });
                break;
            }

            case 'SNOOZE': {
                if (!pcId) throw new Error('PC no configurada');
                await snoozePc(pcId);
                await checkStatus();
                sendResponse({ success: true });
                break;
            }

            case 'SUBMIT_REPORT': {
                if (!pcId) throw new Error('PC no configurada');
                await submitReport(
                    pcId, message.voluntarioId, message.nombreLibre,
                    message.actions, message.peopleCount
                );
                await checkStatus();
                sendResponse({ success: true });
                break;
            }

            case 'LOGOUT_SESSION': {
                if (!pcId) throw new Error('PC no configurada');
                // Al forzar el tiempo actual, expiring = 0.
                await supabasePatch(`pcs_status?id=eq.${pcId}`, {
                    tiempo_limite: new Date().toISOString()
                });
                await checkStatus();
                sendResponse({ success: true });
                break;
            }

            case 'PAUSE_SESSION': {
                if (!pcId) throw new Error('PC no configurada');
                await pauseSession(pcId);
                await checkStatus();
                sendResponse({ success: true });
                break;
            }

            case 'RESUME_SESSION': {
                if (!pcId) throw new Error('PC no configurada');
                await resumeSession(pcId);
                await checkStatus();
                sendResponse({ success: true });
                break;
            }

            case 'GET_VOLUNTEERS': {
                const volunteers = await getActiveVolunteers();
                sendResponse({ success: true, volunteers });
                break;
            }

            case 'FORCE_CHECK': {
                await checkStatus();
                const stored = await chrome.storage.local.get(['currentState']);
                sendResponse({ success: true, currentState: stored.currentState });
                break;
            }

            default:
                sendResponse({ success: false, error: 'Tipo de mensaje desconocido' });
        }
    } catch (err) {
        console.warn(`[PC] Mensaje denegado o evento fallido [${message.type}]:`, err.message);
        sendResponse({ success: false, error: err.message });
    }
}

// ============================================================
// UTILIDADES
// ============================================================

function getRemainingSeconds(tiempoLimite) {
    if (!tiempoLimite) return 0;
    try { return Math.max(0, Math.floor((new Date(tiempoLimite).getTime() - Date.now()) / 1000)); }
    catch { return 0; }
}

function isExtensionPage(url) {
    if (!url) return true;
    return url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') || url.startsWith('about:') || url.startsWith('data:');
}
