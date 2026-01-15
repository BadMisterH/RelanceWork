import { Router } from "express";
import {
  getAllApplications,
  createApplication,
  updateRelanceStatus,
  deleteApplication,
} from "../controllers/applicationController";

const router = Router();

// GET /applications - Récupérer toutes les applications
router.get("/applications", getAllApplications);

// POST /application - Créer une nouvelle application
router.post("/application", createApplication);

// PUT /applications/:id/relance - Mettre à jour le statut de relance
router.put("/applications/:id/relance", updateRelanceStatus);

// DELETE /applications/:id - Supprimer une application par ID
router.delete("/applications/:id", deleteApplication);

export default router;
