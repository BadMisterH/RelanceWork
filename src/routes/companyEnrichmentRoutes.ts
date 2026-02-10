import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { enrichCompany } from "../services/companyEnrichmentService";
import { supabase } from "../config/supabase";

const router = Router();

/**
 * POST /api/company-enrichment/enrich
 * Enrichir une entreprise a partir de son URL de site web.
 * Body: { url: string, applicationId?: number }
 * Si applicationId est fourni, sauvegarde le resultat dans la base.
 */
router.post("/enrich", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { url, applicationId } = req.body;
    const userId = (req as any).user?.id;

    if (!url) {
      return res.status(400).json({ error: "L'URL du site web est requise" });
    }

    console.log(`🔍 Enrichissement entreprise: ${url}`);

    const result = await enrichCompany(url);

    if (!result) {
      return res.json({
        success: false,
        message: "Impossible de recuperer les informations du site web",
      });
    }

    // Si un applicationId est fourni, sauvegarder dans Supabase
    if (applicationId && userId) {
      const { error: updateError } = await supabase
        .from("applications")
        .update({
          company_website: url,
          company_description: result.description || result.title,
        })
        .eq("id", applicationId)
        .eq("user_id", userId);

      if (updateError) {
        console.error("❌ Erreur sauvegarde enrichissement:", updateError);
      }
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("❌ Erreur route company-enrichment:", error);
    return res.status(500).json({
      error: "Erreur lors de l'enrichissement",
      message: error instanceof Error ? error.message : "Erreur inconnue",
    });
  }
});

export default router;
