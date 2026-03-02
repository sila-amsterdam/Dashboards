/**
 * Chatbot Widget v1.0
 * Zelf-bevattende chatbot widget — geen externe dependencies
 *
 * Gebruik:
 *   <script>
 *     window.ChatbotConfig = {
 *       webhookUrl:     'https://sila-ai.app.n8n.cloud/webhook/chatbot',
 *       companyId:      'company-001',
 *       name:           'Assistent',
 *       color:          '#6366f1',
 *       logo:           null,           // URL naar logo afbeelding (optioneel)
 *       welcomeMessage: 'Hoe kan ik u helpen?',
 *       language:       'nl',           // 'nl' of 'en'
 *       position:       'bottom-right', // 'bottom-right' of 'bottom-left'
 *       accentDark:     null,           // Donkere variant van color (auto-berekend als null)
 *     };
 *   </script>
 *   <script src="chatbot-widget.js"></script>
 */

(function () {
  'use strict';

  // =============================================
  // CONFIGURATIE
  // =============================================
  var cfg = Object.assign({
    webhookUrl:     '',
    companyId:      'default',
    name:           'Assistent',
    color:          '#6366f1',
    logo:           null,
    welcomeMessage: 'Hoe kan ik u helpen?',
    language:       'nl',
    position:       'bottom-right',
    accentDark:     null
  }, window.ChatbotConfig || {});

  // =============================================
  // VERTALINGEN
  // =============================================
  var translations = {
    nl: {
      placeholder:       'Typ uw bericht...',
      send:              'Verstuur',
      close:             'Sluiten',
      open:              'Chat openen',
      error:             'Er is een fout opgetreden. Probeer het opnieuw.',
      typing:            'Typt...',
      appointmentBadge:  'Afspraak aangevraagd',
      poweredBy:         'Aangedreven door AI'
    },
    en: {
      placeholder:       'Type your message...',
      send:              'Send',
      close:             'Close',
      open:              'Open chat',
      error:             'An error occurred. Please try again.',
      typing:            'Typing...',
      appointmentBadge:  'Appointment requested',
      poweredBy:         'Powered by AI'
    }
  };
  var t = translations[cfg.language] || translations.nl;

  // =============================================
  // SESSION MANAGEMENT
  // =============================================
  function getSessionId() {
    var key = 'cb_session_' + cfg.companyId;
    var id = null;
    try { id = localStorage.getItem(key); } catch (e) {}
    if (!id) {
      id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      try { localStorage.setItem(key, id); } catch (e) {}
    }
    return id;
  }

  // =============================================
  // KLEUR HULPFUNCTIES
  // =============================================
  function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 99, g: 102, b: 241 };
  }

  function darkenColor(hex, amount) {
    var rgb = hexToRgb(hex);
    return 'rgb(' +
      Math.max(0, rgb.r - amount) + ',' +
      Math.max(0, rgb.g - amount) + ',' +
      Math.max(0, rgb.b - amount) + ')';
  }

  function colorWithOpacity(hex, opacity) {
    var rgb = hexToRgb(hex);
    return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + opacity + ')';
  }

  var primary = cfg.color;
  var primaryDark = cfg.accentDark || darkenColor(primary, 30);
  var primaryLight = colorWithOpacity(primary, 0.12);
  var isLeft = cfg.position === 'bottom-left';

  // =============================================
  // CSS INJECTEREN
  // =============================================
  function injectStyles() {
    var posKey = isLeft ? 'left' : 'right';
    var css = [
      '.cb-widget { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
      '.cb-widget *, .cb-widget *::before, .cb-widget *::after { box-sizing: border-box; }',

      /* Bubble knop */
      '.cb-bubble {',
      '  position: fixed; ' + posKey + ': 24px; bottom: 24px;',
      '  width: 60px; height: 60px; border-radius: 50%;',
      '  background: ' + primary + ';',
      '  background: linear-gradient(135deg, ' + primary + ', ' + primaryDark + ');',
      '  color: #fff; border: none; cursor: pointer;',
      '  box-shadow: 0 4px 20px ' + colorWithOpacity(primary, 0.45) + ', 0 2px 8px rgba(0,0,0,0.15);',
      '  display: flex; align-items: center; justify-content: center;',
      '  transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;',
      '  z-index: 2147483646;',
      '}',
      '.cb-bubble:hover {',
      '  transform: scale(1.1);',
      '  box-shadow: 0 8px 32px ' + colorWithOpacity(primary, 0.55) + ', 0 4px 12px rgba(0,0,0,0.18);',
      '}',
      '.cb-bubble:active { transform: scale(0.95); }',
      '.cb-bubble svg { transition: transform 0.3s; }',
      '.cb-bubble.cb-open svg.cb-icon-chat { display: none; }',
      '.cb-bubble:not(.cb-open) svg.cb-icon-close { display: none; }',

      /* Notificatie badge */
      '.cb-badge {',
      '  position: absolute; top: -2px; ' + (isLeft ? 'right' : 'right') + ': -2px;',
      '  width: 18px; height: 18px; border-radius: 50%;',
      '  background: #ef4444; color: #fff;',
      '  font-size: 10px; font-weight: 700; font-family: inherit;',
      '  display: none; align-items: center; justify-content: center;',
      '  border: 2px solid #fff;',
      '}',
      '.cb-badge.cb-visible { display: flex; }',

      /* Chat venster */
      '.cb-window {',
      '  position: fixed; ' + posKey + ': 24px; bottom: 96px;',
      '  width: 380px; max-width: calc(100vw - 32px);',
      '  height: 560px; max-height: calc(100vh - 120px);',
      '  background: #ffffff;',
      '  border-radius: 20px;',
      '  box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);',
      '  display: flex; flex-direction: column; overflow: hidden;',
      '  z-index: 2147483645;',
      '  transform: scale(0.9) translateY(16px);',
      '  opacity: 0; pointer-events: none;',
      '  transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s;',
      '  transform-origin: ' + (isLeft ? 'left' : 'right') + ' bottom;',
      '}',
      '.cb-window.cb-open {',
      '  transform: scale(1) translateY(0);',
      '  opacity: 1; pointer-events: all;',
      '}',

      /* Header */
      '.cb-header {',
      '  background: linear-gradient(135deg, ' + primary + ' 0%, ' + primaryDark + ' 100%);',
      '  color: #fff; padding: 16px 18px;',
      '  display: flex; align-items: center; gap: 12px;',
      '  flex-shrink: 0;',
      '}',
      '.cb-header-avatar {',
      '  width: 40px; height: 40px; border-radius: 50%;',
      '  background: rgba(255,255,255,0.2);',
      '  display: flex; align-items: center; justify-content: center;',
      '  overflow: hidden; flex-shrink: 0;',
      '}',
      '.cb-header-avatar img { width: 100%; height: 100%; object-fit: cover; }',
      '.cb-header-info { flex: 1; min-width: 0; }',
      '.cb-header-name {',
      '  font-size: 15px; font-weight: 600; color: #fff;',
      '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
      '}',
      '.cb-header-status {',
      '  font-size: 12px; color: rgba(255,255,255,0.75);',
      '  display: flex; align-items: center; gap: 5px; margin-top: 2px;',
      '}',
      '.cb-status-dot {',
      '  width: 7px; height: 7px; border-radius: 50%;',
      '  background: #86efac; flex-shrink: 0;',
      '  animation: cb-pulse 2s infinite;',
      '}',
      '@keyframes cb-pulse {',
      '  0%, 100% { opacity: 1; }',
      '  50% { opacity: 0.4; }',
      '}',
      '.cb-header-close {',
      '  background: rgba(255,255,255,0.15); border: none; color: #fff;',
      '  width: 32px; height: 32px; border-radius: 50%; cursor: pointer;',
      '  display: flex; align-items: center; justify-content: center;',
      '  transition: background 0.15s; flex-shrink: 0;',
      '}',
      '.cb-header-close:hover { background: rgba(255,255,255,0.28); }',

      /* Berichten */
      '.cb-messages {',
      '  flex: 1; overflow-y: auto; padding: 16px;',
      '  display: flex; flex-direction: column; gap: 8px;',
      '  scroll-behavior: smooth;',
      '}',
      '.cb-messages::-webkit-scrollbar { width: 4px; }',
      '.cb-messages::-webkit-scrollbar-track { background: transparent; }',
      '.cb-messages::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }',

      /* Berichtbubbels */
      '.cb-msg-wrap { display: flex; align-items: flex-end; gap: 8px; animation: cb-slide-in 0.2s ease; }',
      '.cb-msg-wrap.cb-user { flex-direction: row-reverse; }',
      '@keyframes cb-slide-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }',
      '.cb-msg-avatar {',
      '  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;',
      '  background: ' + primaryLight + ';',
      '  display: flex; align-items: center; justify-content: center;',
      '  overflow: hidden;',
      '}',
      '.cb-msg-avatar img { width: 100%; height: 100%; object-fit: cover; }',
      '.cb-msg-avatar svg { color: ' + primary + '; }',
      '.cb-msg {',
      '  max-width: 78%; padding: 10px 14px;',
      '  border-radius: 16px; font-size: 14px; line-height: 1.55;',
      '  word-wrap: break-word; word-break: break-word;',
      '}',
      '.cb-msg-assistant {',
      '  background: #f1f5f9; color: #1e293b;',
      '  border-bottom-left-radius: 4px;',
      '}',
      '.cb-msg-user {',
      '  background: ' + primary + ';',
      '  background: linear-gradient(135deg, ' + primary + ', ' + primaryDark + ');',
      '  color: #fff; border-bottom-right-radius: 4px;',
      '}',
      '.cb-msg-time {',
      '  font-size: 10px; color: #94a3b8; margin-top: 4px;',
      '  display: block; text-align: right;',
      '}',
      '.cb-msg-assistant .cb-msg-time { text-align: left; color: #94a3b8; }',

      /* Afspraak badge */
      '.cb-appointment-badge {',
      '  display: inline-flex; align-items: center; gap: 5px;',
      '  background: #dcfce7; color: #15803d;',
      '  font-size: 11px; font-weight: 500; padding: 3px 8px;',
      '  border-radius: 99px; margin-top: 6px;',
      '}',
      '.cb-appointment-badge svg { flex-shrink: 0; }',

      /* Typing indicator */
      '.cb-typing {',
      '  display: flex; gap: 4px; align-items: center;',
      '  padding: 10px 14px; background: #f1f5f9;',
      '  border-radius: 16px; border-bottom-left-radius: 4px;',
      '  width: fit-content;',
      '}',
      '.cb-typing span {',
      '  width: 7px; height: 7px; border-radius: 50%;',
      '  background: #94a3b8; display: block;',
      '  animation: cb-bounce 1.2s infinite;',
      '}',
      '.cb-typing span:nth-child(2) { animation-delay: 0.2s; }',
      '.cb-typing span:nth-child(3) { animation-delay: 0.4s; }',
      '@keyframes cb-bounce {',
      '  0%, 60%, 100% { transform: translateY(0); }',
      '  30% { transform: translateY(-6px); }',
      '}',

      /* Input area */
      '.cb-input-area {',
      '  padding: 12px 16px 16px;',
      '  border-top: 1px solid #f1f5f9;',
      '  display: flex; gap: 8px; align-items: flex-end;',
      '  flex-shrink: 0; background: #fff;',
      '}',
      '.cb-input {',
      '  flex: 1; border: 1.5px solid #e2e8f0;',
      '  border-radius: 12px; padding: 10px 14px;',
      '  font-size: 14px; font-family: inherit; color: #1e293b;',
      '  outline: none; resize: none;',
      '  min-height: 44px; max-height: 120px;',
      '  line-height: 1.5; transition: border-color 0.15s;',
      '  overflow-y: auto; background: #f8fafc;',
      '}',
      '.cb-input:focus { border-color: ' + primary + '; background: #fff; }',
      '.cb-input::placeholder { color: #94a3b8; }',
      '.cb-input:disabled { opacity: 0.6; cursor: not-allowed; }',
      '.cb-send {',
      '  width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;',
      '  background: ' + primary + ';',
      '  background: linear-gradient(135deg, ' + primary + ', ' + primaryDark + ');',
      '  color: #fff; border: none; cursor: pointer;',
      '  display: flex; align-items: center; justify-content: center;',
      '  transition: opacity 0.15s, transform 0.15s;',
      '  box-shadow: 0 2px 8px ' + colorWithOpacity(primary, 0.35) + ';',
      '}',
      '.cb-send:hover:not(:disabled) { opacity: 0.88; transform: scale(1.05); }',
      '.cb-send:active:not(:disabled) { transform: scale(0.95); }',
      '.cb-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }',

      /* Footer */
      '.cb-footer {',
      '  text-align: center; padding: 6px 0 10px;',
      '  font-size: 10px; color: #cbd5e1;',
      '  flex-shrink: 0;',
      '}',

      /* Mobiel */
      '@media (max-width: 440px) {',
      '  .cb-window {',
      '    left: 0 !important; right: 0 !important; bottom: 0 !important;',
      '    width: 100vw; max-width: 100vw;',
      '    height: 100dvh; max-height: 100dvh;',
      '    border-radius: 0;',
      '    transform-origin: bottom center;',
      '  }',
      '  .cb-bubble { ' + posKey + ': 16px; bottom: 16px; }',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'cb-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // =============================================
  // SVG ICONEN
  // =============================================
  var icons = {
    chat: '<svg class="cb-icon-chat" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
    close: '<svg class="cb-icon-close" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
    bot: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.38-1 1.72V7h1a7 7 0 017 7H4a7 7 0 017-7h1V5.72A2 2 0 0112 2zM7 14v2a1 1 0 002 0v-2H7zm6 0v2a1 1 0 002 0v-2h-2zM5 21a1 1 0 01-1-1v-1h16v1a1 1 0 01-1 1H5z"/></svg>',
    calendar: '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>'
  };

  // =============================================
  // DOM BOUWEN
  // =============================================
  var bubble, chatWindow, messagesList, inputField, sendBtn, typingEl;
  var sessionId = getSessionId();
  var isLoading = false;

  function buildWidget() {
    // Bubble
    bubble = document.createElement('button');
    bubble.className = 'cb-widget cb-bubble';
    bubble.setAttribute('aria-label', t.open);
    bubble.setAttribute('aria-expanded', 'false');
    bubble.innerHTML = icons.chat + icons.close +
      '<span class="cb-badge" id="cb-badge" aria-live="polite"></span>';

    // Venster
    chatWindow = document.createElement('div');
    chatWindow.className = 'cb-widget cb-window';
    chatWindow.setAttribute('role', 'dialog');
    chatWindow.setAttribute('aria-label', cfg.name);
    chatWindow.setAttribute('aria-modal', 'true');

    var avatarHtml = cfg.logo
      ? '<img src="' + cfg.logo + '" alt="' + cfg.name + '" />'
      : icons.bot;

    chatWindow.innerHTML = [
      '<div class="cb-header">',
      '  <div class="cb-header-avatar">' + avatarHtml + '</div>',
      '  <div class="cb-header-info">',
      '    <div class="cb-header-name">' + escapeHtml(cfg.name) + '</div>',
      '    <div class="cb-header-status"><span class="cb-status-dot"></span>Online</div>',
      '  </div>',
      '  <button class="cb-header-close" aria-label="' + t.close + '">' +
      '    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>' +
      '  </button>',
      '</div>',
      '<div class="cb-messages" id="cb-messages-list" aria-live="polite" aria-label="Berichten"></div>',
      '<div class="cb-input-area">',
      '  <textarea',
      '    class="cb-input" id="cb-input-field"',
      '    placeholder="' + t.placeholder + '"',
      '    rows="1"',
      '    aria-label="' + t.placeholder + '"',
      '  ></textarea>',
      '  <button class="cb-send" id="cb-send-btn" aria-label="' + t.send + '">' + icons.send + '</button>',
      '</div>',
      '<div class="cb-footer">' + t.poweredBy + '</div>'
    ].join('');

    document.body.appendChild(bubble);
    document.body.appendChild(chatWindow);

    // Referenties
    messagesList = document.getElementById('cb-messages-list');
    inputField = document.getElementById('cb-input-field');
    sendBtn = document.getElementById('cb-send-btn');

    // Events
    bubble.addEventListener('click', toggleChat);
    chatWindow.querySelector('.cb-header-close').addEventListener('click', closeChat);
    sendBtn.addEventListener('click', sendMessage);
    inputField.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    inputField.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // Sluit bij klik buiten venster
    document.addEventListener('click', function (e) {
      if (chatWindow.classList.contains('cb-open') &&
          !chatWindow.contains(e.target) &&
          !bubble.contains(e.target)) {
        closeChat();
      }
    });

    // Welkomstbericht
    appendMessage('assistant', cfg.welcomeMessage);
  }

  // =============================================
  // CHAT OPENEN / SLUITEN
  // =============================================
  function toggleChat() {
    chatWindow.classList.contains('cb-open') ? closeChat() : openChat();
  }

  function openChat() {
    chatWindow.classList.add('cb-open');
    bubble.classList.add('cb-open');
    bubble.setAttribute('aria-expanded', 'true');
    hideBadge();
    setTimeout(function () { inputField.focus(); }, 300);
  }

  function closeChat() {
    chatWindow.classList.remove('cb-open');
    bubble.classList.remove('cb-open');
    bubble.setAttribute('aria-expanded', 'false');
  }

  function showBadge() {
    var badge = document.getElementById('cb-badge');
    if (badge && !chatWindow.classList.contains('cb-open')) {
      badge.textContent = '1';
      badge.classList.add('cb-visible');
    }
  }

  function hideBadge() {
    var badge = document.getElementById('cb-badge');
    if (badge) {
      badge.textContent = '';
      badge.classList.remove('cb-visible');
    }
  }

  // =============================================
  // BERICHTEN WEERGEVEN
  // =============================================
  function formatTime() {
    var now = new Date();
    return ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
  }

  function appendMessage(role, content, options) {
    options = options || {};

    var wrap = document.createElement('div');
    wrap.className = 'cb-msg-wrap' + (role === 'user' ? ' cb-user' : '');

    var avatarHtml = '';
    if (role === 'assistant') {
      avatarHtml = '<div class="cb-msg-avatar">' +
        (cfg.logo ? '<img src="' + cfg.logo + '" alt="" />' : icons.bot) +
        '</div>';
    }

    var badgeHtml = '';
    if (options.appointmentBooked) {
      badgeHtml = '<div class="cb-appointment-badge">' +
        icons.calendar + ' ' + t.appointmentBadge +
        '</div>';
    }

    var msgHtml = '<div class="cb-msg cb-msg-' + role + '">' +
      '<span>' + escapeHtml(content) + '</span>' +
      badgeHtml +
      '<span class="cb-msg-time">' + formatTime() + '</span>' +
      '</div>';

    wrap.innerHTML = avatarHtml + msgHtml;
    messagesList.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function showTyping() {
    var wrap = document.createElement('div');
    wrap.className = 'cb-msg-wrap';
    wrap.id = 'cb-typing-indicator';

    var avatarHtml = '<div class="cb-msg-avatar">' +
      (cfg.logo ? '<img src="' + cfg.logo + '" alt="" />' : icons.bot) +
      '</div>';

    wrap.innerHTML = avatarHtml +
      '<div class="cb-typing"><span></span><span></span><span></span></div>';

    messagesList.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function removeTyping() {
    var el = document.getElementById('cb-typing-indicator');
    if (el) el.remove();
  }

  function scrollToBottom() {
    if (messagesList) {
      messagesList.scrollTop = messagesList.scrollHeight;
    }
  }

  function setLoading(state) {
    isLoading = state;
    if (sendBtn) sendBtn.disabled = state;
    if (inputField) inputField.disabled = state;
  }

  // =============================================
  // BERICHT VERSTUREN
  // =============================================
  function sendMessage() {
    if (isLoading) return;
    var message = (inputField.value || '').trim();
    if (!message) return;

    inputField.value = '';
    inputField.style.height = 'auto';
    appendMessage('user', message);
    setLoading(true);
    showTyping();

    fetch(cfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        message: message,
        companyId: cfg.companyId
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      removeTyping();
      var answer = data.answer || t.error;
      appendMessage('assistant', answer, {
        appointmentBooked: data.appointmentBooked === true
      });

      // Badge tonen als venster gesloten is
      if (!chatWindow.classList.contains('cb-open')) {
        showBadge();
      }
    })
    .catch(function () {
      removeTyping();
      appendMessage('assistant', t.error);
    })
    .finally(function () {
      setLoading(false);
      scrollToBottom();
    });
  }

  // =============================================
  // HULPFUNCTIES
  // =============================================
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // =============================================
  // INITIALISATIE
  // =============================================
  function init() {
    if (!cfg.webhookUrl) {
      console.warn('[Chatbot Widget] webhookUrl ontbreekt in ChatbotConfig.');
      return;
    }

    // Voorkom dubbele initialisatie
    if (document.getElementById('cb-styles')) return;

    injectStyles();
    buildWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
