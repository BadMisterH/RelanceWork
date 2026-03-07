import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { runJobAgentPipeline } from '../services/jobAgentService';
import { generateCoverLetter, adaptCV } from '../services/coverLetterService';

// POST /api/job-agent/search
// Démarre le pipeline: scrape Indeed → analyse IA → sauvegarde les prospects
export const startSearch = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ message: 'Non authentifié' }); return; }

  const {
    keyword,
    location = 'France',
    maxPages = 2,
    scoreThreshold = 70,
    userProfile,
    generateLetters = false,
    source = 'indeed',
  } = req.body;

  if (!keyword || !userProfile) {
    res.status(400).json({ message: 'keyword et userProfile sont requis' });
    return;
  }

  if (typeof maxPages !== 'number' || maxPages < 1 || maxPages > 5) {
    res.status(400).json({ message: 'maxPages doit être entre 1 et 5' });
    return;
  }

  // Récupère le nom depuis Supabase Auth
  const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
  const userName: string = authUser?.user_metadata?.name || '';

  try {
    const result = await runJobAgentPipeline(userId, {
      keyword,
      location,
      maxPages,
      scoreThreshold,
      userProfile,
      userName,
      generateLetters,
      source: source as 'indeed' | 'jsearch',
    });

    res.json({
      success: true,
      message: `Pipeline terminé. ${result.saved} offre(s) sauvegardée(s) sur ${result.scraped} scrappée(s).`,
      ...result,
    });
  } catch (err: any) {
    console.error('❌ Pipeline error:', err.message);
    res.status(500).json({ message: err.message || 'Erreur pipeline' });
  }
};

// GET /api/job-agent/prospects
// Retourne les offres analysées de l'utilisateur
export const getProspects = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ message: 'Non authentifié' }); return; }

  const { status, minScore } = req.query;

  let query = supabase
    .from('job_prospects')
    .select('*')
    .eq('user_id', userId)
    .order('match_score', { ascending: false });

  if (status) query = query.eq('status', status as string);
  if (minScore) query = query.gte('match_score', Number(minScore));

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ message: 'Erreur récupération des prospects' });
    return;
  }

  res.json(data);
};

// POST /api/job-agent/prospects/:id/generate-letter
// Génère (ou régénère) la lettre de motivation pour un prospect
export const generateLetter = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ message: 'Non authentifié' }); return; }

  const { id } = req.params;
  const { userProfile } = req.body;

  if (!userProfile) {
    res.status(400).json({ message: 'userProfile est requis' });
    return;
  }

  const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
  const userName: string = authUser?.user_metadata?.name || '';

  const { data: prospect, error: fetchErr } = await supabase
    .from('job_prospects')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !prospect) {
    res.status(404).json({ message: 'Prospect introuvable' });
    return;
  }

  try {
    const letter = await generateCoverLetter(
      prospect.title,
      prospect.company,
      prospect.description || '',
      userProfile,
      userName || ''
    );

    const { error: updateErr } = await supabase
      .from('job_prospects')
      .update({ cover_letter: letter })
      .eq('id', id)
      .eq('user_id', userId);

    if (updateErr) throw updateErr;

    res.json({ success: true, cover_letter: letter });
  } catch (err: any) {
    res.status(500).json({ message: 'Erreur génération lettre' });
  }
};

// POST /api/job-agent/prospects/:id/adapt-cv
// Adapte le CV de base pour un prospect spécifique
export const adaptCVForProspect = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ message: 'Non authentifié' }); return; }

  const { id } = req.params;
  const { baseCV } = req.body;

  if (!baseCV) {
    res.status(400).json({ message: 'baseCV est requis' });
    return;
  }

  const { data: prospect, error: fetchErr } = await supabase
    .from('job_prospects')
    .select('title, description')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !prospect) {
    res.status(404).json({ message: 'Prospect introuvable' });
    return;
  }

  try {
    const adaptedCV = await adaptCV(baseCV, prospect.title, prospect.description || '');
    res.json({ success: true, adapted_cv: adaptedCV });
  } catch {
    res.status(500).json({ message: "Erreur adaptation CV" });
  }
};

// POST /api/job-agent/prospects/:id/apply
// Convertit un prospect en candidature dans le tableau de bord principal
export const applyToProspect = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ message: 'Non authentifié' }); return; }

  const { id } = req.params;

  const { data: prospect, error: fetchErr } = await supabase
    .from('job_prospects')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !prospect) {
    res.status(404).json({ message: 'Prospect introuvable' });
    return;
  }

  // Insert into main applications table
  const today = new Date();
  const date = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;

  const { data: newApp, error: insertErr } = await supabase
    .from('applications')
    .insert({
      user_id: userId,
      company: prospect.company,
      poste: prospect.title,
      status: 'pas de réponse',
      date,
      relanced: false,
      email: null,
    })
    .select()
    .single();

  if (insertErr) {
    res.status(500).json({ message: 'Erreur création candidature' });
    return;
  }

  // Mark prospect as applied
  await supabase
    .from('job_prospects')
    .update({ status: 'applied' })
    .eq('id', id)
    .eq('user_id', userId);

  res.json({
    success: true,
    message: `Candidature créée pour ${prospect.title} @ ${prospect.company}`,
    application: newApp,
  });
};

// DELETE /api/job-agent/prospects/:id
export const deleteProspect = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ message: 'Non authentifié' }); return; }

  const { id } = req.params;

  const { error } = await supabase
    .from('job_prospects')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    res.status(500).json({ message: 'Erreur suppression' });
    return;
  }

  res.json({ success: true });
};

// PATCH /api/job-agent/prospects/:id/letter
export const updateProspectLetter = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ message: 'Non authentifié' }); return; }

  const { id } = req.params;
  const { cover_letter } = req.body;

  if (typeof cover_letter !== 'string' || !cover_letter.trim()) {
    res.status(400).json({ message: 'cover_letter est requis' });
    return;
  }

  const { error } = await supabase
    .from('job_prospects')
    .update({ cover_letter: cover_letter.trim() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    res.status(500).json({ message: 'Erreur sauvegarde lettre' });
    return;
  }

  res.json({ success: true });
};

// PATCH /api/job-agent/prospects/:id/status
export const updateProspectStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ message: 'Non authentifié' }); return; }

  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['ready', 'applied', 'rejected', 'saved'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ message: `Statut invalide. Valeurs: ${validStatuses.join(', ')}` });
    return;
  }

  const { error } = await supabase
    .from('job_prospects')
    .update({ status })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    res.status(500).json({ message: 'Erreur mise à jour statut' });
    return;
  }

  res.json({ success: true });
};
