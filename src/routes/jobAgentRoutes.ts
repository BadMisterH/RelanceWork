import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireProPlan } from '../middleware/planMiddleware';
import {
  startSearch,
  getProspects,
  generateLetter,
  adaptCVForProspect,
  applyToProspect,
  deleteProspect,
  updateProspectStatus,
  updateProspectLetter,
} from '../controllers/jobAgentController';

const router = Router();

// POST /api/job-agent/search — Lance le pipeline complet (scrape + analyse IA) [Pro only]
router.post('/search', authenticateToken, requireProPlan, startSearch);

// GET /api/job-agent/prospects — Liste les offres analysées (?status=ready&minScore=80)
router.get('/prospects', authenticateToken, getProspects);

// POST /api/job-agent/prospects/:id/generate-letter — Génère la lettre de motivation [Pro only]
router.post('/prospects/:id/generate-letter', authenticateToken, requireProPlan, generateLetter);

// POST /api/job-agent/prospects/:id/adapt-cv — Adapte le CV pour l'offre [Pro only]
router.post('/prospects/:id/adapt-cv', authenticateToken, requireProPlan, adaptCVForProspect);

// POST /api/job-agent/prospects/:id/apply — Convertit en candidature dans le dashboard
router.post('/prospects/:id/apply', authenticateToken, applyToProspect);

// PATCH /api/job-agent/prospects/:id/status — Met à jour le statut (ready|applied|rejected|saved)
router.patch('/prospects/:id/status', authenticateToken, updateProspectStatus);

// PATCH /api/job-agent/prospects/:id/letter — Sauvegarde la lettre modifiée manuellement
router.patch('/prospects/:id/letter', authenticateToken, updateProspectLetter);

// DELETE /api/job-agent/prospects/:id — Supprime un prospect
router.delete('/prospects/:id', authenticateToken, deleteProspect);

export default router;
