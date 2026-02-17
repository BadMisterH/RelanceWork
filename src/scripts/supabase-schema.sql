-- ============================================
-- Schema PostgreSQL pour Supabase - RelanceWork
-- ============================================
--
-- INSTRUCTIONS:
-- 1. Ouvrez Supabase Dashboard: https://supabase.com/dashboard/project/owiwkxcwutaprgndlkhp/editor
-- 2. Allez dans "SQL Editor"
-- 3. Créez une "New query"
-- 4. Copiez-collez ce fichier et exécutez-le
--
-- ============================================

-- Table applications
-- Note: La table auth.users est automatiquement gérée par Supabase Auth
CREATE TABLE IF NOT EXISTS public.applications (
  id BIGSERIAL PRIMARY KEY,
  company TEXT NOT NULL,
  poste TEXT NOT NULL,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  relanced BOOLEAN DEFAULT false,
  email TEXT,
  user_email TEXT,
  relance_count INTEGER DEFAULT 0,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON public.applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_relanced ON public.applications(relanced) WHERE relanced = false;

-- ============================================
-- Row Level Security (RLS) - CRITIQUE
-- ============================================
-- RLS assure que chaque utilisateur ne peut voir/modifier QUE ses propres données

-- Activer RLS sur la table applications
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: Les utilisateurs ne voient que leurs propres applications
CREATE POLICY "Users can only see their own applications"
  ON public.applications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy INSERT: Les utilisateurs ne peuvent créer que des applications pour eux-mêmes
CREATE POLICY "Users can only insert their own applications"
  ON public.applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy UPDATE: Les utilisateurs ne peuvent modifier que leurs propres applications
CREATE POLICY "Users can only update their own applications"
  ON public.applications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy DELETE: Les utilisateurs ne peuvent supprimer que leurs propres applications
CREATE POLICY "Users can only delete their own applications"
  ON public.applications
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Vérification du schéma
-- ============================================

-- Afficher la structure de la table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'applications'
ORDER BY ordinal_position;

-- Afficher les policies RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'applications';

-- ============================================
-- Gmail (single-user) - Tokens de service
-- ============================================
-- Stockage du token OAuth Gmail pour l'API côté serveur (Railway)
CREATE TABLE IF NOT EXISTS public.gmail_service_tokens (
  id TEXT PRIMARY KEY,
  token_json JSONB NOT NULL,
  token_expiry TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Notes importantes:
-- ============================================
--
-- 1. La table auth.users est gérée automatiquement par Supabase Auth
--    Vous n'avez pas besoin de la créer manuellement
--
-- 2. Les policies RLS utilisent auth.uid() qui retourne l'UUID de l'utilisateur
--    authentifié via le JWT Supabase
--
-- 3. Si vous ajoutez des données manuellement via le Dashboard, assurez-vous
--    que le user_id correspond à un UUID existant dans auth.users
--
-- 4. Pour désactiver temporairement RLS (ATTENTION - uniquement en dev):
--    ALTER TABLE public.applications DISABLE ROW LEVEL SECURITY;
--
-- 5. Pour vérifier que RLS fonctionne, créez 2 users et testez que
--    user A ne peut pas voir/modifier les données de user B
