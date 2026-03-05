// ============================================================
// PC STAND CONTROLLER - Popup Script (popup.js)
// ============================================================
// IMPORTANTE: Chrome MV3 bloquea onclick inline en HTML.
// Todos los event listeners se agregan desde aquí.

let timerInterval = null;
let autoRefreshInterval = null;
let remainingSeconds = 0;

// ---- Inicializar cuando el DOM está listo ----
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('config-btn')?.addEventListener('click', configurePc);
    document.getElementById('refresh-btn')?.addEventListener('click', forceRefresh);
    document.getElementById('reset-btn')?.addEventListener('click', resetConfig);
    document.getElementById('pc-id-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') configurePc();
    });

    // Cargar eventos y estado inicial; auto-refrescar cada 6s
    loadEvents();
    refreshState();
    autoRefreshInterval = setInterval(refreshState, 6000);
});

window.addEventListener('unload', () => {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    stopTimer();
});

// ============================================================
// CARGAR EVENTOS
// ============================================================
async function loadEvents() {
    const sel = document.getElementById('evento-select');
    if (!sel) return;
    try {
        const res = await chrome.runtime.sendMessage({ type: 'GET_EVENTS' });
        if (res?.success && res.events?.length > 0) {
            sel.innerHTML = '<option value="">— Seleccioná el evento —</option>' +
                res.events.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
        } else {
            sel.innerHTML = '<option value="">⚠ No hay eventos activos</option>';
        }
    } catch (err) {
        sel.innerHTML = `<option value="">⚠ Error: ${err.message}</option>`;
    }
}

// ============================================================
// ESTADO
// ============================================================
async function refreshState() {
    try {
        const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
        console.log('[Popup] Estado recibido:', state);
        renderState(state);
    } catch (err) {
        console.error('[Popup] Error al conectar con service worker:', err);
        showNotice('config-notice', 'Error de conexión con la extensión.', 'error');
    }
}

function renderState(state) {
    const configSection = document.getElementById('config-section');
    const infoSection = document.getElementById('info-section');
    const statusBadge = document.getElementById('status-badge');
    const statusText = document.getElementById('status-text');
    const infoPcId = document.getElementById('info-pc-id');
    const infoEvento = document.getElementById('info-evento');
    const infoVolunteer = document.getElementById('info-volunteer');
    const timerSection = document.getElementById('timer-section');
    const lastUpdate = document.getElementById('last-update-text');

    if (lastUpdate) {
        lastUpdate.textContent = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    }

    if (!state?.configured) {
        configSection?.classList.remove('hidden');
        infoSection?.classList.add('hidden');
        setBadge(statusBadge, statusText, 'sin-config', '⚙️ Sin configurar');
        return;
    }

    // Configurado
    configSection?.classList.add('hidden');
    infoSection?.classList.remove('hidden');
    if (infoPcId) infoPcId.textContent = state.pcId ?? '?';
    if (infoEvento) infoEvento.textContent = state.eventoNombre || state.eventoId || '—';

    const current = state.currentState;
    if (!current) {
        setBadge(statusBadge, statusText, 'sin-config', '🔄 Conectando...');
        timerSection?.classList.add('hidden');
        return;
    }

    const estado = current.estado || 'disponible';

    if (estado === 'disponible') {
        setBadge(statusBadge, statusText, 'disponible', '✅ Disponible');
        if (infoVolunteer) infoVolunteer.textContent = '—';
        timerSection?.classList.add('hidden');
        stopTimer();

    } else if (estado === 'ocupada') {
        const nombre = current.voluntario_nombre || '—';
        setBadge(statusBadge, statusText, 'ocupada', `🧑‍💻 En uso: ${nombre.split(' ')[0]}`);
        if (infoVolunteer) infoVolunteer.textContent = nombre;
        timerSection?.classList.remove('hidden');

        if (current.tiempo_limite) {
            remainingSeconds = Math.max(0, Math.floor(
                (new Date(current.tiempo_limite).getTime() - Date.now()) / 1000
            ));
            updateTimerDisplay();
            startTimer();
        }

    } else if (estado === 'bloqueada') {
        setBadge(statusBadge, statusText, 'bloqueada', '🔒 Bloqueada');
        timerSection?.classList.add('hidden');
        stopTimer();

    } else {
        setBadge(statusBadge, statusText, 'sin-config', `🔧 ${estado}`);
        timerSection?.classList.add('hidden');
    }
}

function setBadge(badgeEl, textEl, cssClass, text) {
    if (badgeEl) badgeEl.className = `status-badge ${cssClass}`;
    if (textEl) textEl.textContent = text;
}

// ============================================================
// TIMER LOCAL
// ============================================================
function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
        if (remainingSeconds > 0) { remainingSeconds--; updateTimerDisplay(); }
        else stopTimer();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('timer-display');
    const timerValue = document.getElementById('timer-value');
    if (!timerValue) return;

    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    timerValue.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (timerDisplay) {
        timerDisplay.className = 'timer-display';
        if (remainingSeconds <= 60) timerDisplay.classList.add('critical');
        else if (remainingSeconds <= 300) timerDisplay.classList.add('warning');
    }
}

// ============================================================
// ACCIONES
// ============================================================
async function configurePc() {
    const input = document.getElementById('pc-id-input');
    const evSelect = document.getElementById('evento-select');
    const pcId = parseInt(input?.value);
    const eventoId = evSelect?.value || null;
    // Leer el texto del option seleccionado como nombre legible
    const eventoNombre = evSelect?.options[evSelect.selectedIndex]?.text || null;

    if (!pcId || pcId < 1 || pcId > 99) {
        showNotice('config-notice', 'Ingresá un número de PC válido (1-99)', 'error');
        return;
    }
    if (!eventoId) {
        showNotice('config-notice', 'Seleccioná un evento antes de guardar', 'error');
        return;
    }

    const btn = document.getElementById('config-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
        console.log('[Popup] CONFIGURE pcId:', pcId, '| eventoId:', eventoId, '| nombre:', eventoNombre);
        const res = await chrome.runtime.sendMessage({ type: 'CONFIGURE', pcId, eventoId, eventoNombre });
        console.log('[Popup] Respuesta:', res);

        if (res?.success) {
            showNotice('config-notice', '✅ PC configurada correctamente', 'success');
            setTimeout(refreshState, 2000);
        } else {
            throw new Error(res?.error || 'Error desconocido');
        }
    } catch (err) {
        console.error('[Popup] Error en configurePc:', err);
        showNotice('config-notice', `Error: ${err.message}`, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
    }
}


async function resetConfig() {
    if (!confirm('¿Cambiar la configuración de esta PC?')) return;
    try {
        await chrome.runtime.sendMessage({ type: 'RESET_CONFIG' });
        stopTimer();
        loadEvents();   // recargar eventos al resetear
        await refreshState();
    } catch (err) {
        showNotice('action-notice', `Error: ${err.message}`, 'error');
    }
}

async function forceRefresh() {
    const btn = document.getElementById('refresh-btn');
    if (btn) { btn.disabled = true; btn.textContent = '🔄 ...'; }
    try {
        await chrome.runtime.sendMessage({ type: 'FORCE_CHECK' });
        await refreshState();
    } catch (err) {
        console.error('[Popup] Error en forceRefresh:', err);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Actualizar'; }
    }
}

// ============================================================
// UTILIDADES
// ============================================================
function showNotice(containerId, text, type) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.textContent = text;
    el.className = `notice ${type}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}
