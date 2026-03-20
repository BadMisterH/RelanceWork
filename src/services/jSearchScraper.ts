import { ScrapedJob } from './indeedScraper';

const RAPIDAPI_HOST = 'jsearch.p.rapidapi.com';
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}/search`;

interface JSearchJob {
  job_id: string;
  employer_name: string;
  job_title: string;
  job_city: string | null;
  job_country: string | null;
  job_description: string;
  job_apply_link: string;
  job_employment_type: string | null;
  job_salary_min: number | null;
  job_salary_max: number | null;
  job_salary_currency: string | null;
  job_posted_at_datetime_utc: string | null;
  job_publisher: string | null;
}

interface JSearchResponse {
  status: string;
  data: JSearchJob[];
}

function buildSalaryString(job: JSearchJob): string | null {
  if (!job.job_salary_min && !job.job_salary_max) return null;
  const currency = job.job_salary_currency || '€';
  if (job.job_salary_min && job.job_salary_max) {
    return `${job.job_salary_min.toLocaleString()} – ${job.job_salary_max.toLocaleString()} ${currency}`;
  }
  return `${(job.job_salary_min || job.job_salary_max)!.toLocaleString()} ${currency}`;
}

export async function scrapeJSearch(
  keyword: string,
  location: string = 'France',
  maxPages: number = 2
): Promise<ScrapedJob[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error('RAPIDAPI_KEY manquante dans .env');

  const jobs: ScrapedJob[] = [];
  const seenIds = new Set<string>();

  // JSearch expects English natural language queries with "jobs" for better matching
  // e.g. "web designer jobs in Paris France" not "Webdesigner in Paris"
  const normalizedLocation = location.toLowerCase().includes('france') ? location : `${location}, France`;
  const query = `${keyword} jobs in ${normalizedLocation}`;

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(RAPIDAPI_BASE);
    url.searchParams.set('query', query);
    url.searchParams.set('page', String(page));
    url.searchParams.set('num_pages', '1');
    url.searchParams.set('country', 'fr'); // search in France, not US (default)

    console.log(`📄 JSearch page ${page}/${maxPages}: "${query}"`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ JSearch HTTP ${response.status}:`, errorText);
      if (response.status === 429) throw new Error('Quota JSearch dépassé (200 req/mois gratuit)');
      break;
    }

    const json: JSearchResponse = await response.json();

    // Debug: log full response structure on first page
    if (page === 1) {
      console.log('JSearch raw response status:', json.status);
      console.log('JSearch data length:', json.data?.length ?? 'undefined');
      if (!json.data || json.data.length === 0) {
        console.log('JSearch full response (debug):', JSON.stringify(json).substring(0, 500));
      }
    }

    if (!json.data || json.data.length === 0) {
      console.log(`  → Aucun résultat page ${page}`);
      break;
    }

    console.log(`  → ${json.data.length} offres`);

    for (const job of json.data) {
      if (seenIds.has(job.job_id)) continue;
      if (!job.job_title || !job.employer_name || !job.job_apply_link) continue;
      seenIds.add(job.job_id);

      const locationStr = [job.job_city, job.job_country]
        .filter(Boolean)
        .join(', ');

      jobs.push({
        title: job.job_title,
        company: job.employer_name,
        location: locationStr,
        salary: buildSalaryString(job),
        description: (job.job_description || '').substring(0, 4000),
        url: job.job_apply_link,
        scrapedAt: new Date().toISOString(),
        publishedAt: job.job_posted_at_datetime_utc || null,
      });

      console.log(`  ✓ [${job.job_publisher || 'JSearch'}] ${job.job_title} @ ${job.employer_name}`);
    }

    // Small delay between pages
    if (page < maxPages) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`✅ JSearch: ${jobs.length} offres collectées`);
  return jobs;
}
