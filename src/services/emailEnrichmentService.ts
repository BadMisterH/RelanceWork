import axios from "axios";

// URL de base de l'API Hunter.io
const HUNTER_API_URL = "https://api.hunter.io/v2";

// Types pour Hunter.io
interface HunterEmailResult {
  value: string;
  type: string;
  confidence: number;
  sources: Array<{
    domain: string;
    uri: string;
    extracted_on: string;
  }>;
}

interface HunterDomainSearchResponse {
  data: {
    domain: string;
    emails: HunterEmailResult[];
    pattern?: string;
  };
  meta: {
    results: number;
    limit: number;
    offset: number;
    params: {
      domain: string;
    };
  };
}

interface EmailSearchResult {
  emails: string[];
  companyName: string;
  source: string;
}

/**
 * Service pour enrichir les entreprises avec leurs emails via Hunter.io
 * Documentation: https://hunter.io/api-documentation/v2
 */
export class EmailEnrichmentService {
  private apiKey: string;

  constructor() {
    const key = process.env.HUNTER_API_KEY;
    if (!key) {
      throw new Error("HUNTER_API_KEY non configurée dans le fichier .env");
    }
    this.apiKey = key;
  }

  /**
   * Extraire le domaine d'une URL ou d'une entreprise
   * Par exemple: "Apple Inc" -> chercher sur Google
   */
  private extractDomain(companyName: string): string | null {
    // Pour simplifier, on va tenter de deviner le domaine
    // Format: "Nom Entreprise" -> "nom-entreprise.com"
    const normalized = companyName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    return `${normalized}.com`;
  }

  /**
   * Rechercher les emails d'un domaine via Hunter.io
   * @param domain - Domaine de l'entreprise (ex: "google.com")
   */
  private async searchDomain(domain: string): Promise<string[]> {
    try {
      const response = await axios.get<HunterDomainSearchResponse>(
        `${HUNTER_API_URL}/domain-search`,
        {
          params: {
            domain: domain,
            api_key: this.apiKey,
            limit: 10, // Limiter à 10 emails max
          },
        }
      );

      if (response.data.data.emails && response.data.data.emails.length > 0) {
        // Trier par confiance et prendre les meilleurs
        const sortedEmails = response.data.data.emails
          .sort((a, b) => b.confidence - a.confidence)
          .filter((email) => email.type === "personal" || email.type === "generic")
          .map((email) => email.value);

        console.log(`✅ ${sortedEmails.length} email(s) trouvé(s) pour ${domain}`);
        return sortedEmails;
      }

      return [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          console.error("❌ Limite de requêtes Hunter.io atteinte");
          throw new Error("Limite de requêtes atteinte. Attendez ou passez à un plan supérieur.");
        }
        console.error(`❌ Erreur Hunter.io pour ${domain}:`, error.response?.data);
      } else {
        console.error(`❌ Erreur lors de la recherche pour ${domain}:`, error);
      }
      return [];
    }
  }

  /**
   * Rechercher les emails d'une entreprise
   * @param companyName - Nom de l'entreprise
   * @param domain - Domaine optionnel (si connu)
   */
  async findCompanyEmails(
    companyName: string,
    domain?: string
  ): Promise<EmailSearchResult> {
    console.log(`🔍 Recherche d'emails pour: ${companyName}`);

    try {
      // Si pas de domaine fourni, essayer de le deviner
      const targetDomain = domain || this.extractDomain(companyName);

      if (!targetDomain) {
        return {
          emails: [],
          companyName,
          source: "no_domain",
        };
      }

      const emails = await this.searchDomain(targetDomain);

      return {
        emails,
        companyName,
        source: emails.length > 0 ? "hunter_io" : "not_found",
      };
    } catch (error) {
      console.error(`❌ Erreur lors de la recherche pour ${companyName}:`, error);
      return {
        emails: [],
        companyName,
        source: "error",
      };
    }
  }

  /**
   * Rechercher les emails pour plusieurs entreprises
   * @param companies - Liste des entreprises avec leur nom et domaine optionnel
   * @param maxConcurrent - Nombre maximum de recherches parallèles (défaut: 2 pour éviter rate limit)
   */
  async findMultipleCompanyEmails(
    companies: Array<{ name: string; domain?: string }>,
    maxConcurrent: number = 2
  ): Promise<EmailSearchResult[]> {
    console.log(`📊 Recherche d'emails pour ${companies.length} entreprises`);

    const results: EmailSearchResult[] = [];

    // Traiter par batch pour respecter les limites de l'API
    for (let i = 0; i < companies.length; i += maxConcurrent) {
      const batch = companies.slice(i, i + maxConcurrent);
      console.log(
        `🔄 Batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(companies.length / maxConcurrent)}`
      );

      const batchResults = await Promise.all(
        batch.map((company) =>
          this.findCompanyEmails(company.name, company.domain)
        )
      );

      results.push(...batchResults);

      // Pause entre les batches pour respecter les limites de l'API
      if (i + maxConcurrent < companies.length) {
        console.log("⏸️ Pause 1 seconde avant le prochain batch...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const totalEmails = results.reduce((sum, r) => sum + r.emails.length, 0);
    console.log(
      `✅ Total: ${totalEmails} email(s) trouvé(s) pour ${companies.length} entreprises`
    );

    return results;
  }
}

// Instance singleton
let enrichmentInstance: EmailEnrichmentService | null = null;

/**
 * Obtenir l'instance du service d'enrichissement
 * Crée l'instance si elle n'existe pas encore
 */
export function getEmailEnrichmentService(): EmailEnrichmentService {
  if (!enrichmentInstance) {
    try {
      enrichmentInstance = new EmailEnrichmentService();
    } catch (error) {
      console.error("❌ Impossible d'initialiser le service d'enrichissement:", error);
      throw error;
    }
  }
  return enrichmentInstance;
}
