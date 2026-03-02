# Chatbot Integration Guide

Handleiding voor het onboarden van een nieuw bedrijf op het chatbot platform.

---

## Overzicht

Het chatbot systeem bestaat uit drie lagen:

```
Klant website
    ↓ POST { sessionId, message, companyId }
n8n Webhook (chatbot-backend.json)
    ↓ SELECT kennis voor companyId
    ↓ Claude AI genereer antwoord
    ↓ INSERT geheugen voor sessionId
    ↑ { answer, appointmentBooked, sessionId }
Klant website
```

**Eén n8n workflow bedient alle bedrijven.** Isolatie loopt via `companyId`.

---

## Stap 1 — Eenmalige setup (al gedaan bij eerste gebruik)

### 1a. Database tabellen aanmaken

Voer `workflows/db-setup.sql` uit in de n8n Cloud Postgres database.

### 1b. Credentials aanmaken in n8n Cloud

| Credential naam | Type | Configuratie |
|----------------|------|--------------|
| `Anthropic API` | Header Auth | Header: `x-api-key` / Value: Anthropic API key |
| `n8n Cloud Postgres` | PostgreSQL | n8n Cloud database credentials |
| `Google Calendar` | OAuth2 | Autoriseer via Google account |

### 1c. Workflow importeren

