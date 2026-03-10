import OpenAI from 'openai';

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

export interface JobAnalysis {
  match_score: number;
  skills_required: string[];
  skills_missing: string[];
  job_type: string;
  seniority: string;
  why_apply: string;
}

export async function analyzeJob(
  jobDescription: string,
  userProfile: string,
  jobTitle: string,
  company: string
): Promise<JobAnalysis> {
  const prompt = `Tu es un recruteur senior expert en matching CV/offre. Tu dois évaluer avec précision les chances réelles d'un candidat d'être sélectionné pour un entretien.

━━━ OFFRE ━━━
Poste : ${jobTitle}
Entreprise : ${company}

${jobDescription.substring(0, 3000)}

━━━ CV / PROFIL CANDIDAT ━━━
${userProfile.substring(0, 2500)}

━━━ MÉTHODE DE SCORING ━━━

Calcule le match_score (0–100) en évaluant ces 4 axes :

1. COMPÉTENCES TECHNIQUES (40 pts)
   - Compte les compétences clés de l'offre présentes dans le CV
   - Une compétence exacte = plein points, une compétence proche = demi-points
   - Ex: l'offre demande 5 techs, le CV en a 4 → 32/40

2. EXPÉRIENCE & SÉNIORITÉ (25 pts)
   - Le niveau demandé (junior/confirmé/senior) correspond-il au profil ?
   - Les années d'expérience sont-elles cohérentes ?

3. DOMAINE & CONTEXTE (20 pts)
   - Le type de projets/secteur du CV correspond-il au contexte de l'offre ?
   - Ex : expérience e-commerce pour un poste e-commerce = fort bonus

4. PROFIL GLOBAL (15 pts)
   - Formation, soft skills mentionnés, langues, disponibilité si précisée

RÈGLES IMPORTANTES :
- Un score 85–100 = profil quasi-parfait, appeler en entretien immédiatement
- Un score 70–84 = bon profil, lacunes mineures compensables
- Un score 50–69 = profil partiel, effort de candidature justifié
- Un score <50 = trop de lacunes majeures, candidature risquée
- Sois honnête et précis : un CV junior face à un poste senior = score bas
- Ne gonfle pas les scores : préfère un score juste à un score optimiste

Retourne UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "match_score": <entier 0-100>,
  "skills_required": [<compétences clés de l'offre présentes dans le CV, max 6>],
  "skills_missing": [<compétences importantes de l'offre absentes du CV, max 4>],
  "job_type": "<CDI|CDD|Stage|Alternance|Freelance|Inconnu>",
  "seniority": "<Junior|Confirmé|Senior|Lead|Inconnu>",
  "why_apply": "<1-2 phrases concrètes : pourquoi ce profil matche + le point fort principal>"
}`;

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 512,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.choices[0]?.message?.content || '';

  try {
    return JSON.parse(text) as JobAnalysis;
  } catch {
    return {
      match_score: 0,
      skills_required: [],
      skills_missing: [],
      job_type: 'Inconnu',
      seniority: 'Inconnu',
      why_apply: 'Analyse indisponible',
    };
  }
}
