/**
 * Chat Widget Dashboard – Logica
 *
 * Architectuur:
 *   state       – centrale staat (widgets, huidige view, editing ID)
 *   API         – fetch wrappers voor de Express server
 *   render*     – pure functies die HTML strings of DOM-elementen teruggeven
 *   show*       – wisselen tussen views
 *   init()      – bootstrapt alles
 */

(function () {
  'use strict';

  // ─── Staat ───────────────────────────────────────────────────────────────────

  var API_BASE = window.location.origin;   // Zelfde origin als dashboard (geserveerd via Express)

  var state = {
    widgets:   [],
    editingId: null     // null = nieuw aanmaken
  };

  // ─── API laag ────────────────────────────────────────────────────────────────

  var API = {
    list: function () {
      return fetch(API_BASE + '/api/widgets').then(r => r.json());
    },
    get: function (id) {
      return fetch(API_BASE + '/api/widgets/' + id).then(r => r.json());
    },
    create: function (data) {
      return fetch(API_BASE + '/api/widgets', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data)
      }).then(r => r.json());
    },
    update: function (id, data) {
      return fetch(API_BASE + '/api/widgets/' + id, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data)
      }).then(r => r.json());
    },
    del: function (id) {
      return fetch(API_BASE + '/api/widgets/' + id, { method: 'DELETE' }).then(r => r.json());
    }
  };

  // ─── Toast ───────────────────────────────────────────────────────────────────

  var toastTimer = null;

  function toast(msg, type) {
    var el = document.getElementById('db-toast');
    if (!el) return;
    el.className = 'db-toast ' + (type || 'success');
    el.querySelector('.db-toast-msg').textContent = msg;
    el.querySelector('.db-toast-icon').innerHTML = type === 'error'
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

    clearTimeout(toastTimer);
    el.classList.add('show');
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3000);
  }

  // ─── HTML escaping ────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.substring(0, n) + '…' : s;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ─── Kleur hulpfuncties ───────────────────────────────────────────────────────

  function hexToRgba(hex, a) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return 'rgba(0,0,0,' + a + ')';
    return 'rgba(' + parseInt(m[1],16) + ',' + parseInt(m[2],16) + ',' + parseInt(m[3],16) + ',' + a + ')';
  }

  // ─── Embed code genereren ────────────────────────────────────────────────────

  function embedCode(widget) {
    var src = API_BASE + '/widget.js';
    var cfg = {
      webhookUrl: widget.webhookUrl,
      branding:   widget.branding || {},
      theme:      widget.theme    || {}
    };
    return '<script\n  src="' + src + '"\n  data-config=\'' + JSON.stringify(cfg) + '\'>\n<\/script>';
  }

  // ─── Widget kaart renderen ────────────────────────────────────────────────────

  function renderCard(w) {
    var primary   = (w.theme && w.theme.primaryColor)   || '#6366f1';
    var secondary = (w.theme && w.theme.secondaryColor) || '#4f46e5';
    var branding  = w.branding || {};
    var logoUrl   = branding.logoUrl || '';

    var avatarHtml = logoUrl
      ? '<img src="' + esc(logoUrl) + '" alt="" onerror="this.style.display=\'none\'" />'
      : '<div class="db-card-avatar-placeholder">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="' + esc(primary) + '">' +
            '<path d="M12 2C6.477 2 2 6.477 2 12c0 1.82.49 3.53 1.34 5L2.5 21.5l4.5-.84A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>' +
          '</svg>' +
        '</div>';

    var card = document.createElement('div');
    card.className = 'db-card';
    card.innerHTML =
      '<div class="db-card-stripe" style="background:linear-gradient(90deg,' + esc(primary) + ',' + esc(secondary) + ')"></div>' +
      '<div class="db-card-body">' +
        '<div class="db-card-top">' +
          '<div class="db-card-avatar">' + avatarHtml + '</div>' +
          '<div class="db-card-info">' +
            '<div class="db-card-name">' + esc(w.name) + '</div>' +
            '<div class="db-card-brand">' + esc(branding.name || '') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="db-card-webhook" title="' + esc(w.webhookUrl) + '">' + esc(truncate(w.webhookUrl, 48)) + '</div>' +
        '<div class="db-card-meta">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>' +
          esc(fmtDate(w.createdAt)) +
        '</div>' +
      '</div>' +
      '<div class="db-card-actions">' +
        '<button class="db-btn db-btn-secondary btn-edit" data-id="' + esc(w.id) + '">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>' +
          'Bewerken' +
        '</button>' +
        '<button class="db-btn db-btn-ghost db-btn-icon btn-copy-embed" data-id="' + esc(w.id) + '" title="Kopieer embed code">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>' +
        '</button>' +
      '</div>';

    return card;
  }

  // ─── Kaarten lijst renderen ───────────────────────────────────────────────────

  function renderList() {
    var grid = document.getElementById('db-widget-grid');
    var badge = document.getElementById('db-nav-badge');
    if (!grid) return;

    if (badge) badge.textContent = state.widgets.length;

    var sidebarBadge = document.getElementById('db-nav-badge-sidebar');
    if (sidebarBadge) sidebarBadge.textContent = state.widgets.length;

    if (state.widgets.length === 0) {
      grid.innerHTML =
        '<div class="db-empty">' +
          '<div class="db-empty-icon">' +
            '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">' +
              '<path d="M12 2C6.477 2 2 6.477 2 12c0 1.82.49 3.53 1.34 5L2.5 21.5l4.5-.84A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>' +
            '</svg>' +
          '</div>' +
          '<h3>Nog geen widgets</h3>' +
          '<p>Maak jouw eerste chatwidget aan en embed het op elke website.</p>' +
          '<button class="db-btn db-btn-primary" id="db-empty-create-btn">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>' +
            'Eerste widget aanmaken' +
          '</button>' +
        '</div>';

      document.getElementById('db-empty-create-btn').addEventListener('click', function () {
        showForm(null);
      });
      return;
    }

    grid.innerHTML = '';
    state.widgets.forEach(function (w) {
      var card = renderCard(w);
      grid.appendChild(card);
    });

    // Events op kaarten
    grid.querySelectorAll('.btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function () { showForm(btn.dataset.id); });
    });

    grid.querySelectorAll('.btn-copy-embed').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var w = state.widgets.find(function (x) { return x.id === btn.dataset.id; });
        if (!w) return;
        copyText(embedCode(w));
        toast('Embed code gekopieerd!');
      });
    });
  }

  // ─── Live preview bijwerken ───────────────────────────────────────────────────

  var previewDebounce = null;

  function updatePreview() {
    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(doUpdatePreview, 180);
  }

  function doUpdatePreview() {
    var form      = document.getElementById('db-widget-form');
    if (!form) return;

    var primary   = form.querySelector('[name="theme.primaryColor"]').value || '#6366f1';
    var secondary = form.querySelector('[name="theme.secondaryColor"]').value || '#4f46e5';
    var logoUrl   = form.querySelector('[name="branding.logoUrl"]').value || '';
    var name      = form.querySelector('[name="branding.name"]').value || 'Chat';
    var toggleLbl = form.querySelector('[name="branding.toggleLabel"]').value || 'Stel ons een vraag';
    var welcome   = form.querySelector('[name="branding.welcomeText"]').value || 'Hallo! Hoe kan ik u helpen?';

    // Header
    var header = document.querySelector('.db-preview-header');
    if (header) header.style.background = 'linear-gradient(135deg,' + primary + ',' + secondary + ')';

    var previewLogo = document.querySelector('.db-preview-logo');
    if (previewLogo) {
      if (logoUrl) {
        previewLogo.innerHTML = '<img src="' + esc(logoUrl) + '" alt="" onerror="this.style.display=\'none\'" style="width:100%;height:100%;object-fit:contain" />';
      } else {
        previewLogo.innerHTML =
          '<svg viewBox="0 0 24 24" width="12" height="12" fill="white">' +
            '<path d="M12 2C6.477 2 2 6.477 2 12c0 1.82.49 3.53 1.34 5L2.5 21.5l4.5-.84A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>' +
          '</svg>';
      }
    }

    var titleEl = document.querySelector('.db-preview-title');
    if (titleEl) titleEl.textContent = name;

    // Welkomstbericht in preview
    var botMsgs = document.querySelectorAll('.db-preview-msg-bot');
    if (botMsgs.length > 0) botMsgs[0].textContent = truncate(welcome, 60);

    // Berichten kleur (user)
    var userMsgs = document.querySelectorAll('.db-preview-msg-user');
    userMsgs.forEach(function (m) {
      m.style.background = 'linear-gradient(135deg,' + primary + ',' + secondary + ')';
    });

    // Send knop
    var sendBtn = document.querySelector('.db-preview-send');
    if (sendBtn) sendBtn.style.background = 'linear-gradient(135deg,' + primary + ',' + secondary + ')';

    // Toggle knop
    var toggle = document.querySelector('.db-preview-toggle');
    if (toggle) {
      toggle.style.background = 'linear-gradient(135deg,' + primary + ',' + secondary + ')';
      var lbl = toggle.querySelector('.db-preview-toggle-label');
      if (lbl) lbl.textContent = truncate(toggleLbl, 24);
    }
  }

  // ─── Embed code in form bijwerken ─────────────────────────────────────────────

  function updateEmbedCode(widgetId) {
    var block = document.getElementById('db-embed-section');
    var pre   = document.getElementById('db-embed-code-pre');
    if (!block || !pre) return;

    if (!widgetId) { block.classList.add('db-hidden'); return; }
    block.classList.remove('db-hidden');
    var widget = state.widgets.find(function (x) { return x.id === widgetId; });
    if (widget) {
      pre.textContent = embedCode(widget);
    } else {
      API.get(widgetId).then(function (w) { pre.textContent = embedCode(w); });
    }
  }

  // ─── Views tonen ─────────────────────────────────────────────────────────────

  function showList() {
    document.getElementById('db-view-list').classList.remove('db-hidden');
    document.getElementById('db-view-form').classList.add('db-hidden');
    document.getElementById('db-topbar-title').textContent = 'Widgets';
    document.getElementById('db-topbar-sub').textContent = '';
    document.querySelector('.db-nav-item[data-view="list"]').classList.add('active');

    loadWidgets();
  }

  function showForm(widgetId) {
    state.editingId = widgetId || null;

    document.getElementById('db-view-list').classList.add('db-hidden');
    document.getElementById('db-view-form').classList.remove('db-hidden');
    document.querySelector('.db-nav-item[data-view="list"]').classList.remove('active');

    var isNew = !widgetId;

    document.getElementById('db-topbar-title').textContent = isNew ? 'Nieuwe widget' : 'Widget bewerken';
    document.getElementById('db-topbar-sub').textContent = '';
    document.getElementById('db-form-heading').textContent = isNew ? 'Nieuwe widget aanmaken' : 'Widget bewerken';

    var deleteBtn = document.getElementById('db-btn-delete');
    if (isNew) {
      deleteBtn.classList.add('db-hidden');
    } else {
      deleteBtn.classList.remove('db-hidden');
    }

    if (isNew) {
      resetForm();
      updateEmbedCode(null);
      doUpdatePreview();
    } else {
      var w = state.widgets.find(function (x) { return x.id === widgetId; });
      if (w) {
        fillForm(w);
        updateEmbedCode(widgetId);
        doUpdatePreview();
      } else {
        API.get(widgetId).then(function (w) {
          fillForm(w);
          updateEmbedCode(widgetId);
          doUpdatePreview();
        });
      }
    }
  }

  // ─── Formulier invullen / resetten ────────────────────────────────────────────

  function resetForm() {
    var form = document.getElementById('db-widget-form');
    if (!form) return;
    form.reset();
    setField(form, 'theme.primaryColor',   '#6366f1');
    setField(form, 'theme.secondaryColor', '#4f46e5');
    setField(form, 'theme.primaryHex',     '#6366f1');
    setField(form, 'theme.secondaryHex',   '#4f46e5');
    syncPresets(form, 'theme.primaryColor', '#6366f1');
  }

  function fillForm(w) {
    var form = document.getElementById('db-widget-form');
    if (!form) return;

    var branding = w.branding || {};
    var theme    = w.theme    || {};

    setField(form, 'name',                     w.name           || '');
    setField(form, 'webhookUrl',               w.webhookUrl     || '');
    setField(form, 'branding.name',            branding.name    || '');
    setField(form, 'branding.logoUrl',         branding.logoUrl || '');
    setField(form, 'branding.welcomeText',     branding.welcomeText     || '');
    setField(form, 'branding.toggleLabel',     branding.toggleLabel     || '');
    setField(form, 'branding.inputPlaceholder',branding.inputPlaceholder|| '');
    setField(form, 'branding.sendLabel',       branding.sendLabel       || '');

    var primary   = theme.primaryColor   || '#6366f1';
    var secondary = theme.secondaryColor || '#4f46e5';

    setField(form, 'theme.primaryColor',   primary);
    setField(form, 'theme.secondaryColor', secondary);
    setField(form, 'theme.primaryHex',     primary);
    setField(form, 'theme.secondaryHex',   secondary);
    syncPresets(form, 'theme.primaryColor', primary);
  }

  function setField(form, name, value) {
    var el = form.querySelector('[name="' + name + '"]');
    if (el) el.value = value;
  }

  function readFormData() {
    var form = document.getElementById('db-widget-form');
    return {
      name:       getField(form, 'name'),
      webhookUrl: getField(form, 'webhookUrl'),
      branding: {
        name:             getField(form, 'branding.name'),
        logoUrl:          getField(form, 'branding.logoUrl'),
        welcomeText:      getField(form, 'branding.welcomeText'),
        toggleLabel:      getField(form, 'branding.toggleLabel'),
        inputPlaceholder: getField(form, 'branding.inputPlaceholder'),
        sendLabel:        getField(form, 'branding.sendLabel')
      },
      theme: {
        primaryColor:   getField(form, 'theme.primaryColor'),
        secondaryColor: getField(form, 'theme.secondaryColor')
      }
    };
  }

  function getField(form, name) {
    var el = form.querySelector('[name="' + name + '"]');
    return el ? el.value.trim() : '';
  }

  // ─── Kleurinput synchronisatie ────────────────────────────────────────────────

  function initColorInputs(form) {
    // Primary
    var primaryPicker = form.querySelector('[name="theme.primaryColor"]');
    var primaryHex    = form.querySelector('[name="theme.primaryHex"]');

    primaryPicker.addEventListener('input', function () {
      primaryHex.value = primaryPicker.value;
      syncPresets(form, 'theme.primaryColor', primaryPicker.value);
      updatePreview();
    });

    primaryHex.addEventListener('input', function () {
      if (/^#[0-9a-f]{6}$/i.test(primaryHex.value)) {
        primaryPicker.value = primaryHex.value;
        syncPresets(form, 'theme.primaryColor', primaryHex.value);
        updatePreview();
      }
    });

    // Secondary
    var secPicker = form.querySelector('[name="theme.secondaryColor"]');
    var secHex    = form.querySelector('[name="theme.secondaryHex"]');

    secPicker.addEventListener('input', function () {
      secHex.value = secPicker.value;
      updatePreview();
    });

    secHex.addEventListener('input', function () {
      if (/^#[0-9a-f]{6}$/i.test(secHex.value)) {
        secPicker.value = secHex.value;
        updatePreview();
      }
    });

    // Color presets
    form.querySelectorAll('.db-color-preset').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var primary   = btn.dataset.primary;
        var secondary = btn.dataset.secondary;
        primaryPicker.value = primary;
        primaryHex.value    = primary;
        secPicker.value     = secondary;
        secHex.value        = secondary;
        syncPresets(form, 'theme.primaryColor', primary);
        updatePreview();
      });
    });
  }

  function syncPresets(form, fieldName, value) {
    form.querySelectorAll('.db-color-preset').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.primary === value);
    });
  }

  // ─── Laden ───────────────────────────────────────────────────────────────────

  function loadWidgets() {
    var grid = document.getElementById('db-widget-grid');
    if (!grid) return;

    // Skeleton
    grid.innerHTML = [1,2,3].map(function () {
      return '<div class="db-card">' +
        '<div style="height:6px;background:#e2e8f0"></div>' +
        '<div class="db-card-body" style="gap:10px">' +
          '<div class="db-skeleton" style="height:16px;width:60%"></div>' +
          '<div class="db-skeleton" style="height:12px;width:80%"></div>' +
          '<div class="db-skeleton" style="height:32px;width:100%"></div>' +
        '</div>' +
      '</div>';
    }).join('');

    API.list()
      .then(function (widgets) {
        state.widgets = Array.isArray(widgets) ? widgets : [];
        renderList();
      })
      .catch(function () {
        grid.innerHTML = '<div class="db-empty"><h3>Kon widgets niet laden</h3><p>Controleer of de API server draait op ' + API_BASE + '</p></div>';
      });
  }

  // ─── Opslaan ─────────────────────────────────────────────────────────────────

  function saveWidget(e) {
    e.preventDefault();

    var data    = readFormData();
    var saveBtn = document.getElementById('db-btn-save');

    if (!data.name) { toast('Vul een naam in.', 'error'); return; }
    if (!data.webhookUrl) { toast('Vul een webhook URL in.', 'error'); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Opslaan...';

    var promise = state.editingId
      ? API.update(state.editingId, data)
      : API.create(data);

    promise
      .then(function (w) {
        if (w.error) throw new Error(w.error);

        if (state.editingId) {
          var idx = state.widgets.findIndex(function (x) { return x.id === state.editingId; });
          if (idx >= 0) state.widgets[idx] = w;
        } else {
          state.widgets.unshift(w);
          state.editingId = w.id;
          updateEmbedCode(w.id);
        }

        toast(state.editingId ? 'Widget opgeslagen!' : 'Widget aangemaakt!');
      })
      .catch(function (err) {
        toast(err.message || 'Opslaan mislukt.', 'error');
      })
      .then(function () {
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Opslaan';
      });
  }

  // ─── Verwijderen ─────────────────────────────────────────────────────────────

  function deleteWidget() {
    if (!state.editingId) return;
    var w = state.widgets.find(function (x) { return x.id === state.editingId; });
    var name = w ? w.name : 'dit widget';

    if (!confirm('Weet je zeker dat je "' + name + '" wilt verwijderen? Dit kan niet ongedaan worden.')) return;

    API.del(state.editingId)
      .then(function () {
        state.widgets = state.widgets.filter(function (x) { return x.id !== state.editingId; });
        toast('Widget verwijderd.');
        showList();
      })
      .catch(function () {
        toast('Verwijderen mislukt.', 'error');
      });
  }

  // ─── Kopiëren naar klembord ───────────────────────────────────────────────────

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  // ─── HTML voor de views opbouwen ──────────────────────────────────────────────

  function buildListView() {
    var div = document.createElement('div');
    div.id = 'db-view-list';
    div.innerHTML =
      '<div class="db-cards-header">' +
        '<h2>Alle widgets <span id="db-nav-badge" class="db-badge db-badge-neutral">0</span></h2>' +
        '<button class="db-btn db-btn-primary" id="db-btn-new">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>' +
          'Nieuwe widget' +
        '</button>' +
      '</div>' +
      '<div class="db-grid" id="db-widget-grid"></div>';
    return div;
  }

  function buildFormView() {
    var div = document.createElement('div');
    div.id = 'db-view-form';
    div.classList.add('db-hidden');

    div.innerHTML =
      '<div class="db-cards-header" style="margin-bottom:20px">' +
        '<button class="db-btn db-btn-ghost" id="db-btn-back">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>' +
          'Terug' +
        '</button>' +
        '<h2 id="db-form-heading" style="flex:1">Nieuwe widget</h2>' +
      '</div>' +

      '<form id="db-widget-form">' +
        '<div class="db-form-layout">' +

          // ── Linker kolom: formulier ──
          '<div class="db-form-col">' +

            // Sectie: Algemeen
            '<div class="db-section">' +
              '<div class="db-section-header">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>' +
                '<h3>Algemeen</h3>' +
              '</div>' +
              '<div class="db-section-body">' +
                '<div class="db-field">' +
                  '<label>Widget naam</label>' +
                  '<input class="db-input" name="name" placeholder="bijv. Klantenservice Widget" required />' +
                '</div>' +
                '<div class="db-field">' +
                  '<label>Webhook URL</label>' +
                  '<input class="db-input db-input-url" name="webhookUrl" type="url" placeholder="https://jouw-n8n.app.n8n.cloud/webhook/..." required />' +
                  '<small>De n8n webhook-URL die berichten ontvangt</small>' +
                '</div>' +
              '</div>' +
            '</div>' +

            // Sectie: Branding
            '<div class="db-section">' +
              '<div class="db-section-header">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>' +
                '<h3>Branding</h3>' +
              '</div>' +
              '<div class="db-section-body">' +
                '<div class="db-field">' +
                  '<label>Weergavenaam</label>' +
                  '<input class="db-input" name="branding.name" placeholder="bijv. Sila Assistent" />' +
                '</div>' +
                '<div class="db-field">' +
                  '<label>Logo URL</label>' +
                  '<input class="db-input db-input-url" name="branding.logoUrl" type="url" placeholder="https://jouwsite.nl/logo.png" />' +
                  '<small>Optioneel — getoond in de header en toggle-knop</small>' +
                '</div>' +
                '<div class="db-field">' +
                  '<label>Toggle knop tekst</label>' +
                  '<input class="db-input" name="branding.toggleLabel" placeholder="Stel ons een vraag" />' +
                '</div>' +
                '<div class="db-field">' +
                  '<label>Welkomstbericht</label>' +
                  '<textarea class="db-textarea" name="branding.welcomeText" placeholder="Hallo! Hoe kan ik u helpen?"></textarea>' +
                '</div>' +
                '<div class="db-field">' +
                  '<label>Input placeholder</label>' +
                  '<input class="db-input" name="branding.inputPlaceholder" placeholder="Typ uw bericht..." />' +
                '</div>' +
                '<div class="db-field">' +
                  '<label>Verstuurknop tekst</label>' +
                  '<input class="db-input" name="branding.sendLabel" placeholder="Verstuur" />' +
                '</div>' +
              '</div>' +
            '</div>' +

            // Sectie: Thema
            '<div class="db-section">' +
              '<div class="db-section-header">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>' +
                '<h3>Kleurenthema</h3>' +
              '</div>' +
              '<div class="db-section-body">' +
                '<div class="db-color-presets">' +
                  makePreset('#6366f1','#4f46e5','Indigo') +
                  makePreset('#f21c00','#ff7a42','Rood') +
                  makePreset('#0ea5e9','#0284c7','Blauw') +
                  makePreset('#10b981','#059669','Groen') +
                  makePreset('#f59e0b','#d97706','Amber') +
                  makePreset('#ec4899','#db2777','Roze') +
                  makePreset('#8b5cf6','#7c3aed','Paars') +
                  makePreset('#0f172a','#1e293b','Donker') +
                '</div>' +
                '<div class="db-field">' +
                  '<label>Primaire kleur</label>' +
                  '<div class="db-color-row">' +
                    '<input type="color" class="db-color-input" name="theme.primaryColor" value="#6366f1" />' +
                    '<input type="text" class="db-input db-color-hex" name="theme.primaryHex" value="#6366f1" placeholder="#6366f1" maxlength="7" />' +
                  '</div>' +
                '</div>' +
                '<div class="db-field">' +
                  '<label>Secundaire kleur <span style="font-size:11px;font-weight:400;color:#94a3b8">(voor gradient)</span></label>' +
                  '<div class="db-color-row">' +
                    '<input type="color" class="db-color-input" name="theme.secondaryColor" value="#4f46e5" />' +
                    '<input type="text" class="db-input db-color-hex" name="theme.secondaryHex" value="#4f46e5" placeholder="#4f46e5" maxlength="7" />' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +

            // Sectie: Embed code (alleen bij bestaand widget)
            '<div class="db-section db-hidden" id="db-embed-section">' +
              '<div class="db-section-header">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>' +
                '<h3>Embed code</h3>' +
              '</div>' +
              '<div class="db-section-body">' +
                '<p style="font-size:13px;color:#64748b">Kopieer dit en plak het voor de <code style="background:#f1f5f9;padding:1px 4px;border-radius:4px;font-size:12px">&lt;/body&gt;</code> tag. De URL bevat <code style="background:#f1f5f9;padding:1px 4px;border-radius:4px;font-size:12px">localhost:3000</code> — vervang dit door jouw publieke serveradres bij live gebruik.</p>' +
                '<div class="db-embed-block">' +
                  '<pre class="db-embed-code" id="db-embed-code-pre"></pre>' +
                  '<button type="button" class="db-embed-copy" id="db-embed-copy-btn">Kopieer</button>' +
                '</div>' +
              '</div>' +
            '</div>' +

          '</div>' +

          // ── Rechter kolom: preview ──
          '<div class="db-form-col">' +
            '<div class="db-section" style="position:sticky;top:80px">' +
              '<div class="db-section-header">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>' +
                '<h3>Live preview</h3>' +
              '</div>' +
              '<div class="db-section-body" style="padding:16px">' +
                '<div class="db-preview-wrap">' +
                  '<div class="db-preview-label">Preview</div>' +

                  // Chat venster
                  '<div class="db-preview-window">' +
                    '<div class="db-preview-header" style="background:linear-gradient(135deg,#6366f1,#4f46e5)">' +
                      '<div class="db-preview-logo">' +
                        '<svg viewBox="0 0 24 24" width="12" height="12" fill="white"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.82.49 3.53 1.34 5L2.5 21.5l4.5-.84A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>' +
                      '</div>' +
                      '<div class="db-preview-title">Chat</div>' +
                    '</div>' +
                    '<div class="db-preview-messages">' +
                      '<div class="db-preview-msg db-preview-msg-bot">Hallo! Hoe kan ik u helpen?</div>' +
                      '<div class="db-preview-msg db-preview-msg-user" style="background:linear-gradient(135deg,#6366f1,#4f46e5)">Hallo, ik heb een vraag</div>' +
                      '<div class="db-preview-msg db-preview-msg-bot">Natuurlijk, ik help u graag!</div>' +
                    '</div>' +
                    '<div class="db-preview-input">' +
                      '<div class="db-preview-input-field"></div>' +
                      '<div class="db-preview-send" style="background:linear-gradient(135deg,#6366f1,#4f46e5)"></div>' +
                    '</div>' +
                  '</div>' +

                  // Toggle knop
                  '<div class="db-preview-toggle" style="background:linear-gradient(135deg,#6366f1,#4f46e5)">' +
                    '<svg viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.82.49 3.53 1.34 5L2.5 21.5l4.5-.84A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>' +
                    '<span class="db-preview-toggle-label">Stel ons een vraag</span>' +
                  '</div>' +

                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +

        '</div>' +
      '</form>' +

      // Formulier footer (sticky)
      '<div class="db-form-footer">' +
        '<button type="button" class="db-btn db-btn-danger db-hidden" id="db-btn-delete">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>' +
          'Verwijderen' +
        '</button>' +
        '<div class="db-form-footer-right">' +
          '<button type="button" class="db-btn db-btn-secondary" id="db-btn-cancel">Annuleren</button>' +
          '<button type="submit" form="db-widget-form" class="db-btn db-btn-primary" id="db-btn-save">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' +
            'Opslaan' +
          '</button>' +
        '</div>' +
      '</div>';

    return div;
  }

  function makePreset(primary, secondary, label) {
    return '<div class="db-color-preset" ' +
      'data-primary="' + primary + '" ' +
      'data-secondary="' + secondary + '" ' +
      'title="' + label + '" ' +
      'style="background:linear-gradient(135deg,' + primary + ',' + secondary + ')"></div>';
  }

  // ─── Event listeners koppelen ─────────────────────────────────────────────────

  function bindFormEvents() {
    var form = document.getElementById('db-widget-form');
    if (!form) return;

    // Live preview bij elk input event
    form.addEventListener('input', updatePreview);

    // Kleurpicker synchronisatie
    initColorInputs(form);

    // Opslaan
    form.addEventListener('submit', saveWidget);

    // Terug knop
    document.getElementById('db-btn-back').addEventListener('click', showList);
    document.getElementById('db-btn-cancel').addEventListener('click', showList);

    // Verwijderen
    document.getElementById('db-btn-delete').addEventListener('click', deleteWidget);

    // Embed code kopiëren
    var copyBtn = document.getElementById('db-embed-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var pre = document.getElementById('db-embed-code-pre');
        if (!pre) return;
        copyText(pre.textContent);
        copyBtn.textContent = 'Gekopieerd!';
        copyBtn.classList.add('copied');
        setTimeout(function () {
          copyBtn.textContent = 'Kopieer';
          copyBtn.classList.remove('copied');
        }, 2000);
      });
    }
  }

  // ─── Bootstrap ───────────────────────────────────────────────────────────────

  function init() {
    var content = document.getElementById('db-content');
    if (!content) return;

    // Views aanmaken
    content.appendChild(buildListView());
    content.appendChild(buildFormView());

    // Toast element
    var toastEl = document.createElement('div');
    toastEl.id = 'db-toast';
    toastEl.className = 'db-toast';
    toastEl.innerHTML =
      '<svg class="db-toast-icon" viewBox="0 0 24 24" fill="currentColor"></svg>' +
      '<span class="db-toast-msg"></span>';
    document.body.appendChild(toastEl);

    // Navigatie
    document.getElementById('db-btn-new').addEventListener('click', function () { showForm(null); });

    document.querySelectorAll('.db-nav-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        var view = item.dataset.view;
        if (view === 'list') showList();
      });
    });

    // Form events
    bindFormEvents();

    // Begin op lijst view
    showList();
  }

  // Start na DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
