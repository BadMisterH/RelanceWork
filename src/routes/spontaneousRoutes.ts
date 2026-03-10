import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireProPlan } from '../middleware/planMiddleware';
import {
  startSpontaneousSearch,
  getProspects,
  generateEmailForProspect,
  sendProspect,
  updateProspectStatus,
  updateProspectEmail,
  deleteProspect,
} from '../controllers/spontaneousController';

const router = Router();

// Tous les endpoints nécessitent d'être authentifié
router.use(authenticateToken);

// Lancer la découverte + génération d'emails [Pro only]
router.post('/search', requireProPlan, startSpontaneousSearch);

// Liste des prospects spontanés
router.get('/prospects', getProspects);

// Générer / régénérer l'email d'un prospect [Pro only]
router.post('/prospects/:id/generate-email', requireProPlan, generateEmailForProspect);

// Envoyer l'email via Gmail
router.post('/prospects/:id/send', sendProspect);

// Mettre à jour le statut
router.patch('/prospects/:id/status', updateProspectStatus);

// Sauvegarder un email édité manuellement
router.patch('/prospects/:id/email', updateProspectEmail);

// Supprimer un prospect
router.delete('/prospects/:id', deleteProspect);

export default router;
