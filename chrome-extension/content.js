// ============================================================
// PC STAND CONTROLLER - Content Script
// Estilos fieles al design system FamilySearch Frontier:
//  · Verde primario: #8CB83E
//  · Azul links:     #005994
//  · Texto:          #282829
//  · Bordes:         #dcdcdc
//  · Fuente:         Roboto (o system-ui)
//  · Botones pill:   border-radius 20px, uppercase
// ============================================================

(function () {
  'use strict';
  if (window.__pcStandController) return;
  window.__pcStandController = true;

  // ---- Estado local ----
  let overlayEl = null;
  let widgetEl = null;
  let localTimerInterval = null;
  let remainingSeconds = 0;
  let menuOpen = false;

  // Contador de extensiones acumulado por sesión (persiste entre aperturas del overlay)
  let sessionExtensions = 0;

  // FS Design Tokens
  const FS = {
    green: '#8CB83E',
    greenHover: '#7cb342',
    greenDark: '#558b2f',
    blue: '#005994',
    text: '#282829',
    textLight: '#575757',
    border: '#dcdcdc',
    bg: '#ffffff',
    bgAlt: '#f3f3f3',
    shadow: '0 2px 4px rgba(0,0,0,.10)',
    shadowModal: '0 10px 25px rgba(0,0,0,.20)',
    radius: '8px',
    radiusPill: '20px',
    font: '"Roboto","Segoe UI",system-ui,Arial,sans-serif',
    orange: '#e67e22',
    red: '#c0392b',
  };

  // Quick-links del stand
  const QUICK_LINKS = [
    { icon: '🌳', label: 'Crear Árbol', url: 'https://www.familysearch.org/es/gettingstarted/create-family-tree' },
    { icon: '🎁', label: 'Regalo', url: 'https://www.familysearch.org/es/tree-designs/global/' },
    { icon: '📖', label: 'Apellido', url: 'https://www.familysearch.org/es/surname' },
    { icon: '📷', label: 'Rincón de tus Abuelos', url: 'https://www.familysearch.org/es/campaign/photocollage/editor' },
    { icon: '❓', label: 'Ayuda', url: 'https://laconeo.github.io/centro-virtual/' },
  ];

  // ============================================================
  // MENSAJES DEL SERVICE WORKER
  // ============================================================
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'SHOW_OVERLAY') {
      removeWidget();
      showOverlay(msg.pcId, msg.currentState);
      sendResponse({ ok: true });
    } else if (msg.type === 'HIDE_OVERLAY') {
      sessionExtensions = 0; // nueva sesión → resetear contador
      hideOverlay();
      sendResponse({ ok: true });
    } else if (msg.type === 'TIMER_UPDATE') {
      remainingSeconds = msg.remaining;
      if (!overlayEl) {
        ensureWidget();
        syncTimer();
      }
      sendResponse({ ok: true });
    }
    return false;
  });

  // ============================================================
  // OVERLAY FULLSCREEN
  // ============================================================
  function showOverlay(pcId, state) {
    if (!overlayEl) {
      overlayEl = el('div', {
        position: 'fixed', inset: '0', zIndex: '2147483647',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(40,40,41,.55)',
        backdropFilter: 'blur(3px)',
        padding: '16px', boxSizing: 'border-box',
        fontFamily: FS.font,
      });
      document.documentElement.appendChild(overlayEl);
    }
    document.body.style.overflow = 'hidden';

    const isAvailable = !state || state.estado === 'disponible';
    if (isAvailable) {
      overlayEl.innerHTML = loginHTML(pcId);
      wireLogin(pcId, state);
    } else {
      overlayEl.innerHTML = reportHTML(state);
      wireReport(state);
    }
  }

  function hideOverlay() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    document.body.style.overflow = '';
    ensureWidget();
    startCountdown();
  }

  // ============================================================
  // CARD BASE (estilo FS: blanco, borde gris, sombra suave)
  // ============================================================
  function card({ headerIcon, headerTitle, headerSub, body }) {
    return `
      <div style="
        background:${FS.bg};
        border:1px solid ${FS.border};
        border-radius:${FS.radius};
        box-shadow:${FS.shadowModal};
        width:100%; max-width:440px;
        overflow:hidden;
        animation:__fsIn__ .22s ease;
        font-family:${FS.font};
      ">
        <!-- Header verde FS -->
        <div style="
          background:${FS.green}; color:#fff;
          padding:28px 32px 22px; text-align:center;
        ">
          <div style="font-size:38px;margin-bottom:10px;line-height:1;">${headerIcon}</div>
          <div style="font-size:19px;font-weight:500;letter-spacing:-.2px;">${headerTitle}</div>
          ${headerSub ? `<div style="font-size:13px;opacity:.88;margin-top:4px;">${headerSub}</div>` : ''}
        </div>
        <!-- Cuerpo -->
        <div style="padding:28px 32px 32px;background:${FS.bg};">
          ${body}
        </div>
      </div>
      <style>
        @keyframes __fsIn__ {
          from { opacity:0; transform:translateY(-12px) scale(.98); }
          to   { opacity:1; transform:none; }
        }
        .__fs-btn-primary__ {
          background:${FS.green}; color:#fff;
          border:none; border-radius:${FS.radiusPill};
          padding:10px 28px; font-family:${FS.font};
          font-size:.875rem; font-weight:600;
          letter-spacing:.5px; text-transform:uppercase;
          cursor:pointer; transition:background .18s;
          width:100%;
        }
        .__fs-btn-primary__:hover  { background:${FS.greenHover}; }
        .__fs-btn-primary__:active { background:${FS.greenDark};  }
        .__fs-btn-primary__:disabled { opacity:.5; cursor:not-allowed; }
        .__fs-btn-ghost__ {
          background:${FS.bg}; color:${FS.text};
          border:1px solid ${FS.border}; border-radius:${FS.radiusPill};
          padding:10px 22px; font-family:${FS.font};
          font-size:.875rem; font-weight:500;
          letter-spacing:.4px; text-transform:uppercase;
          cursor:pointer; transition:background .15s;
          flex:1;
        }
        .__fs-btn-ghost__:hover { background:${FS.bgAlt}; }
        .__fs-btn-ghost__:disabled { opacity:.5; cursor:not-allowed; }
        .__fs-select__ {
          width:100%; padding:10px 12px;
          border:1px solid ${FS.border}; border-radius:4px;
          font-family:${FS.font}; font-size:15px;
          color:${FS.text}; background:${FS.bg};
          box-sizing:border-box; outline:none;
          transition:border-color .18s, box-shadow .18s;
        }
        .__fs-select__:focus {
          border-color:${FS.blue};
          box-shadow:0 0 0 3px rgba(0,89,148,.10);
        }
        .__fs-label__ {
          display:block; font-size:13px; font-weight:500;
          color:${FS.textLight}; margin-bottom:6px;
        }
        .__fs-notice__ {
          margin-top:12px; padding:10px 14px;
          border-radius:4px; font-size:13px; font-weight:500;
          display:none; text-align:center;
        }
      </style>
    `;
  }

  // ============================================================
  // PANTALLA LOGIN
  // ============================================================
  function loginHTML(pcId) {
    return card({
      headerIcon: '💻',
      headerTitle: `PC Disponible`,
      headerSub: 'Seleccioná tu nombre para comenzar',
      body: `
        <div style="margin-bottom:14px;">
          <label class="__fs-label__">Voluntario</label>
          <select id="__fs-vol__" class="__fs-select__">
            <option value="">Cargando lista…</option>
          </select>
        </div>

        <!-- Input libre (se muestra solo al elegir "Otro") -->
        <div id="__fs-otro-wrap__" style="margin-bottom:18px;display:none;">
          <label class="__fs-label__">Ingresá tu nombre completo</label>
          <input
            type="text"
            id="__fs-otro-nombre__"
            placeholder="Nombre y apellido"
            maxlength="80"
            style="
              width:100%;padding:10px 12px;
              border:1px solid ${FS.border};border-radius:4px;
              font-size:14px;color:${FS.text};background:${FS.bg};
              box-sizing:border-box;outline:none;
              transition:border-color .18s,box-shadow .18s;
            "
          />
        </div>

        <button id="__fs-start__" class="__fs-btn-primary__">
          Iniciar sesión &mdash; 20 min
        </button>
        <div id="__fs-lmsg__" class="__fs-notice__"></div>
        <p style="font-size:12px;color:${FS.textLight};text-align:center;margin:18px 0 0;">
          ¿No estás en la lista? Seleccioná <strong>Otro (comodín)</strong> e ingresá tu nombre.
        </p>
      `
    });
  }


  async function wireLogin(pcId, state) {
    const sel = document.getElementById('__fs-vol__');
    const btn = document.getElementById('__fs-start__');
    const wrap = document.getElementById('__fs-otro-wrap__');
    const input = document.getElementById('__fs-otro-nombre__');
    if (!sel || !btn) return;

    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_VOLUNTEERS' });
      if (res?.success && res.volunteers?.length > 0) {
        sel.innerHTML = '<option value="">— Seleccioná tu nombre —</option>' +
          res.volunteers.map(v => `<option value="${escHtml(v.id)}">${escHtml(v.fullName)}</option>`).join('') +
          '<option value="__otro__">——————————</option>' +
          '<option value="__otro__">👤 Otro (comodín)</option>';
      } else {
        sel.innerHTML = `<option value="">⚠ ${escHtml(res?.error || 'Sin voluntarios activos')}</option>` +
          '<option value="__otro__">👤 Otro (comodín)</option>';
      }
    } catch (e) {
      sel.innerHTML = `<option value="">⚠ Error: ${escHtml(e.message)}</option>` +
        '<option value="__otro__">👤 Otro (comodín)</option>';
    }

    // Mostrar/ocultar input libre al seleccionar "Otro"
    sel.addEventListener('change', () => {
      const esOtro = sel.value === '__otro__';
      if (wrap) wrap.style.display = esOtro ? 'block' : 'none';
      if (esOtro && input) {
        input.style.borderColor = FS.border;
        input.style.boxShadow = '';
        setTimeout(() => input.focus(), 50);
      }
    });

    btn.addEventListener('click', async () => {
      const isOtro = sel.value === '__otro__';
      const userId = isOtro ? null : sel.value;
      const nombre = isOtro ? input?.value?.trim() : null;

      if (!isOtro && !userId) {
        notice('__fs-lmsg__', 'Seleccioná tu nombre antes de continuar.', 'warn');
        return;
      }
      if (isOtro && !nombre) {
        notice('__fs-lmsg__', 'Ingresá tu nombre completo.', 'warn');
        if (input) { input.style.borderColor = '#e53935'; input.focus(); }
        return;
      }

      btn.disabled = true; btn.textContent = 'Iniciando…';
      try {
        const res = await chrome.runtime.sendMessage({
          type: 'START_SESSION',
          userId,
          nombreLibre: nombre,   // null si no es comodín
        });
        if (res?.success) {
          sessionExtensions = 0;
          notice('__fs-lmsg__', '¡Sesión iniciada! Podés comenzar a trabajar.', 'ok');
          setTimeout(() => hideOverlay(), 1600);
        } else throw new Error(res?.error || 'Error desconocido');
      } catch (e) {
        notice('__fs-lmsg__', e.message, 'err');
        btn.disabled = false; btn.textContent = 'Iniciar sesión — 20 min';
      }
    });
  }

  // ============================================================
  // PANTALLA REPORTE
  // ============================================================
  function reportHTML(state) {
    const nombre = state?.voluntario_nombre?.split(' ')[0] || 'Voluntario';
    return card({
      headerIcon: '⏰',
      headerTitle: '¡Tiempo Completado!',
      headerSub: `Hola ${escHtml(nombre)}, tu sesión de 20 minutos ha terminado.`,
      body: `
        <!-- Divisor de sección -->
        <div style="font-size:13px;font-weight:600;color:${FS.textLight};text-transform:uppercase;letter-spacing:.6px;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid ${FS.border};">
          Reporte de Actividad
        </div>

        <div style="margin-bottom:18px;">
          <label class="__fs-label__">¿Qué actividad realizaste?</label>
          <select id="__fs-act__" class="__fs-select__">
            <option value="">— Seleccioná una actividad —</option>
            <option>Crear cuenta FamilySearch</option>
            <option>Árbol Familiar / Recuerdos</option>
            <option>Indexación / Revisión</option>
            <option>Participa</option>
            <option>Otros</option>
          </select>
        </div>

        <div style="margin-bottom:24px;">
          <label class="__fs-label__">¿A cuántas personas ayudaste?</label>
          <div style="display:flex;align-items:center;justify-content:center;gap:20px;">
            <button id="__fs-minus__" style="
              width:34px;height:34px;border-radius:50%;cursor:pointer;
              border:1px solid ${FS.border};background:${FS.bgAlt};
              font-size:18px;color:${FS.text};line-height:1;
            ">−</button>
            <span id="__fs-cnt__" style="
              font-size:30px;font-weight:300;color:${FS.text};
              min-width:44px;text-align:center;
            ">0</span>
            <button id="__fs-plus__" style="
              width:34px;height:34px;border-radius:50%;cursor:pointer;
              border:1px solid ${FS.border};background:${FS.bgAlt};
              font-size:18px;color:${FS.text};line-height:1;
            ">+</button>
          </div>
        </div>

        <div style="display:flex;gap:10px;">
          <button id="__fs-snooze__" class="__fs-btn-ghost__">+ 5 minutos</button>
          <button id="__fs-submit__" class="__fs-btn-primary__" style="flex:2;">
            Finalizar y liberar PC
          </button>
        </div>
        <div id="__fs-rmsg__" class="__fs-notice__"></div>
      `
    });
  }

  function wireReport(state) {
    // 'count' es local (personas ayudadas en esta apertura del overlay)
    // 'sessionExtensions' es del módulo — persiste entre snoozes
    let count = 0;
    const cntEl = document.getElementById('__fs-cnt__');
    const minusEl = document.getElementById('__fs-minus__');
    const plusEl = document.getElementById('__fs-plus__');
    const snooze = document.getElementById('__fs-snooze__');
    const submit = document.getElementById('__fs-submit__');
    const actSel = document.getElementById('__fs-act__');

    minusEl?.addEventListener('click', () => { if (count > 0) { count--; if (cntEl) cntEl.textContent = count; } });
    plusEl?.addEventListener('click', () => { count++; if (cntEl) cntEl.textContent = count; });

    snooze?.addEventListener('click', async () => {
      snooze.disabled = true; snooze.textContent = 'Extendiendo…';
      try {
        const res = await chrome.runtime.sendMessage({ type: 'SNOOZE' });
        if (res?.success) {
          sessionExtensions++;
          const ext = sessionExtensions;
          notice('__fs-rmsg__', `¡+5 minutos! (${ext} extensión${ext !== 1 ? 'es' : ''} en total)`, 'ok');
          setTimeout(() => hideOverlay(), 1600);
        } else throw new Error(res?.error || 'Error');
      } catch (e) {
        notice('__fs-rmsg__', e.message, 'err');
        snooze.disabled = false; snooze.textContent = '+ 5 minutos';
      }
    });

    submit?.addEventListener('click', async () => {
      const actions = actSel?.value;
      if (!actions) { notice('__fs-rmsg__', 'Seleccioná una actividad antes de continuar.', 'warn'); return; }
      submit.disabled = true; submit.textContent = 'Guardando…';
      try {
        const res = await chrome.runtime.sendMessage({
          type: 'SUBMIT_REPORT',
          voluntarioId: state?.voluntario_id,
          nombreLibre: state?.voluntario_nombre_libre || null,
          actions, peopleCount: count, extensionsCount: sessionExtensions
        });
        if (res?.success) {
          notice('__fs-rmsg__', '¡Reporte guardado! Gracias por tu servicio.', 'ok');
          setTimeout(() => {
            if (overlayEl) showOverlay(null, { estado: 'disponible' });
          }, 2200);
        } else throw new Error(res?.error || 'Error desconocido');
      } catch (e) {
        notice('__fs-rmsg__', e.message, 'err');
        submit.disabled = false; submit.textContent = 'Finalizar y liberar PC';
      }
    });
  }

  // ============================================================
  // WIDGET FLOTANTE: Badge timer + menú de links
  // Estilo FS: pill verde, borde gris, card blanca
  // ============================================================
  function ensureWidget() {
    if (widgetEl) return;

    widgetEl = el('div', {
      position: 'fixed', bottom: '16px', right: '16px',
      zIndex: '2147483640',
      fontFamily: FS.font,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px',
    });

    // ---- Panel de links ----
    const panel = el('div', {
      background: FS.bg,
      border: `1px solid ${FS.border}`,
      borderRadius: FS.radius,
      boxShadow: FS.shadowModal,
      overflow: 'hidden',
      display: 'none',
      minWidth: '228px',
    });
    panel.id = '__fs-panel__';

    // Encabezado del panel
    const ph = el('div', {
      background: FS.green, color: '#fff',
      padding: '9px 14px',
      fontSize: '11px', fontWeight: '600',
      letterSpacing: '.7px', textTransform: 'uppercase',
    });
    ph.textContent = 'Actividades del Stand';
    panel.appendChild(ph);

    // Links
    QUICK_LINKS.forEach(({ icon, label, url }, i) => {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      Object.assign(a.style, {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '11px 14px',
        textDecoration: 'none',
        color: FS.blue,
        fontSize: '14px', fontWeight: '400',
        borderBottom: i < QUICK_LINKS.length - 1 ? `1px solid ${FS.border}` : 'none',
        background: FS.bg,
        transition: 'background .12s',
      });
      a.innerHTML = `<span style="font-size:16px;width:20px;text-align:center;">${icon}</span><span>${escHtml(label)}</span>`;
      a.addEventListener('mouseover', () => { a.style.background = FS.bgAlt; });
      a.addEventListener('mouseout', () => { a.style.background = FS.bg; });
      panel.appendChild(a);
    });

    // ---- Badge del timer ----
    const badge = el('div', {
      background: FS.green, color: '#fff',
      borderRadius: FS.radiusPill,
      padding: '8px 16px 8px 14px',
      fontSize: '14px', fontWeight: '500',
      display: 'flex', alignItems: 'center', gap: '7px',
      boxShadow: `0 2px 6px rgba(0,0,0,.18)`,
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'background .25s',
      letterSpacing: '.2px',
    });
    badge.id = '__fs-badge__';
    badge.title = 'Ver actividades del stand';

    badge.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      <span id="__fs-time__">--:--</span>
      <svg id="__fs-arr__" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="opacity:.75;transition:transform .2s;">
        <polyline points="18 15 12 9 6 15"/>
      </svg>
    `;

    badge.addEventListener('click', () => {
      menuOpen = !menuOpen;
      panel.style.display = menuOpen ? 'block' : 'none';
      const arr = document.getElementById('__fs-arr__');
      if (arr) arr.style.transform = menuOpen ? 'rotate(180deg)' : '';
    });

    // Cerrar el panel al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (widgetEl && !widgetEl.contains(e.target)) {
        menuOpen = false;
        panel.style.display = 'none';
        const arr = document.getElementById('__fs-arr__');
        if (arr) arr.style.transform = '';
      }
    }, true);

    widgetEl.appendChild(panel);
    widgetEl.appendChild(badge);
    document.documentElement.appendChild(widgetEl);
  }

  function removeWidget() {
    stopCountdown();
    menuOpen = false;
    if (widgetEl) { widgetEl.remove(); widgetEl = null; }
  }

  function syncTimer() {
    const timeEl = document.getElementById('__fs-time__');
    const badgeEl = document.getElementById('__fs-badge__');
    if (!timeEl) return;

    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    timeEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (badgeEl) {
      if (remainingSeconds <= 60) badgeEl.style.background = FS.red;
      else if (remainingSeconds <= 300) badgeEl.style.background = FS.orange;
      else badgeEl.style.background = FS.green;
    }

    if (remainingSeconds === 300) toast('Quedan 5 minutos de sesión', 'warn');
    if (remainingSeconds === 60) toast('¡Queda 1 minuto! Guardá tu trabajo', 'err');
  }

  function startCountdown() {
    stopCountdown();
    localTimerInterval = setInterval(() => {
      if (remainingSeconds > 0) { remainingSeconds--; syncTimer(); }
    }, 1000);
  }

  function stopCountdown() {
    if (localTimerInterval) { clearInterval(localTimerInterval); localTimerInterval = null; }
  }

  // ============================================================
  // HELPERS
  // ============================================================

  /** Crea un div con los estilos dados */
  function el(tag, styles = {}) {
    const node = document.createElement(tag);
    Object.assign(node.style, styles);
    return node;
  }

  /** Escapa HTML básico para evitar XSS */
  function escHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** Muestra un mensaje de estado inline dentro del overlay */
  function notice(id, text, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
    const ok = type === 'ok';
    const wrn = type === 'warn';
    el.style.background = ok ? '#f1f8e9' : wrn ? '#fff8e1' : '#fdecea';
    el.style.color = ok ? '#33691e' : wrn ? '#e65100' : '#b71c1c';
    el.style.border = `1px solid ${ok ? '#c5e1a5' : wrn ? '#ffe082' : '#ef9a9a'}`;
  }

  /** Toast flotante esquina superior derecha */
  let _toastT = null;
  function toast(text, type = 'info') {
    const old = document.getElementById('__fs-toast__');
    if (old) old.remove();
    const t = el('div', {
      position: 'fixed', top: '16px', right: '16px', zIndex: '2147483646',
      padding: '10px 18px', borderRadius: '4px',
      fontFamily: FS.font, fontSize: '13px', fontWeight: '500',
      color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.2)',
      background: type === 'err' ? FS.red : type === 'warn' ? FS.orange : FS.green,
    });
    t.id = '__fs-toast__';
    t.textContent = text;
    document.documentElement.appendChild(t);
    if (_toastT) clearTimeout(_toastT);
    _toastT = setTimeout(() => t.remove(), 4000);
  }

})();
