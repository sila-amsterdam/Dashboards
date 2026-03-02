-- ============================================================
-- Chatbot Database Setup
-- Uitvoeren: eenmalig in n8n Cloud Postgres of via admin tool
-- ============================================================

-- Sessie-geheugen: slaat de conversatiegeschiedenis op per sessie
CREATE TABLE IF NOT EXISTS chatbot_memory (
  id          SERIAL PRIMARY KEY,
  session_id  VARCHAR(255) NOT NULL,
  company_id  VARCHAR(255) NOT NULL,
  role        VARCHAR(50)  NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Indexen voor snelle lookups
CREATE INDEX IF NOT EXISTS idx_chatbot_memory_session
  ON chatbot_memory(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chatbot_memory_company
  ON chatbot_memory(company_id);


-- Bedrijfskennis: FAQ per bedrijf voor de AI system prompt
CREATE TABLE IF NOT EXISTS chatbot_knowledge (
  id          SERIAL PRIMARY KEY,
  company_id  VARCHAR(255) NOT NULL,
  category    VARCHAR(100),
  question    TEXT         NOT NULL,
  answer      TEXT         NOT NULL,
  keywords    TEXT,
  active      BOOLEAN      DEFAULT TRUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Index voor snelle filtering op company
CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_company
  ON chatbot_knowledge(company_id, active);


-- ============================================================
-- Voorbeelddata: voeg hier bedrijfskennis toe
-- Pas company_id aan naar het bedrijf (bijv. 'sila-ai', 'klant-001')
-- ============================================================

INSERT INTO chatbot_knowledge (company_id, category, question, answer, keywords) VALUES
  ('company-001', 'Algemeen',      'Wat zijn jullie openingstijden?',           'Wij zijn bereikbaar van maandag t/m vrijdag, 9:00 - 17:00.', 'openingstijden,uren,open'),
  ('company-001', 'Algemeen',      'Hoe kan ik contact opnemen?',               'U kunt ons bereiken via info@bedrijf.nl of bel 020-1234567.', 'contact,email,telefoon,bellen'),
  ('company-001', 'Diensten',      'Welke diensten bieden jullie aan?',         'Wij bieden consultancy, implementatie en training aan op het gebied van AI en automatisering.', 'diensten,aanbod,services'),
  ('company-001', 'Afspraken',     'Hoe kan ik een afspraak maken?',            'U kunt via deze chat een afspraak inplannen. Laat me weten wanneer u beschikbaar bent!', 'afspraak,boeken,plannen,inplannen'),
  ('company-001', 'Prijzen',       'Wat kosten jullie diensten?',               'Onze tarieven zijn op aanvraag. Neem contact op voor een vrijblijvende offerte.', 'prijs,kosten,tarief,offerte');


-- ============================================================
-- Optioneel: opruimen van oude sessies (oudere dan 30 dagen)
-- Kan ook als n8n scheduled workflow worden ingezet
-- ============================================================
-- DELETE FROM chatbot_memory WHERE created_at < NOW() - INTERVAL '30 days';


-- ============================================================
-- Toekomstige RAG-uitbreiding (pgvector)
-- Uitvoeren ALLEEN als pgvector extensie beschikbaar is
-- ============================================================
-- CREATE EXTENSION IF NOT EXISTS vector;
-- ALTER TABLE chatbot_knowledge ADD COLUMN IF NOT EXISTS embedding vector(1536);
-- CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_embedding
--   ON chatbot_knowledge USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);
