import { Router } from "express";
import {
  getAllApplications,
  createApplication,
  updateRelanceStatus,
  sendRelance,
  deleteApplication,
} from "../controllers/applicationController";

const router = Router();

// GET /applications - Récupérer toutes les applications
router.get("/applications", getAllApplications);

// POST /application - Créer une nouvelle application
router.post("/application", createApplication);

// PUT /applications/:id/relance - Mettre à jour le statut de relance
router.put("/applications/:id/relance", updateRelanceStatus);

// PUT /applications/:id/send-relance - Enregistrer l'envoi d'une relance (incrémente le compteur)
router.put("/applications/:id/send-relance", sendRelance);

// DELETE /applications/:id - Supprimer une application par ID
router.delete("/applications/:id", deleteApplication);

export default router;
