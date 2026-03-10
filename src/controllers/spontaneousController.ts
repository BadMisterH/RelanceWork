import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import {
  runSpontaneousPipeline,
  sendSpontaneousProspect,
  regenerateSpontaneousEmail,
} from '../services/spontaneousApplicationService';
import { generateSpontaneousEmail } from '../services/spontaneousEmailGenerator';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/spontaneous/search
// Lance le pipeline : découverte entreprises → enrichissement → génération email
// ─────────────────────────────────────────────────────────────────────────────
export async function startSpontaneousSearch(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: 'Non authentifié' }); return; }

  const {
    source = 'indeed',
    keyword,
    location = 'France',
    maxPages = 1,
    manualCompanies,
    userProfile,
    userName,
    targetRole,
    autoSend = false,
    cvBase64,
    cvFileName,
  } = req.body;

  if (!userProfile) {
    res.status(400).json({ error: 'userProfile est requis' });
    return;
  }
  if (source !== 'manual' && !keyword) {
    res.status(400).json({ error: 'keyword est requis pour la découverte automatique' });
    return;
  }
  if (source === 'manual' && (!manualCompanies || !Array.isArray(manualCompanies) || manualCompanies.length === 0)) {
    res.status(400).json({ error: 'manualCompanies[] est requis pour le mode manuel' });
    return;
  }

  // Hard cap : max 1 page pour protéger les crédits OpenAI
  const safePagesAutoSend = autoSend ? 1 : Math.min(Number(maxPages) || 1, 2);

  try {
    const result = await runSpontaneousPipeline(userId, {
      source,
      keyword,
      location,
      maxPages: safePagesAutoSend,
      manualCompanies,
      userProfile,
      userName,
      targetRole,
      autoSend,
      cvBase64,
      cvFileName,
    });

    res.json({ success: true, result });
  } catch (err: any) {
    console.error('❌ startSpontaneousSearch:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/spontaneous/prospects
// Liste les prospects spontanés de l'utilisateur
// ─────────────────────────────────────────────────────────────────────────────
export async function getProspects(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: 'Non authentifié' }); return; }

  const { status } = req.query;

  let query = supabase
    .from('spontaneous_prospects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status && typeof status === 'string') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ prospects: data ?? [] });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/spontaneous/prospects/:id/generate-email
// Génère (ou régénère) l'email pour un prospect
// ─────────────────────────────────────────────────────────────────────────────
export async function generateEmailForProspect(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: 'Non authentifié' }); return; }

  const { id } = req.params;
  const { userProfile, userName, targetRole } = req.body;

  if (!userProfile) {
    res.status(400).json({ error: 'userProfile est requis' });
    return;
  }

  try {
    const generated = await regenerateSpontaneousEmail(userId, id!, userProfile, userName, targetRole);
    res.json({ success: true, ...generated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/spontaneous/prospects/:id/send
// Envoie l'email d'un prospect via Gmail
// ─────────────────────────────────────────────────────────────────────────────
export async function sendProspect(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: 'Non authentifié' }); return; }

  const { id } = req.params;
  const { cvBase64, cvFileName } = req.body;

  try {
    const result = await sendSpontaneousProspect(userId, id!, cvBase64, cvFileName);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/spontaneous/prospects/:id/status
// Met à jour le statut d'un prospect
// ─────────────────────────────────────────────────────────────────────────────
export async function updateProspectStatus(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: 'Non authentifié' }); return; }

  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'sent', 'failed', 'replied', 'rejected'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `Statut invalide. Valeurs acceptées: ${validStatuses.join(', ')}` });
    return;
  }

  const { error } = await supabase
    .from('spontaneous_prospects')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/spontaneous/prospects/:id/email
// Sauvegarde un email édité manuellement
// ─────────────────────────────────────────────────────────────────────────────
export async function updateProspectEmail(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: 'Non authentifié' }); return; }

  const { id } = req.params;
  const { subject, body } = req.body;

  if (!subject && !body) {
    res.status(400).json({ error: 'subject ou body requis' });
    return;
  }

  const update: Record<string, string> = { updated_at: new Date().toISOString() };
  if (subject) update['email_subject'] = subject;
  if (body) update['email_body'] = body;

  const { error } = await supabase
    .from('spontaneous_prospects')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/spontaneous/prospects/:id
// Supprime un prospect
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteProspect(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: 'Non authentifié' }); return; }

  const { id } = req.params;

  const { error } = await supabase
    .from('spontaneous_prospects')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true });
}
