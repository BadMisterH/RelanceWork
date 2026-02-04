import { Router, Request, Response } from "express";
import { getEmailEnrichmentService } from "../services/emailEnrichmentService";

const router = Router();

/**
 * POST /api/email-enrichment/find-email
 * Rechercher l'email d'une entreprise
 * Body: { companyName: string, domain?: string }
 */
router.post("/find-email", async (req: Request, res: Response) => {
  try {
    const { companyName, domain } = req.body;

    if (!companyName) {
      return res.status(400).json({
        error: "Le nom de l'entreprise est requis",
      });
    }

    console.log(`📥 Requête de recherche d'email pour: ${companyName}`);

    const enrichmentService = getEmailEnrichmentService();
    const result = await enrichmentService.findCompanyEmails(companyName, domain);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("❌ Erreur route find-email:", error);
    return res.status(500).json({
      error: "Erreur lors de la recherche d'emails",
      message: error instanceof Error ? error.message : "Erreur inconnue",
    });
  }
});

/**
 * POST /api/email-enrichment/find-emails-batch
 * Rechercher les emails de plusieurs entreprises
 * Body: { companies: Array<{ name: string, domain?: string }>, maxConcurrent?: number }
 */
router.post("/find-emails-batch", async (req: Request, res: Response) => {
  try {
    const { companies, maxConcurrent = 2 } = req.body;

    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({
        error: "Une liste d'entreprises est requise",
      });
    }

    console.log(`📥 Requête de recherche batch pour ${companies.length} entreprises`);

    const enrichmentService = getEmailEnrichmentService();
    const results = await enrichmentService.findMultipleCompanyEmails(
      companies,
      maxConcurrent
    );

    return res.json({
      success: true,
      data: results,
      summary: {
        total: companies.length,
        withEmails: results.filter((r) => r.emails.length > 0).length,
        totalEmails: results.reduce((sum, r) => sum + r.emails.length, 0),
      },
    });
  } catch (error) {
    console.error("❌ Erreur route find-emails-batch:", error);
    return res.status(500).json({
      error: "Erreur lors de la recherche d'emails",
      message: error instanceof Error ? error.message : "Erreur inconnue",
    });
  }
});

export default router;
