import 'dotenv/config';
import { scrapeIndeed } from '../services/indeedScraper';
import { analyzeJob } from '../services/jobAnalysisService';
import { generateCoverLetter } from '../services/coverLetterService';

const USER_PROFILE = `
Développeur Full Stack, 2 ans d'expérience.
Compétences: TypeScript, React, Node.js, Express, PostgreSQL, Supabase, REST API.
Formation: BUT Informatique.
Recherche: CDI ou alternance en développement web.
`;

async function test() {
  console.log('\n=== TEST JOB AGENT PIPELINE ===\n');

  // ── 1. Scrape ──────────────────────────────
  console.log('ÉTAPE 1: Scraping Indeed...');
  let jobs;
  try {
    jobs = await scrapeIndeed('développeur javascript', 'Paris', 1);
    console.log(`✅ ${jobs.length} offres trouvées\n`);
  } catch (err: any) {
    console.error('❌ Scraping échoué:', err.message);
    return;
  }

  if (jobs.length === 0) {
    console.warn('⚠️  Aucune offre scrappée (Indeed bloque peut-être). Test annulé.');
    return;
  }

  // Affiche les 3 premières
  console.log('Aperçu des offres:');
  jobs.slice(0, 3).forEach((j, i) => {
    console.log(`  ${i + 1}. ${j.title} @ ${j.company} — ${j.location}`);
    console.log(`     ${j.url}`);
  });

  // ── 2. Analyse IA ──────────────────────────
  const firstJob = jobs[0];
  if (!firstJob) return;

  console.log(`\nÉTAPE 2: Analyse IA pour "${firstJob.title} @ ${firstJob.company}"...`);
  if (!firstJob.description) {
    console.warn('⚠️  Pas de description pour cette offre, skip analyse');
  } else {
    try {
      const analysis = await analyzeJob(
        firstJob.description,
        USER_PROFILE,
        firstJob.title,
        firstJob.company
      );
      console.log('✅ Analyse:');
      console.log(`   Score:            ${analysis.match_score}/100`);
      console.log(`   Type:             ${analysis.job_type}`);
      console.log(`   Séniorité:        ${analysis.seniority}`);
      console.log(`   Skills requis:    ${analysis.skills_required.join(', ')}`);
      console.log(`   Skills manquants: ${analysis.skills_missing.join(', ')}`);
      console.log(`   Pourquoi postuler: ${analysis.why_apply}`);

      // ── 3. Lettre de motivation ─────────────
      if (analysis.match_score >= 60) {
        console.log('\nÉTAPE 3: Génération lettre de motivation...');
        try {
          const letter = await generateCoverLetter(
            firstJob.title,
            firstJob.company,
            firstJob.description,
            USER_PROFILE,
            'Alex Dupont'
          );
          console.log('✅ Lettre générée:\n');
          console.log('─'.repeat(60));
          console.log(letter);
          console.log('─'.repeat(60));
        } catch (err: any) {
          console.error('❌ Génération lettre échouée:', err.message);
        }
      } else {
        console.log(`\n⏭  Score ${analysis.match_score} < 60 — lettre non générée`);
      }

    } catch (err: any) {
      console.error('❌ Analyse IA échouée:', err.message);
    }
  }

  console.log('\n=== TEST TERMINÉ ===\n');
}

test().catch(console.error);
