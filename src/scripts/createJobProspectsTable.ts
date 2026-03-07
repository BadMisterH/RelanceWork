import { supabase } from '../config/supabase';

// Run: npm run ts-node src/scripts/createJobProspectsTable.ts
// Or execute the SQL below directly in Supabase SQL editor

const SQL = `
CREATE TABLE IF NOT EXISTS job_prospects (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Job data (scraped)
  title         TEXT NOT NULL,
  company       TEXT NOT NULL,
  location      TEXT,
  salary        TEXT,
  description   TEXT,
  source_url    TEXT,
  search_keyword TEXT,

  -- AI analysis
  match_score   INTEGER DEFAULT 0,
  skills_required JSONB DEFAULT '[]',
  skills_missing  JSONB DEFAULT '[]',
  job_type      TEXT,
  seniority     TEXT,
  why_apply     TEXT,

  -- Generated content
  cover_letter  TEXT,

  -- Status: ready | applied | rejected | saved
  status        TEXT DEFAULT 'ready',

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS job_prospects_user_id_idx ON job_prospects(user_id);
CREATE INDEX IF NOT EXISTS job_prospects_score_idx ON job_prospects(user_id, match_score DESC);

-- RLS: users only see their own prospects
ALTER TABLE job_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can manage their own prospects"
  ON job_prospects
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
`;

async function createTable() {
  console.log('Creating job_prospects table...');

  // Supabase JS client doesn't support raw DDL — print the SQL to run manually
  console.log('\n--- Run this SQL in your Supabase SQL editor ---\n');
  console.log(SQL);
  console.log('\n-------------------------------------------------\n');

  // Verify connection
  const { data, error } = await supabase.from('job_prospects').select('id').limit(1);
  if (error && error.code === '42P01') {
    console.log('Table does not exist yet. Run the SQL above in Supabase.');
  } else if (error) {
    console.error('Supabase connection error:', error.message);
  } else {
    console.log('✅ Table job_prospects already exists and is accessible.');
  }
}

createTable().catch(console.error);
