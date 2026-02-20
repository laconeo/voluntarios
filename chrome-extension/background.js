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
const ALARM_PERIOD_MIN = 0.1;  // cada ~6 segundos (mínimo Chrome = 0.1 min = 6s)

let pcId = null;
let eventoId = null;
let currentState = null;
let isOverlayActive = false;

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

async function configure(newPcId, newEventoId) {
    pcId = parseInt(newPcId);
    eventoId = newEventoId || null;
    await chrome.storage.local.set({ pcId, eventoId, configured: true });
    scheduleAlarm();           // asegurar alarm activo al configurar
    await checkStatus();       // check inmediato
    console.log(`[PC] Configurado PC=${pcId} | Evento=${eventoId}`);
}

async function resetConfig() {
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
    if (!pcId) return;

    let pcData = null;
    try {
        pcData = await fetchPcStatus(pcId, eventoId);
    } catch (err) {
        console.error('[PC] Error al consultar Supabase:', err.message);
        return; // No cambiar estado si hay error de red — mantener lo que había
    }

    if (!pcData) {
        // La PC no existe en DB → registrarla
        try { await registerPc(pcId, eventoId); } catch { /* ya existe */ }
        await syncState({ estado: 'disponible', tiempo_limite: null, voluntario_id: null, voluntario_nombre: null });
        return;
    }

    await syncState({
        estado: pcData.estado || 'disponible',
        tiempo_limite: pcData.tiempo_limite || null,
        voluntario_id: pcData.voluntario_id || null,
        voluntario_nombre: pcData.voluntario?.full_name || pcData.voluntario_nombre_libre || null,
        voluntario_nombre_libre: pcData.voluntario_nombre_libre || null,
    });
}

async function syncState(newState) {
    const prevEstado = currentState?.estado;
    currentState = newState;

    // Persistir en storage para que popup y worker "frío" lean el último estado
    await chrome.storage.local.set({ currentState, isOverlayActive });

    let shouldBlock = true;

    if (newState.estado === 'ocupada' && newState.tiempo_limite) {
        const remaining = getRemainingSeconds(newState.tiempo_limite);
        if (remaining > 0) {
            shouldBlock = false;
            broadcastToTabs({
                type: 'TIMER_UPDATE',
                remaining,
                voluntarioNombre: newState.voluntario_nombre,
            });
        }
    } else if (newState.estado === 'disponible') {
        shouldBlock = true;
    }

    if (shouldBlock && !isOverlayActive) {
        isOverlayActive = true;
        await chrome.storage.local.set({ isOverlayActive });
        broadcastToTabs({ type: 'SHOW_OVERLAY', pcId, currentState: newState });
    } else if (!shouldBlock && isOverlayActive) {
        isOverlayActive = false;
        await chrome.storage.local.set({ isOverlayActive });
        broadcastToTabs({ type: 'HIDE_OVERLAY' });
    }

    console.log(`[PC] Estado=${newState.estado} | Overlay=${isOverlayActive} | Restante=${newState.tiempo_limite ? getRemainingSeconds(newState.tiempo_limite) + 's' : 'n/a'}`);
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
    const body = { id, estado: 'disponible' };
    if (evId) body.evento_id = evId;
    await supabasePost('pcs_status', body);
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
}

async function snoozePc(id) {
    const data = await supabaseGet(`pcs_status?select=tiempo_limite&id=eq.${id}`);
    if (!data?.[0]?.tiempo_limite) throw new Error('No se encontró tiempo_limite');
    // Extender desde el límite actual o desde ahora, lo que sea mayor
    const base = Math.max(new Date(data[0].tiempo_limite).getTime(), Date.now());
    await supabasePatch(`pcs_status?id=eq.${id}`, {
        tiempo_limite: new Date(base + 5 * 60000).toISOString(),
    });
}

async function submitReport(id, voluntarioId, nombreLibre, actions, peopleCount, extensionsCount) {
    const bitacora = {
        pc_id: id,
        voluntario_id: voluntarioId || null,
        voluntario_nombre_libre: nombreLibre || null,
        acciones_reportadas: { description: actions, people_helped: peopleCount, extensions: extensionsCount },
        duracion_total: 20 + extensionsCount * 5,
    };
    if (eventoId) bitacora.evento_id = eventoId;
    await supabasePost('bitacora_uso', bitacora);
    await supabasePatch(`pcs_status?id=eq.${id}`, {
        estado: 'disponible', voluntario_id: null, voluntario_nombre_libre: null,
        inicio_sesion: null, tiempo_limite: null,
    });
}

async function getActiveVolunteers() {
    // 1. Voluntarios con booking confirmado en el evento
    if (eventoId) {
        try {
            const data = await supabaseGet(
                `bookings?select=user:users(id,full_name)&evento_id=eq.${eventoId}&status=eq.confirmed`
            );
            if (data?.length > 0) {
                const seen = new Set();
                return data
                    .filter(b => b.user && !seen.has(b.user.id) && seen.add(b.user.id))
                    .map(b => ({ id: b.user.id, fullName: b.user.full_name }))
                    .sort((a, b) => a.fullName.localeCompare(b.fullName));
            }
        } catch (e) { console.warn('[PC] Fallback voluntarios:', e.message); }
    }
    // 2. Usuarios activos
    try {
        const data = await supabaseGet('users?select=id,full_name&status=eq.active&order=full_name.asc');
        if (data?.length > 0) return data.map(u => ({ id: u.id, fullName: u.full_name }));
    } catch { /* ignorar */ }
    // 3. Todos los usuarios
    const data = await supabaseGet('users?select=id,full_name&order=full_name.asc');
    return (data || []).map(u => ({ id: u.id, fullName: u.full_name }));
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
                const stored = await chrome.storage.local.get(['pcId', 'eventoId', 'configured', 'currentState']);
                sendResponse({
                    pcId: stored.pcId, eventoId: stored.eventoId || null,
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
                await configure(message.pcId, message.eventoId);
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
                    message.actions, message.peopleCount, message.extensionsCount
                );
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
        console.error('[PC] Error en handleMessage:', message.type, err.message);
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
