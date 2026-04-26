import { ScrapedJob } from './indeedScraper';

const RAPIDAPI_HOST = 'jsearch.p.rapidapi.com';
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}/search`;

interface ApplyOption {
  publisher: string;
  apply_link: string;
  is_direct: boolean;
}

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
  apply_options?: ApplyOption[];
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

/**
 * Convert volatile Indeed redirect/apply URLs to stable permanent viewjob URLs.
 * Examples cleaned:
 *   https://fr.indeed.com/applystart?jk=abc123  → https://fr.indeed.com/viewjob?jk=abc123
 *   https://www.indeed.com/rc/clk?jk=abc123     → https://fr.indeed.com/viewjob?jk=abc123
 */
function stableUrl(raw: string): string {
  if (!raw) return raw;
  if (!raw.includes('indeed.com')) return raw;

  try {
    const parsed = new URL(raw);
    const jk = parsed.searchParams.get('jk') || parsed.pathname.match(/\/viewjob\/([a-f0-9]+)/i)?.[1];
    if (jk) return `https://fr.indeed.com/viewjob?jk=${jk}`;
  } catch {
    // malformed URL — return as-is
  }
  return raw;
}

/**
 * Pick the best apply URL for a job:
 *   1. Direct employer link (is_direct=true) — most stable
 *   2. LinkedIn job page — stable until removed
 *   3. Cleaned Indeed viewjob URL — permanent
 *   4. Raw job_apply_link cleaned of Indeed tracking params
 */
function pickBestUrl(job: JSearchJob): string {
  const options = job.apply_options || [];

  // 1. Direct employer link
  const direct = options.find(o => o.is_direct && o.apply_link);
  if (direct) return direct.apply_link;

  // 2. LinkedIn stable URL
  const linkedin = options.find(o => o.publisher?.toLowerCase().includes('linkedin') && o.apply_link);
  if (linkedin) return linkedin.apply_link;

  // 3. Clean the default apply link
  return stableUrl(job.job_apply_link);
}

export async function scrapeJSearch(
  keyword: string,
  location: string = 'France',
  maxPages: number = 2,
  datePosted: 'all' | 'week' | 'month' = 'all'
): Promise<ScrapedJob[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error('RAPIDAPI_KEY manquante dans .env');

  const jobs: ScrapedJob[] = [];
  const seenIds = new Set<string>();

  const normalizedLocation = location.toLowerCase().includes('france') ? location : `${location}, France`;
  const query = `${keyword} jobs in ${normalizedLocation}`;

  const datePostedParam = datePosted === 'all' ? null : datePosted;

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(RAPIDAPI_BASE);
    url.searchParams.set('query', query);
    url.searchParams.set('page', String(page));
    url.searchParams.set('num_pages', '1');
    url.searchParams.set('country', 'fr');
    if (datePostedParam) url.searchParams.set('date_posted', datePostedParam);

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

      const bestUrl = pickBestUrl(job);

      jobs.push({
        title: job.job_title,
        company: job.employer_name,
        location: locationStr,
        salary: buildSalaryString(job),
        description: (job.job_description || '').substring(0, 4000),
        url: bestUrl,
        scrapedAt: new Date().toISOString(),
        publishedAt: job.job_posted_at_datetime_utc || null,
      });

      console.log(`  ✓ [${job.job_publisher || 'JSearch'}] ${job.job_title} @ ${job.employer_name} → ${bestUrl}`);
    }

    if (page < maxPages) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`✅ JSearch: ${jobs.length} offres collectées`);
  return jobs;
}
