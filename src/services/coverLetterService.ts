import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateCoverLetter(
  jobTitle: string,
  company: string,
  jobDescription: string,
  userProfile: string,
  userName: string = ''
): Promise<string> {
  const prompt = `Tu es un recruteur senior et rédacteur expert en lettres de motivation tech/web. Tu sais exactement ce qui retient l'attention d'un recruteur en 30 secondes.

Ta mission : rédiger UNE lettre de motivation percutante, authentique et 100% personnalisée.

━━━ OFFRE D'EMPLOI ━━━
Poste : ${jobTitle}
Entreprise : ${company}

${jobDescription.substring(0, 4000)}

━━━ CV DU CANDIDAT ━━━
${userProfile.substring(0, 4000)}

━━━ MÉTHODE DE RÉDACTION ━━━

ÉTAPE 1 — Analyse l'offre
Identifie : les 3-4 compétences techniques prioritaires, la mission principale, le type d'équipe/culture, les mots-clés récurrents.

ÉTAPE 2 — Croise avec le CV
Pour chaque compétence clé de l'offre, trouve la preuve concrète dans le CV (projet, technologie maîtrisée, expérience). Ne retiens que ce qui est RÉEL et VÉRIFIABLE.

ÉTAPE 3 — Rédige la lettre avec cette structure :
• Accroche (1 phrase) : montre que tu connais l'entreprise/le poste, pas une formule générique
• Paragraphe 1 — Qui tu es : 2-3 phrases, profil + ce que tu apportes concrètement
• Paragraphe 2 — Pourquoi ce poste : lien direct entre tes compétences réelles et les besoins de l'offre, cite des technologies/projets spécifiques du CV
• Paragraphe 3 — Conclusion CTA : disponibilité, entretien, formule de politesse concise
• Signature : ${userName ? userName : 'Le candidat'}

━━━ RÈGLES ABSOLUES ━━━
✓ 220-260 mots maximum
✓ Ton : professionnel mais humain, pas robotique
✓ Chaque phrase apporte de la valeur, pas de remplissage
✗ Zéro formule vide : "passionné", "motivé", "dynamique", "challenges", "m'épanouir"
✗ Zéro invention : n'ajoute aucune compétence ou expérience absente du CV
✗ Pas de Markdown, pas de titre, pas d'encadrement — texte brut uniquement

Retourne UNIQUEMENT la lettre rédigée.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.choices[0]?.message?.content ?? '';
}

export async function adaptCV(
  baseCV: string,
  jobTitle: string,
  jobDescription: string
): Promise<string> {
  const prompt = `Tu es un expert ATS (Applicant Tracking System) et recruteur tech.

Adapte ce CV pour maximiser sa compatibilité ATS avec cette offre d'emploi.

OFFRE: ${jobTitle}
DESCRIPTION (extrait):
${jobDescription.substring(0, 2000)}

CV ORIGINAL:
${baseCV.substring(0, 3000)}

RÈGLES:
- Conserver toutes les expériences réelles, ne rien inventer
- Réordonner les compétences pour matcher les mots-clés de l'offre
- Reformuler les bullets pour intégrer naturellement les termes de l'offre
- Format texte propre, structuré
- Maximum 400 mots

Retourne UNIQUEMENT le CV adapté, sans commentaire.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.choices[0]?.message?.content ?? '';
}
