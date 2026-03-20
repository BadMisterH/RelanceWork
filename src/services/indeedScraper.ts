import puppeteer, { Browser, Page } from 'puppeteer';

export interface ScrapedJob {
  title: string;
  company: string;
  location: string;
  salary: string | null;
  description: string;
  url: string;
  scrapedAt: string;
  publishedAt?: string | null;
}

const DELAY_MS = (min: number, max: number) =>
  new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function getJobDescription(page: Page, url: string): Promise<string> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await DELAY_MS(800, 1500);

    const description = await page.evaluate(() => {
      const selectors = [
        '#jobDescriptionText',
        '.jobsearch-jobDescriptionText',
        '[data-testid="jobDescriptionText"]',
        '.job-snippet',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el.textContent?.trim() || '';
      }
      return '';
    });

    return description.substring(0, 4000); // Cap to avoid token overuse
  } catch {
    return '';
  }
}

export async function scrapeIndeed(
  keyword: string,
  location: string = 'France',
  maxPages: number = 3
): Promise<ScrapedJob[]> {
  let browser: Browser | null = null;
  const jobs: ScrapedJob[] = [];
  const seenUrls = new Set<string>();

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1280,800',
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 800 });

    // Hide automation indicators
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    for (let pageNum = 0; pageNum < maxPages; pageNum++) {
      const start = pageNum * 10;
      const encodedKeyword = encodeURIComponent(keyword);
      const encodedLocation = encodeURIComponent(location);
      const url = `https://fr.indeed.com/jobs?q=${encodedKeyword}&l=${encodedLocation}&start=${start}&lang=fr`;

      console.log(`📄 Scraping page ${pageNum + 1}/${maxPages}: ${url}`);

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await DELAY_MS(1500, 2500);

        // Handle cookie banner if present
        try {
          await page.waitForSelector('[id*="onetrust-accept"]', { timeout: 2000 });
          await page.click('[id*="onetrust-accept"]');
          await DELAY_MS(500, 1000);
        } catch { /* no banner */ }

        // Extract job cards from listing page
        const pageJobs = await page.evaluate(() => {
          const cards = document.querySelectorAll('[data-jk], .job_seen_beacon, .jobsearch-SerpJobCard');
          const results: Array<{
            title: string;
            company: string;
            location: string;
            salary: string | null;
            url: string;
          }> = [];

          cards.forEach(card => {
            const titleEl = card.querySelector('[data-testid="jobTitle"] a, .jobTitle a, h2.jobTitle a');
            const companyEl = card.querySelector('[data-testid="company-name"], .companyName, .company');
            const locationEl = card.querySelector('[data-testid="text-location"], .companyLocation');
            const salaryEl = card.querySelector('[data-testid="attribute_snippet_testid"], .salary-snippet');

            const title = titleEl?.textContent?.trim() || '';
            const company = companyEl?.textContent?.trim() || '';
            const location = locationEl?.textContent?.trim() || '';
            const salary = salaryEl?.textContent?.trim() || null;

            const href = (titleEl as HTMLAnchorElement)?.href || '';
            const url = href.startsWith('http') ? href : `https://fr.indeed.com${href}`;

            if (title && company && href) {
              results.push({ title, company, location, salary, url });
            }
          });

          return results;
        });

        console.log(`  → Found ${pageJobs.length} jobs on page ${pageNum + 1}`);

        // Fetch description for each unique job
        for (const job of pageJobs) {
          if (seenUrls.has(job.url)) continue;
          seenUrls.add(job.url);

          await DELAY_MS(600, 1200);
          const description = await getJobDescription(page, job.url);

          jobs.push({
            ...job,
            description,
            scrapedAt: new Date().toISOString(),
          });

          console.log(`  ✓ ${job.title} @ ${job.company}`);
        }

        // Check if there's a next page
        const hasNext = await page.evaluate(() =>
          !!document.querySelector('[data-testid="pagination-page-next"], a[aria-label="Next Page"]')
        );
        if (!hasNext) break;

      } catch (err: any) {
        console.error(`❌ Error on page ${pageNum + 1}:`, err.message);
        continue;
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  console.log(`✅ Scraped ${jobs.length} unique jobs`);
  return jobs;
}
