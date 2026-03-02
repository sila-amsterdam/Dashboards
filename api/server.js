/**
 * Chat Widget Platform – API Server
 *
 * Endpoints:
 *   GET    /api/widgets          – alle widgets (dashboard)
 *   GET    /api/widgets/:id      – publiek, config voor widget.js
 *   POST   /api/widgets          – nieuw widget aanmaken
 *   PUT    /api/widgets/:id      – widget bijwerken
 *   DELETE /api/widgets/:id      – widget verwijderen
 *
 * Statics:
 *   GET /widget.js               – embedbaar widget script
 *   GET /dashboard/*             – admin dashboard
 *
 * Start: node server.js
 */

'use strict';

var express = require('express');
var cors    = require('cors');
var path    = require('path');
var fs      = require('fs');
var { v4: uuidv4 } = require('uuid');

var app          = express();
var PORT         = process.env.PORT || 3000;
var WIDGETS_FILE = path.join(__dirname, 'widgets.json');

// ─── Bestandsopslag helpers ───────────────────────────────────────────────────

function readWidgets() {
  try {
    return JSON.parse(fs.readFileSync(WIDGETS_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeWidgets(data) {
  fs.writeFileSync(WIDGETS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

app.use(function (req, _res, next) {
  console.log('[' + new Date().toISOString() + '] ' + req.method + ' ' + req.path);
  next();
});

// ─── Statics: widget.js en dashboard ─────────────────────────────────────────

app.use('/widget.js', express.static(path.join(__dirname, '../widget/widget.js')));
app.use('/dashboard', express.static(path.join(__dirname, '../dashboard')));
app.use('/docs',      express.static(path.join(__dirname, '../docs')));

// ─── Routes ───────────────────────────────────────────────────────────────────

// Alle widgets ophalen (voor dashboard lijst)
app.get('/api/widgets', function (_req, res) {
  var widgets = readWidgets();
  res.json(Object.values(widgets));
});

// Één widget ophalen (publiek — gebruikt door widget.js)
app.get('/api/widgets/:id', function (req, res) {
  var widgets = readWidgets();
  var widget  = widgets[req.params.id];
  if (!widget) return res.status(404).json({ error: 'Widget niet gevonden' });
  res.json(widget);
});

// Nieuw widget aanmaken
app.post('/api/widgets', function (req, res) {
  var body = req.body || {};

  if (!body.name || !body.webhookUrl) {
    return res.status(400).json({ error: 'name en webhookUrl zijn verplicht' });
  }

  var id  = uuidv4().replace(/-/g, '').substring(0, 12);
  var now = new Date().toISOString();

  var widget = {
    id:         id,
    name:       String(body.name).trim(),
    webhookUrl: String(body.webhookUrl).trim(),
    branding: Object.assign({
      name:             String(body.name).trim(),
      logoUrl:          '',
      welcomeText:      'Hallo! Hoe kan ik u helpen?',
      toggleLabel:      'Stel ons een vraag',
      inputPlaceholder: 'Typ uw bericht...',
      sendLabel:        'Verstuur'
    }, body.branding || {}),
    theme: Object.assign({
      primaryColor:   '#6366f1',
      secondaryColor: '#4f46e5'
    }, body.theme || {}),
    createdAt: now,
    updatedAt: now
  };

  var widgets    = readWidgets();
  widgets[id]    = widget;
  writeWidgets(widgets);

  res.status(201).json(widget);
});

// Widget bijwerken
app.put('/api/widgets/:id', function (req, res) {
  var widgets = readWidgets();
  var widget  = widgets[req.params.id];
  if (!widget) return res.status(404).json({ error: 'Widget niet gevonden' });

  var body = req.body || {};

  if (body.name)       widget.name       = String(body.name).trim();
  if (body.webhookUrl) widget.webhookUrl = String(body.webhookUrl).trim();
  if (body.branding)   widget.branding   = Object.assign(widget.branding, body.branding);
  if (body.theme)      widget.theme      = Object.assign(widget.theme, body.theme);

  widget.updatedAt = new Date().toISOString();

  widgets[req.params.id] = widget;
  writeWidgets(widgets);

  res.json(widget);
});

// Standalone embed code genereren (volledige widget JS inline, geen server nodig)
app.get('/api/widgets/:id/embed', function (req, res) {
  var widgets = readWidgets();
  var widget  = widgets[req.params.id];
  if (!widget) return res.status(404).json({ error: 'Widget niet gevonden' });

  var widgetJs = fs.readFileSync(path.join(__dirname, '../widget/widget.js'), 'utf8');
  var cfg = {
    webhookUrl: widget.webhookUrl,
    branding:   widget.branding || {},
    theme:      widget.theme    || {}
  };

  // Single quotes escapen zodat data-config='...' veilig is
  var cfgJson = JSON.stringify(cfg).replace(/'/g, '&#39;');
  var snippet = '<script data-config=\'' + cfgJson + '\'>\n' + widgetJs + '\n<\/script>';

  res.type('text/plain').send(snippet);
});

// Widget verwijderen
app.delete('/api/widgets/:id', function (req, res) {
  var widgets = readWidgets();
  if (!widgets[req.params.id]) {
    return res.status(404).json({ error: 'Widget niet gevonden' });
  }
  delete widgets[req.params.id];
  writeWidgets(widgets);
  res.json({ deleted: req.params.id });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use(function (err, _req, res, _next) {
  console.error(err);
  res.status(500).json({ error: 'Interne serverfout' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, function () {
  console.log('Chat Widget API draait op http://localhost:' + PORT);
  console.log('  Dashboard: http://localhost:' + PORT + '/dashboard/');
  console.log('  Widget.js: http://localhost:' + PORT + '/widget.js');
});
