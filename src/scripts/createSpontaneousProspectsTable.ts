import { supabase } from '../config/supabase';

const createSpontaneousProspectsTable = async () => {
  console.log('🚀 Création de la table spontaneous_prospects...');

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS spontaneous_prospects (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

        -- Infos entreprise
        company_name TEXT NOT NULL,
        company_domain TEXT,
        company_website TEXT,
        company_description TEXT,
        company_favicon TEXT,

        -- Contact trouvé
        contact_email TEXT,

        -- Email généré
        email_subject TEXT,
        email_body TEXT,
        cv_attached BOOLEAN DEFAULT FALSE,

        -- Statut: pending | sent | failed | replied | rejected
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'replied', 'rejected')),

        -- Métadonnées
        search_keyword TEXT,
        source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'indeed', 'jsearch')),
        gmail_message_id TEXT,
        sent_at TIMESTAMPTZ,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Index de performance
      CREATE INDEX IF NOT EXISTS idx_spontaneous_prospects_user_id ON spontaneous_prospects(user_id);
      CREATE INDEX IF NOT EXISTS idx_spontaneous_prospects_status ON spontaneous_prospects(status);

      -- RLS
      ALTER TABLE spontaneous_prospects ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users manage own spontaneous prospects" ON spontaneous_prospects;
      CREATE POLICY "Users manage own spontaneous prospects"
        ON spontaneous_prospects
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    `
  });

  if (error) {
    console.error('❌ Erreur création table:', error.message);
    console.log('\n📋 Exécute ce SQL manuellement dans Supabase SQL Editor:\n');
    console.log(`
CREATE TABLE IF NOT EXISTS spontaneous_prospects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_domain TEXT,
  company_website TEXT,
  company_description TEXT,
  company_favicon TEXT,
  contact_email TEXT,
  email_subject TEXT,
  email_body TEXT,
  cv_attached BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'replied', 'rejected')),
  search_keyword TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'indeed', 'jsearch')),
  gmail_message_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spontaneous_prospects_user_id ON spontaneous_prospects(user_id);
CREATE INDEX IF NOT EXISTS idx_spontaneous_prospects_status ON spontaneous_prospects(status);
ALTER TABLE spontaneous_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own spontaneous prospects"
  ON spontaneous_prospects FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    `);
  } else {
    console.log('✅ Table spontaneous_prospects créée avec succès');
  }

  process.exit(0);
};

createSpontaneousProspectsTable();
