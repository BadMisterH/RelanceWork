import { supabase } from '../config/supabase';
import { scrapeIndeed, ScrapedJob } from './indeedScraper';
import { scrapeJSearch } from './jSearchScraper';
import { analyzeJob } from './jobAnalysisService';
import { generateCoverLetter } from './coverLetterService';

export interface PipelineOptions {
  keyword: string;
  location?: string;
  maxPages?: number;
  scoreThreshold?: number;  // only keep jobs above this score (default: 70)
  userProfile: string;      // user's CV / skills summary
  userName?: string;
  generateLetters?: boolean;
  source?: 'indeed' | 'jsearch'; // scraping source (default: indeed)
}

export interface PipelineResult {
  scraped: number;
  analyzed: number;
  saved: number;
  skipped: number;          // below threshold
  errors: number;
}

export async function runJobAgentPipeline(
  userId: string,
  options: PipelineOptions
): Promise<PipelineResult> {
  const {
    keyword,
    location = 'France',
    maxPages = 3,
    scoreThreshold = 70,
    userProfile,
    userName = '',
    generateLetters = false,
    source = 'indeed',
  } = options;

  const result: PipelineResult = { scraped: 0, analyzed: 0, saved: 0, skipped: 0, errors: 0 };

  // ── 1. Scrape jobs ────────────────────────────────────────────────
  console.log(`🔍 Starting pipeline [${source}]: "${keyword}" in ${location}`);
  let jobs: ScrapedJob[] = [];
  try {
    if (source === 'jsearch') {
      jobs = await scrapeJSearch(keyword, location, maxPages);
    } else {
      jobs = await scrapeIndeed(keyword, location, maxPages);
    }
    result.scraped = jobs.length;
  } catch (err: any) {
    console.error('❌ Scraping failed:', err.message);
    throw new Error(`Scraping échoué: ${err.message}`);
  }

  if (jobs.length === 0) {
    console.warn('⚠️ No jobs found');
    return result;
  }

  // ── 2. Dedup against existing prospects ──────────────────────────
  const { data: existingProspects } = await supabase
    .from('job_prospects')
    .select('source_url')
    .eq('user_id', userId);

  const existingUrls = new Set((existingProspects || []).map((p: any) => p.source_url));
  const newJobs = jobs.filter(j => !existingUrls.has(j.url));
  console.log(`🔁 ${jobs.length - newJobs.length} duplicates skipped, ${newJobs.length} new jobs`);

  // ── 3. Analyze + save each job ───────────────────────────────────
  for (const job of newJobs) {
    try {
      if (!job.description) {
        result.skipped++;
        continue;
      }

      console.log(`🤖 Analyzing: ${job.title} @ ${job.company}`);
      const analysis = await analyzeJob(job.description, userProfile, job.title, job.company);
      result.analyzed++;

      if (analysis.match_score < scoreThreshold) {
        console.log(`  ↩ Score ${analysis.match_score} < ${scoreThreshold} — skipping`);
        result.skipped++;
        continue;
      }

      console.log(`  ✅ Score ${analysis.match_score} — saving`);

      // ── 4. Generate cover letter if requested ──────────────────
      let coverLetter: string | null = null;
      if (generateLetters) {
        try {
          coverLetter = await generateCoverLetter(
            job.title, job.company, job.description, userProfile, userName
          );
        } catch {
          // Non-blocking: letter generation failure doesn't block saving
        }
      }

      // ── 5. Insert into Supabase ────────────────────────────────
      const { error } = await supabase.from('job_prospects').insert({
        user_id: userId,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        description: job.description,
        source_url: job.url,
        match_score: analysis.match_score,
        skills_required: analysis.skills_required,
        skills_missing: analysis.skills_missing,
        job_type: analysis.job_type,
        seniority: analysis.seniority,
        why_apply: analysis.why_apply,
        cover_letter: coverLetter,
        search_keyword: keyword,
        published_at: job.publishedAt || null,
        status: 'ready',
      });

      if (error) {
        console.error(`❌ Insert error:`, error.message);
        result.errors++;
      } else {
        result.saved++;
      }

      // Small delay to respect rate limits
      await new Promise(r => setTimeout(r, 300));

    } catch (err: any) {
      console.error(`❌ Error processing ${job.title}:`, err.message);
      result.errors++;
    }
  }

  console.log(`🏁 Pipeline done:`, result);
  return result;
}