1. Ga naar [sila-ai.app.n8n.cloud](https://sila-ai.app.n8n.cloud)
2. Workflows → New → Import from JSON
3. Upload `workflows/chatbot-backend.json`
4. Koppel de credentials aan de juiste nodes
5. Activeer de workflow

De webhook is daarna beschikbaar op:
```
https://sila-ai.app.n8n.cloud/webhook/chatbot
```

---

## Stap 2 — Nieuw bedrijf toevoegen

### 2a. Kies een companyId

Gebruik een korte, lowercase identifier zonder spaties:
- Goed: `sila-ai`, `bakkerij-jansen`, `adviesbureau-001`
- Fout: `Bakkerij Jansen`, `adviesbureau 001`

### 2b. Voeg bedrijfskennis toe

Voeg FAQ-rijen toe aan de `chatbot_knowledge` tabel:

```sql
-- Basiskennis (pas aan per bedrijf)
INSERT INTO chatbot_knowledge (company_id, category, question, answer, keywords) VALUES
('COMPANY_ID', 'Algemeen',   'Wat zijn jullie openingstijden?',    'Wij zijn open van [DAGEN] [TIJDEN].', 'openingstijden,uren,open'),
('COMPANY_ID', 'Algemeen',   'Hoe kan ik contact opnemen?',        'Bereikbaar via [EMAIL] of [TELEFOON].', 'contact,email,telefoon'),
('COMPANY_ID', 'Diensten',   'Welke diensten bieden jullie aan?',  '[DIENSTEN BESCHRIJVING]', 'diensten,aanbod'),
('COMPANY_ID', 'Afspraken',  'Hoe kan ik een afspraak maken?',     'U kunt via deze chat een afspraak aanvragen.', 'afspraak,boeken,plannen'),
('COMPANY_ID', 'Prijzen',    'Wat zijn jullie tarieven?',          '[TARIEVEN INFO]', 'prijs,kosten,tarief');
```

Tip: gebruik de CSV template in `docs/company-knowledge-template.csv` om kennis in bulk te importeren.

### 2c. Genereer embed code

Kopieer de embed code en pas de waarden aan:

```html
<script>
  window.ChatbotConfig = {
    webhookUrl:     'https://sila-ai.app.n8n.cloud/webhook/chatbot',
    companyId:      'COMPANY_ID',        // ← aanpassen
    name:           'BEDRIJFSNAAM',      // ← aanpassen
    color:          '#000000',           // ← kleur in HEX
    logo:           'https://...',       // ← URL naar logo (of null)
    welcomeMessage: 'Hallo! Hoe kan ik u helpen?',  // ← aanpassen
    language:       'nl',               // 'nl' of 'en'
    position:       'bottom-right'      // of 'bottom-left'
  };
</script>
<script src="https://[jouw-cdn]/chatbot-widget.js"></script>
```

### 2d. Test de chatbot

Stuur een testverzoek:
```bash
curl -X POST https://sila-ai.app.n8n.cloud/webhook/chatbot \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-001",
    "message": "Hallo, wat zijn jullie openingstijden?",
    "companyId": "COMPANY_ID"
  }'
```

Verwacht antwoord:
```json
{
  "answer": "Wij zijn open van ...",
  "sessionId": "test-001",
  "appointmentBooked": false,
  "timestamp": "2025-..."
}
```

---

## Stap 3 — Afspraken (Google Calendar)

De chatbot detecteert automatisch wanneer iemand een afspraak wil. Dit werkt als volgt:

1. Gebruiker stuurt bericht met afspraakintendie ("Ik wil graag een afspraak")
2. Claude geeft `appointment_intent: true` terug
3. n8n boekt een event in Google Calendar
4. Response bevat `appointmentBooked: true`
5. Widget toont een groene badge: "Afspraak aangevraagd"

**Agenda configureren per bedrijf:**
De huidige implementatie boekt altijd in de primaire Google Calendar van het geautoriseerde account. Voor meerdere agenda's per bedrijf:
1. Voeg een `calendar_id` kolom toe aan `chatbot_knowledge`
2. Lees dit op in de "Lees Bedrijfskennis" node
3. Gebruik `$('Lees Bedrijfskennis').item.json.calendar_id` in de Calendar URL

---

## Kennis beheer

### Kennis toevoegen
```sql
INSERT INTO chatbot_knowledge (company_id, category, question, answer)
VALUES ('COMPANY_ID', 'Categorie', 'Vraag?', 'Antwoord.');
```

### Kennis updaten
```sql
UPDATE chatbot_knowledge
SET answer = 'Nieuw antwoord', active = true
WHERE company_id = 'COMPANY_ID' AND question LIKE '%openingstijden%';
```

### Kennis deactiveren (verbergen zonder verwijderen)
```sql
UPDATE chatbot_knowledge SET active = false WHERE id = 123;
```

### Gespreksgeschiedenis bekijken
```sql
SELECT session_id, role, content, created_at
FROM chatbot_memory
WHERE company_id = 'COMPANY_ID'
ORDER BY created_at DESC
LIMIT 50;
```

### Sessie verwijderen
```sql
DELETE FROM chatbot_memory WHERE session_id = 'sess_abc123';
```

---

## Schaalbaarheid

| Aspect | Huidige implementatie | Volgende stap |
|--------|----------------------|---------------|
| Geheugen | Postgres (unlimited sessies) | Automatisch opruimen na 30 dagen |
| Kennis | Postgres SQL (tot ~500 items) | pgvector RAG (1000+ items) |
| AI model | claude-haiku-4-5 | claude-sonnet-4-6 voor hogere kwaliteit |
| Bedrijven | Onbeperkt via companyId | - |
| Agenda | Google Calendar (1 account) | Meerdere calendars via calendar_id |
| Widget hosting | Lokale bestanden | CDN voor sneller laden |

---

## Problemen oplossen

| Probleem | Mogelijke oorzaak | Oplossing |
|---------|------------------|-----------|
| Widget laadt niet | webhookUrl ontbreekt | Controleer ChatbotConfig |
| "Fout opgetreden" | n8n workflow inactief | Activeer workflow in n8n |
| Geen antwoord op bedrijfskennis | Kennis nog niet toegevoegd | Voer db-setup.sql uit + voeg kennis toe |
| Afspraak boekt niet | Google Calendar credential verlopen | Herauthoriseer credential in n8n |
| Sessie reset | localStorage gewist | Normaal gedrag, nieuwe sessie start |
| CORS fout | Access-Control-Allow-Origin header mist | Controleer Stuur Antwoord node |
