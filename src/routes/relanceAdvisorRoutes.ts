import { Router, Request, Response } from "express";
import multer from "multer";
import { authenticateToken } from "../middleware/authMiddleware";
import { analyzeRelance } from "../services/relanceAdvisorService";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Seuls les fichiers PDF sont acceptés."));
    }
  },
});

router.post(
  "/analyze",
  authenticateToken,
  upload.single("cv"),
  async (req: Request, res: Response): Promise<void> => {
    const { jobUrl, company, poste } = req.body as {
      jobUrl?: string;
      company?: string;
      poste?: string;
    };

    if (!req.file) {
      res.status(400).json({ error: "Le CV (PDF) est requis." });
      return;
    }

    if (!jobUrl || !jobUrl.trim()) {
      res.status(400).json({ error: "L'URL de la fiche de poste est requise." });
      return;
    }

    if (!company || !poste) {
      res
        .status(400)
        .json({ error: "Les champs company et poste sont requis." });
      return;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      res
        .status(503)
        .json({ error: "Le service d'analyse n'est pas configuré." });
      return;
    }

    try {
      const result = await analyzeRelance({
        cvBuffer: req.file.buffer,
        jobUrl: jobUrl.trim(),
        company: company.trim(),
        poste: poste.trim(),
      });

      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur lors de l'analyse.";
      res.status(500).json({ error: message });
    }
  }
);

export default router;
