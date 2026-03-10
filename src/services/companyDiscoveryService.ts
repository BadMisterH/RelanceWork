import { scrapeIndeed } from './indeedScraper';
import { scrapeJSearch } from './jSearchScraper';
import { enrichCompany } from './companyEnrichmentService';

export interface CompanyTarget {
  name: string;
  website?: string;
  domain?: string;
  description?: string;
  favicon?: string;
  source: 'indeed' | 'jsearch' | 'manual';
}

/**
 * Découvre des entreprises uniques à partir des offres d'emploi Indeed/JSearch.
 * Ces entreprises recrutent dans le secteur — idéal pour les candidatures spontanées.
 */
export async function discoverCompaniesFromJobListings(
  keyword: string,
  location: string = 'France',
  maxPages: number = 1,
  source: 'indeed' | 'jsearch' = 'indeed'
): Promise<CompanyTarget[]> {
  console.log(`🔍 Découverte d'entreprises [${source}]: "${keyword}" à ${location}`);

  let jobs;
  if (source === 'jsearch') {
    jobs = await scrapeJSearch(keyword, location, maxPages);
  } else {
    jobs = await scrapeIndeed(keyword, location, maxPages);
  }

  // Dédoublonner les entreprises
  const seen = new Set<string>();
  const companies: CompanyTarget[] = [];

  for (const job of jobs) {
    const key = job.company.toLowerCase().trim();
    if (!seen.has(key) && job.company) {
      seen.add(key);
      companies.push({
        name: job.company,
        source,
      });
    }
  }

  console.log(`✅ ${companies.length} entreprises uniques découvertes`);
  return companies;
}

/**
 * Enrichit une liste d'entreprises avec leur site web et description
 * via companyEnrichmentService.
 */
export async function enrichCompanyTargets(
  companies: CompanyTarget[]
): Promise<CompanyTarget[]> {
  const enriched: CompanyTarget[] = [];

  for (const company of companies) {
    if (!company.website) {
      enriched.push(company);
      continue;
    }

    try {
      const info = await enrichCompany(company.website);
      if (info) {
        const merged: CompanyTarget = { ...company };
        const desc = info.description || company.description;
        if (desc) merged.description = desc;
        if (info.favicon) merged.favicon = info.favicon;
        const domain = info.domain || company.domain;
        if (domain) merged.domain = domain;
        enriched.push(merged);
      } else {
        enriched.push(company);
      }
    } catch {
      enriched.push(company);
    }

    // Pause pour éviter les rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  return enriched;
}

/**
 * Construit une liste de CompanyTarget à partir d'une liste manuelle.
 */
export function buildManualTargets(
  companies: Array<{ name: string; domain?: string; website?: string }>
): CompanyTarget[] {
  return companies.map(c => {
    const target: CompanyTarget = { name: c.name, source: 'manual' };
    if (c.domain) target.domain = c.domain;
    const website = c.website || (c.domain ? `https://${c.domain}` : undefined);
    if (website) target.website = website;
    return target;
  });
}
