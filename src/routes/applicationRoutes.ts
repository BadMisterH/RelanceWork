import { Router } from "express";
import {
  getAllApplications,
  createApplication,
  updateRelanceStatus,
  sendRelance,
  deleteApplication,
} from "../controllers/applicationController";
import { authenticateToken } from "../middleware/authMiddleware";
import { checkApplicationLimit } from "../middleware/checkPlan";

const router = Router();

// GET /applications - Récupérer toutes les applications
router.get("/applications", authenticateToken, getAllApplications);

// POST /application - Créer une nouvelle application (limité à 10 en plan free)
router.post("/application", authenticateToken, checkApplicationLimit, createApplication);

// PUT /applications/:id/relance - Mettre à jour le statut de relance
router.put("/applications/:id/relance", authenticateToken, updateRelanceStatus);

// PUT /applications/:id/send-relance - Enregistrer l'envoi d'une relance (incrémente le compteur)
router.put("/applications/:id/send-relance", authenticateToken, sendRelance);

// DELETE /applications/:id - Supprimer une application par ID
router.delete("/applications/:id", authenticateToken, deleteApplication);

export default router;
