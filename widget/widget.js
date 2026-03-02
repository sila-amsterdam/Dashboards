/**
 * Chat Widget – herbruikbaar embed script
 *
 * Gebruik op elke website (geen server nodig):
 *   <script
 *     src="https://jouwebsite.nl/widget.js"
 *     data-config='{"webhookUrl":"https://...","branding":{"name":"..."},"theme":{"primaryColor":"#f21c00","secondaryColor":"#ff7a42"}}'>
 *   </script>
 *
 * Of met een API-server (optioneel):
 *   <script src="https://jouwebsite.nl/widget.js" data-widget-id="abc123"></script>
 */

(function () {
  'use strict';

  // ─── 1. Vind onze eigen <script>-tag ─────────────────────────────────────────

  var me = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('widget.js') !== -1) {
        return scripts[i];
      }
    }
    return null;
  }());

  // ─── 2. Config bepalen ────────────────────────────────────────────────────────
  // Methode A: data-config (inline JSON, geen server nodig)
  // Methode B: data-widget-id (haalt config op via API)

  var configAttr = me && me.getAttribute('data-config');

  if (configAttr) {
    // Methode A: inline config — werkt direct zonder server
    var cfg;
    try {
      cfg = JSON.parse(configAttr);
    } catch (e) {
      console.error('[ChatWidget] data-config is geen geldige JSON.', e);
      return;
    }
    if (!cfg || !cfg.webhookUrl) {
      console.error('[ChatWidget] data-config mist webhookUrl.');
      return;
    }
    whenReady(function () { mount(cfg); });
    return;
  }

  // Methode B: data-widget-id + API fetch
  var widgetId = me && me.getAttribute('data-widget-id');

  if (!widgetId) {
    console.error('[ChatWidget] Voeg data-config of data-widget-id toe aan de <script>-tag.');
    return;
  }

  if (document.getElementById('cw-root-' + widgetId)) return;

  var scriptSrc = me ? me.src : '';
  var API_BASE  = scriptSrc
    ? scriptSrc.replace(/\/widget\.js(\?.*)?$/, '')
    : 'http://localhost:3000';

  var ctrl  = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 5000) : null;

  fetch(API_BASE + '/api/widgets/' + encodeURIComponent(widgetId), {
    headers: { Accept: 'application/json' },
    signal:  ctrl ? ctrl.signal : undefined
  })
    .then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (cfg) {
      if (!cfg || !cfg.webhookUrl) throw new Error('Config mist webhookUrl');
      whenReady(function () { mount(cfg); });
    })
    .catch(function (err) {
      clearTimeout(timer);
      console.warn('[ChatWidget] Widget kon niet laden (id=' + widgetId + '):', err.message);
    });

  // ─── Wacht op DOM ready ───────────────────────────────────────────────────────

  function whenReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  // ─── 3. Widget mounten ────────────────────────────────────────────────────────

  function mount(cfg) {
    // Stabiele unieke namespace — gebruik widgetId of hash van webhookUrl
    var nsBase   = (widgetId || hashStr(cfg.webhookUrl || '')).replace(/[^a-z0-9]/gi, '');
    var ns       = 'cw' + nsBase.substring(0, 8);
    var rootId   = 'cw-root-' + ns;

    if (document.getElementById(rootId)) return; // dubbele mount voorkomen

    var sessionKey = 'cw_sess_' + ns;
    var sessionId;
    try { sessionId = localStorage.getItem(sessionKey); } catch (e) {}
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      try { localStorage.setItem(sessionKey, sessionId); } catch (e) {}
    }

    var theme    = cfg.theme    || {};
    var branding = cfg.branding || {};
    var primary  = theme.primaryColor   || '#6366f1';
    var secondary= theme.secondaryColor || '#4f46e5';
    var border   = hexToRgba(primary, 0.22);

    injectStyles(ns, primary, secondary, border);
    buildDOM(rootId, ns, cfg, branding, primary, secondary, sessionId);
  }

  // ─── Simpele hash voor namespace als er geen widgetId is ─────────────────────

  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = (Math.imul ? Math.imul(31, h) : (31 * h)) + s.charCodeAt(i) | 0;
    }
    return Math.abs(h).toString(36);
  }

  // ─── CSS helpers ─────────────────────────────────────────────────────────────

  function hexToRgba(hex, alpha) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return 'rgba(0,0,0,' + alpha + ')';
    return 'rgba(' + parseInt(m[1],16) + ',' + parseInt(m[2],16) + ',' + parseInt(m[3],16) + ',' + alpha + ')';
  }

  // ─── 4. CSS injecteren (volledig geïsoleerd, eenmalig per widget) ─────────────

  function injectStyles(ns, primary, secondary, border) {
    if (document.getElementById('cw-styles-' + ns)) return;

    var css = [
      /* ── Root + CSS variabelen ── */
      '.' + ns + '{' +
        '--primary:' + primary + ';' +
        '--secondary:' + secondary + ';' +
        '--bg:#ffffff;' +
        '--fg:#111827;' +
        '--border:' + border + ';' +
      '}',

      /* ── Chat container ── */
      '.' + ns + ' .cw-container{' +
        'position:fixed;bottom:20px;right:20px;z-index:10000;' +
        'display:none;width:380px;height:600px;' +
        'background:var(--bg);border-radius:16px;' +
        'box-shadow:0 14px 40px rgba(15,23,42,.75);' +
        'border:1px solid var(--border);overflow:hidden;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      '}',
      '.' + ns + ' .cw-container.cw-open{display:flex;flex-direction:column;}',

      /* ── Brand header ── */
      '.' + ns + ' .cw-header{' +
        'padding:12px 16px;display:flex;align-items:center;gap:12px;color:#fff;' +
        'background:linear-gradient(135deg,var(--primary),var(--secondary));flex-shrink:0;' +
      '}',
      '.' + ns + ' .cw-header img{width:32px;height:32px;border-radius:8px;background:#fff;object-fit:contain;flex-shrink:0;}',
      '.' + ns + ' .cw-header-icon{width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
      '.' + ns + ' .cw-title{font-weight:600;font-size:14px;flex:1;min-width:0;}',
      '.' + ns + ' .cw-subtitle{font-size:11px;opacity:.72;margin-top:1px;}',
      '.' + ns + ' .cw-close{margin-left:auto;background:transparent;border:none;color:#fff;cursor:pointer;width:32px;height:32px;border-radius:999px;display:grid;place-items:center;flex-shrink:0;transition:background .15s;}',
      '.' + ns + ' .cw-close:hover{background:rgba(255,255,255,.16);}',

      /* ── Berichten ── */
      '.' + ns + ' .cw-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:6px;background:#f3f4f6;scroll-behavior:smooth;}',
      '.' + ns + ' .cw-messages::-webkit-scrollbar{width:4px;}',
      '.' + ns + ' .cw-messages::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:2px;}',

      /* ── Bubbels ── */
      '@keyframes cw-fadein{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}',
      '.' + ns + ' .cw-msg{padding:10px 12px;border-radius:14px;max-width:80%;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:break-word;animation:cw-fadein .16s ease;}',
      '.' + ns + ' .cw-msg.cw-user{align-self:flex-end;color:#fff;background:linear-gradient(135deg,var(--primary),var(--secondary));border-bottom-right-radius:4px;}',
      '.' + ns + ' .cw-msg.cw-bot{align-self:flex-start;background:#ffffff;border:1px solid var(--border);color:var(--fg);border-bottom-left-radius:4px;}',

      /* ── Typing indicator ── */
      '@keyframes cw-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}',
      '.' + ns + ' .cw-typing{align-self:flex-start;display:flex;gap:4px;align-items:center;padding:12px 14px;background:#fff;border:1px solid var(--border);border-radius:14px;border-bottom-left-radius:4px;}',
      '.' + ns + ' .cw-dot{width:7px;height:7px;border-radius:50%;background:#9ca3af;animation:cw-bounce 1.1s infinite;}',
      '.' + ns + ' .cw-dot:nth-child(2){animation-delay:.18s;}',
      '.' + ns + ' .cw-dot:nth-child(3){animation-delay:.36s;}',

      /* ── Input ── */
      '.' + ns + ' .cw-input-area{padding:12px;border-top:1px solid rgba(148,163,184,.35);display:flex;gap:8px;align-items:flex-end;background:#ffffff;flex-shrink:0;}',
      '.' + ns + ' .cw-textarea{flex:1;resize:none;padding:10px 12px;border-radius:10px;border:1.5px solid rgba(148,163,184,.7);font-size:14px;font-family:inherit;outline:none;min-height:40px;max-height:120px;overflow-y:auto;background:#f9fafb;color:#111827;line-height:1.5;transition:border-color .15s,background .15s;}',
      '.' + ns + ' .cw-textarea:focus{border-color:var(--primary);background:#fff;}',
      '.' + ns + ' .cw-textarea::placeholder{color:#9ca3af;}',
      '.' + ns + ' .cw-textarea:disabled{opacity:.55;cursor:not-allowed;}',

      /* ── Stuurknop ── */
      '.' + ns + ' .cw-send{padding:0 16px;border:none;border-radius:10px;height:40px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff;cursor:pointer;font-size:14px;font-weight:500;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:opacity .15s,transform .1s;box-shadow:0 2px 8px ' + hexToRgba(primary, .3) + ';}',
      '.' + ns + ' .cw-send:hover:not(:disabled){opacity:.88;}',
      '.' + ns + ' .cw-send:active:not(:disabled){transform:scale(.97);}',
      '.' + ns + ' .cw-send:disabled{opacity:.4;cursor:not-allowed;}',

      /* ── Toggle knop ── */
      '.' + ns + ' .cw-toggle{position:fixed;bottom:20px;right:20px;min-width:58px;height:58px;border-radius:999px;border:none;cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--primary),var(--secondary));box-shadow:0 10px 30px rgba(15,23,42,.35),0 0 0 1px rgba(15,23,42,.08);display:flex;align-items:center;justify-content:center;gap:10px;padding:0 20px;z-index:9999;transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;}',
      '.' + ns + ' .cw-toggle:hover{transform:scale(1.07);box-shadow:0 14px 36px rgba(15,23,42,.4);}',
      '.' + ns + ' .cw-toggle:active{transform:scale(.97);}',
      '.' + ns + ' .cw-toggle svg{width:22px;height:22px;fill:currentColor;flex-shrink:0;}',
      '.' + ns + ' .cw-toggle-label{font-size:13px;font-weight:500;white-space:nowrap;font-family:inherit;}',

      /* ── Mobiel ── */
      '@media(max-width:520px){' +
        '.' + ns + ' .cw-container{left:10px;right:10px;bottom:10px;width:auto;height:calc(100dvh - 20px);border-radius:12px;}' +
        '.' + ns + ' .cw-toggle{right:14px;bottom:14px;padding:0 16px;}' +
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.id  = 'cw-styles-' + ns;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // ─── 5. DOM opbouwen en events koppelen ───────────────────────────────────────

  function buildDOM(rootId, ns, cfg, branding, primary, secondary, sessionId) {
    var logoUrl   = branding.logoUrl          || '';
    var brandName = esc(branding.name         || 'Chat');
    var toggleLbl = esc(branding.toggleLabel  || 'Stel ons een vraag');
    var holder    = esc(branding.inputPlaceholder || 'Typ uw bericht...');
    var sendLbl   = esc(branding.sendLabel    || 'Verstuur');
    var welcome   = branding.welcomeText      || '';

    var logoHtml = logoUrl
      ? '<img src="' + esc(logoUrl) + '" alt="' + brandName + '" />'
      : '<div class="cw-header-icon">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="white">' +
            '<path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2.5 21.5l4.5-.838A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>' +
          '</svg>' +
        '</div>';

    var root    = document.createElement('div');
    root.id     = rootId;
    root.className = ns;

    var container = document.createElement('div');
    container.className = 'cw-container';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-label', branding.name || 'Chat');
    container.innerHTML =
      '<div class="cw-header">' +
        logoHtml +
        '<div><div class="cw-title">' + brandName + '</div>' +
        '<div class="cw-subtitle">&#x25CF; Online</div></div>' +
        '<button class="cw-close" aria-label="Sluiten">' +
          '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6.225 4.811L4.811 6.225 10.586 12l-5.775 5.775 1.414 1.414L12 13.414l5.775 5.775 1.414-1.414L13.414 12l5.775-5.775-1.414-1.414L12 10.586z"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="cw-messages" aria-live="polite"></div>' +
      '<div class="cw-input-area">' +
        '<textarea class="cw-textarea" placeholder="' + holder + '" rows="1" aria-label="' + holder + '"></textarea>' +
        '<button type="button" class="cw-send">' + sendLbl + '</button>' +
      '</div>';

    var toggle = document.createElement('button');
    toggle.className = 'cw-toggle';
    toggle.setAttribute('aria-label', 'Chat openen');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2.5 21.5l4.5-.838A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>' +
      '<span class="cw-toggle-label">' + toggleLbl + '</span>';

    root.appendChild(container);
    root.appendChild(toggle);
    document.body.appendChild(root);

    var messages  = container.querySelector('.cw-messages');
    var textarea  = container.querySelector('.cw-textarea');
    var sendBtn   = container.querySelector('.cw-send');
    var closeBtn  = container.querySelector('.cw-close');
    var isLoading = false;
    var welcomeShown = false;

    function openChat() {
      container.classList.add('cw-open');
      toggle.setAttribute('aria-expanded', 'true');
      setTimeout(function () { textarea && textarea.focus(); }, 60);
      if (!welcomeShown && welcome) {
        addMsg(welcome, 'bot');
        welcomeShown = true;
      }
    }

    function closeChat() {
      container.classList.remove('cw-open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
      container.classList.contains('cw-open') ? closeChat() : openChat();
    });
    closeBtn.addEventListener('click', closeChat);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && container.classList.contains('cw-open')) closeChat();
    });

    function addMsg(text, who) {
      var d = document.createElement('div');
      d.className = 'cw-msg cw-' + (who || 'bot');
      d.textContent = String(text != null ? text : '');
      messages.appendChild(d);
      messages.scrollTop = messages.scrollHeight;
      return d;
    }

    function showTyping() {
      var d = document.createElement('div');
      d.className = 'cw-typing';
      d.innerHTML = '<span class="cw-dot"></span><span class="cw-dot"></span><span class="cw-dot"></span>';
      messages.appendChild(d);
      messages.scrollTop = messages.scrollHeight;
      return d;
    }

    function pickOutput(o) {
      if (!o || typeof o !== 'object') return '';
      if (Array.isArray(o)) {
        var first = o[0];
        return (first && (first.output || first.response || first.message || first.text)) || '';
      }
      return o.output || o.response || o.message || o.text || '';
    }

    function doSend(text) {
      addMsg(text, 'user');
      var typing = showTyping();
      isLoading = true;
      sendBtn.disabled = true;
      textarea.disabled = true;

      fetch(cfg.webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:    'sendMessage',
          sessionId: sessionId,
          chatInput: text,
          lang:      cfg.lang || 'nl',
          pageUrl:   window.location.href
        })
      })
        .then(function (res) {
          var ct = (res.headers.get('content-type') || '').toLowerCase();
          return ct.indexOf('application/json') !== -1
            ? res.json()
            : res.text().then(function (t) { return { __raw: t }; });
        })
        .then(function (data) {
          var reply = pickOutput(data);
          if (!reply && data && data.__raw) {
            var raw = String(data.__raw).trim();
            reply = (raw.indexOf('<!DOCTYPE') === 0 || raw.indexOf('<html') === 0)
              ? 'De webhook stuurde HTML terug. Stuur JSON, bijv. {"response":"..."}.'
              : raw;
          }
          if (!reply) reply = 'Geen antwoord ontvangen. Controleer de "Respond to Webhook"-node.';
          typing.remove();
          addMsg(reply, 'bot');
        })
        .catch(function (err) {
          typing.remove();
          addMsg('Er is iets misgegaan. Controleer de webhook-URL of CORS-instellingen.', 'bot');
          console.error('[ChatWidget]', err);
        })
        .then(function () {
          isLoading = false;
          sendBtn.disabled = false;
          textarea.disabled = false;
          messages.scrollTop = messages.scrollHeight;
        });
    }

    sendBtn.addEventListener('click', function () {
      var v = textarea.value.trim();
      if (!v || isLoading) return;
      textarea.value = '';
      textarea.style.height = 'auto';
      textarea.focus();
      doSend(v);
    });

    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        var v = textarea.value.trim();
        if (v && !isLoading) {
          textarea.value = '';
          textarea.style.height = 'auto';
          doSend(v);
        }
      }
    });

    textarea.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    window.ChatWidget = window.ChatWidget || {};
    window.ChatWidget[ns] = { open: openChat, close: closeChat };
  }

  // ─── HTML escaping ────────────────────────────────────────────────────────────

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

}());
