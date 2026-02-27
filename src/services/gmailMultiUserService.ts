/**
 * Service Gmail Multi-Utilisateur
 * Chaque user a son propre compte Gmail connecté
 */

import { google } from 'googleapis';
import { supabase } from '../config/supabase';
import { gmailWatchService } from './gmailWatchService';
import { addApplication } from '../controllers/applicationController';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send'
];

interface GmailToken {
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  gmail_email: string;
}

const POLLING_INTERVAL = 30000; // 30 secondes

function allowLocalhostRedirect(): boolean {
  const env = process.env.NODE_ENV;
  return env === 'development' || env === 'test';
}

function assertRedirectUriAllowed(redirectUri: string): void {
  if (!allowLocalhostRedirect() && /localhost|127\.0\.0\.1/.test(redirectUri)) {
    const env = process.env.NODE_ENV ?? 'undefined';
    throw new Error(`GMAIL_REDIRECT_URI points to localhost (NODE_ENV=${env})`);
  }
}

export class GmailMultiUserService {
  private oauth2Clients: Map<string, any> = new Map(); // userId -> OAuth2Client
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map(); // userId -> interval
  private processedMessageIds: Map<string, Set<string>> = new Map(); // userId -> Set de messageIds déjà traités
  private hasLoggedRedirectUri = false;

  constructor() {
    if (process.env.NODE_ENV === 'test') return;
    const redirectUri = process.env.GMAIL_REDIRECT_URI;
    if (redirectUri) {
    } else {
      console.warn('[gmail] GMAIL_REDIRECT_URI is not set');
    }
  }

  /**
   * Génère l'URL d'authentification OAuth pour un utilisateur
   */
  private getRedirectUri(): string {
    const redirectUri = process.env.GMAIL_REDIRECT_URI;
    if (!redirectUri) {
      throw new Error('GMAIL_REDIRECT_URI is not set');
    }
    assertRedirectUriAllowed(redirectUri);
    if (!this.hasLoggedRedirectUri && process.env.NODE_ENV !== 'test') {
      this.hasLoggedRedirectUri = true;
    }
    return redirectUri;
  }

  public getAuthUrl(userId: string, userEmail: string, redirectUriOverride?: string): string {
    const redirectUri = redirectUriOverride ?? this.getRedirectUri();
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: userId, // Passer le userId dans le state pour le callback
      login_hint: userEmail, // ✅ Pré-remplir avec l'email d'inscription
      prompt: 'consent' // Force l'affichage de l'écran de consentement
    });

    return authUrl;
  }

  /**
   * Échange le code OAuth contre des tokens et les stocke
   */
  public async handleOAuthCallback(code: string, userId: string, redirectUriOverride?: string): Promise<void> {
    const redirectUri = redirectUriOverride ?? this.getRedirectUri();
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      redirectUri
    );

    // Échanger le code contre des tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to obtain Gmail tokens');
    }

    // Récupérer l'email Gmail de l'utilisateur
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const gmailEmail = profile.data.emailAddress!;

    // ✅ VALIDATION : Vérifier que le Gmail correspond à l'email d'inscription
    const { data: user } = await supabase.auth.admin.getUserById(userId);
    const registrationEmail = user?.user?.email;

    if (registrationEmail && gmailEmail.toLowerCase() !== registrationEmail.toLowerCase()) {
      throw new Error(
        `Vous devez connecter le Gmail utilisé lors de votre inscription (${registrationEmail}), pas ${gmailEmail}`
      );
    }

    // Calculer l'expiration du token
    const expiryDate = new Date();
    if (tokens.expiry_date) {
      expiryDate.setTime(tokens.expiry_date);
    } else {
      expiryDate.setHours(expiryDate.getHours() + 1); // 1 heure par défaut
    }

    // Stocker les tokens dans Supabase (upsert = insert ou update)
    const { error } = await supabase
      .from('gmail_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: expiryDate.toISOString(),
        gmail_email: gmailEmail,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id' // ✅ Si user_id existe déjà, mettre à jour au lieu d'insérer
      });

    if (error) {
      throw new Error(`Failed to store Gmail tokens: ${error.message}`);
    }

  }

  /**
   * Récupère le client OAuth2 pour un utilisateur (avec refresh automatique)
   */
  private async getOAuth2ClientForUser(userId: string): Promise<any> {
    // Vérifier si on a déjà un client en cache
    if (this.oauth2Clients.has(userId)) {
      return this.oauth2Clients.get(userId);
    }

    // Récupérer les tokens depuis Supabase
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error(`Gmail not connected for user ${userId}`);
    }

    const tokenData = data as GmailToken;

    // Créer le client OAuth2
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: new Date(tokenData.token_expiry).getTime()
    });

    // Écouter les refresh automatiques et mettre à jour la DB
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        const newExpiry = new Date();
        newExpiry.setTime(tokens.expiry_date || Date.now() + 3600000);

        await supabase
          .from('gmail_tokens')
          .update({
            access_token: tokens.access_token,
            token_expiry: newExpiry.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

      }
    });

    // Mettre en cache
    this.oauth2Clients.set(userId, oauth2Client);

    return oauth2Client;
  }

  /**
   * Démarre le suivi des emails à partir de maintenant
   * Seuls les emails envoyés APRÈS cet instant seront détectés
   * Lance automatiquement le polling toutes les 30 secondes
   */
  public async startTracking(userId: string): Promise<string> {
    const startedAt = new Date().toISOString();

    const { error } = await supabase
      .from('gmail_tokens')
      .update({ tracking_started_at: startedAt })
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to start tracking: ${error.message}`);
    }

    // Lancer le polling automatique
    this.startPollingForUser(userId);

    return startedAt;
  }

  /**
   * Arrête le suivi des emails et le polling
   */
  public async stopTracking(userId: string): Promise<void> {
    const { error } = await supabase
      .from('gmail_tokens')
      .update({ tracking_started_at: null })
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to stop tracking: ${error.message}`);
    }

    // Arrêter le polling
    this.stopPollingForUser(userId);

    // Supprimer du cache
    this.oauth2Clients.delete(userId);
  }

  /**
   * Lance le polling automatique pour un utilisateur
   */
  private startPollingForUser(userId: string): void {
    // Éviter les doublons
    if (this.pollingIntervals.has(userId)) {
      return;
    }

    // Initialiser le set de messages traités
    if (!this.processedMessageIds.has(userId)) {
      this.processedMessageIds.set(userId, new Set());
    }


    const interval = setInterval(async () => {
      try {
        await this.checkEmailsForUser(userId);
      } catch (error: any) {
        console.error(`❌ Polling error for user ${userId}:`, error.message);
        // Arrêter si erreur d'auth
        if (error.message.includes('invalid_grant') || error.message.includes('Token')) {
          this.stopPollingForUser(userId);
        }
      }
    }, POLLING_INTERVAL);

    this.pollingIntervals.set(userId, interval);
  }

  /**
   * Arrête le polling pour un utilisateur
   */
  private stopPollingForUser(userId: string): void {
    const interval = this.pollingIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(userId);
      this.processedMessageIds.delete(userId);
    }
  }

  /**
   * Au démarrage du serveur, reprend le polling pour les utilisateurs
   * qui avaient le tracking actif
   */
  public async resumeActiveTracking(): Promise<void> {
    try {
      const { data: activeUsers } = await supabase
        .from('gmail_tokens')
        .select('user_id')
        .not('tracking_started_at', 'is', null);

      if (!activeUsers || activeUsers.length === 0) {
        return;
      }

      for (const row of activeUsers) {
        this.startPollingForUser(row.user_id);
      }

    } catch (error: any) {
      console.error('❌ Error resuming active tracking:', error.message);
    }
  }

  /**
   * Récupère le statut du suivi
   */
  public async getTrackingStatus(userId: string): Promise<{ tracking: boolean; started_at: string | null }> {
    const { data } = await supabase
      .from('gmail_tokens')
      .select('tracking_started_at')
      .eq('user_id', userId)
      .single();

    return {
      tracking: !!data?.tracking_started_at,
      started_at: data?.tracking_started_at || null
    };
  }

  /**
   * Vérifie les nouveaux emails pour un utilisateur spécifique
   * Filtre par tracking_started_at pour ne détecter que les emails récents
   */
  public async checkEmailsForUser(userId: string): Promise<void> {
    try {
      const oauth2Client = await this.getOAuth2ClientForUser(userId);
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Récupérer le timestamp de début de tracking
      const { data: tokenData } = await supabase
        .from('gmail_tokens')
        .select('tracking_started_at')
        .eq('user_id', userId)
        .single();

      const trackingStartedAt = tokenData?.tracking_started_at;

      // Construire le filtre Gmail API
      // Si tracking activé, ne prendre que les emails APRÈS le timestamp
      const epochSeconds = trackingStartedAt
        ? Math.floor(new Date(trackingStartedAt).getTime() / 1000)
        : null;
      const afterQuery = epochSeconds ? `after:${epochSeconds}` : '';

      // 1) Emails envoyés (format manuel "Candidature ...")
      const sentParams: any = {
        userId: 'me',
        labelIds: ['SENT'],
        maxResults: 10
      };
      if (afterQuery) {
        sentParams.q = afterQuery;
      }

      // 2) Emails entrants Indeed (confirmation de candidature Indeed Apply)
      const indeedParams: any = {
        userId: 'me',
        labelIds: ['INBOX'],
        maxResults: 10,
        q: `from:indeedapply@indeed.com subject:"Candidatures via Indeed" ${afterQuery}`.trim()
      };

      const [sentResponse, indeedResponse] = await Promise.all([
        gmail.users.messages.list(sentParams),
        gmail.users.messages.list(indeedParams)
      ]);

      const messageMap = new Map<string, any>();
      (sentResponse.data.messages || []).forEach(msg => {
        if (msg?.id) messageMap.set(msg.id, msg);
      });
      (indeedResponse.data.messages || []).forEach(msg => {
        if (msg?.id) messageMap.set(msg.id, msg);
      });

      const messages = Array.from(messageMap.values());


      // Récupérer les candidatures existantes pour déduplication
      const { data: existingApps } = await supabase
        .from('applications')
        .select('email, poste, company')
        .eq('user_id', userId);

      const existingKeys = new Set(
        (existingApps || []).map(a =>
          `${(a.email || '').toLowerCase()}|${(a.poste || '').toLowerCase()}|${(a.company || '').toLowerCase()}`
        )
      );

      let addedCount = 0;

      // Traiter chaque email
      for (const message of messages) {
        if (!message.id) continue;

        // Récupérer le message complet
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        // Analyser si c'est une candidature
        const emailData = this.parseJobApplicationEmail(fullMessage.data);

        if (emailData) {
          // Vérifier la déduplication
          const key = `${(emailData.email || '').toLowerCase()}|${(emailData.poste || '').toLowerCase()}|${(emailData.company || '').toLowerCase()}`;

          if (existingKeys.has(key)) {
            continue;
          }


          // Ajouter à la base de données avec le user_id
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { company_website: _cw, ...insertData } = emailData;
          await supabase
            .from('applications')
            .insert({
              ...insertData,
              user_id: userId
            });

          existingKeys.add(key);
          addedCount++;
        }
      }

    } catch (error: any) {
      console.error(`❌ Error checking emails for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Analyse un email pour détecter une candidature
   * Format d'objet requis:
   * - "Candidature [Poste] - [Entreprise]"
   * - "Suite à ma candidature - [Poste]"
   */
  private parseJobApplicationEmail(message: any): any | null {
    try {
      const headers = message.payload?.headers || [];
      const subject = this.getHeaderValue(headers, 'Subject');
      const to = this.getHeaderValue(headers, 'To');
      const from = this.getHeaderValue(headers, 'From');
      const dateHeader = this.getHeaderValue(headers, 'Date');
      const bodyText = this.extractBodyText(message.payload);
      const bodyHtml = this.extractRawBodyHtml(message.payload);
      const messageDate = this.formatMessageDate(dateHeader);

      // ✅ Indeed: détecter les confirmations de candidature entrantes
      const indeedData = this.parseIndeedApplication({
        subject,
        from,
        bodyText,
        bodyHtml,
        date: messageDate
      });
      if (indeedData) {
        return indeedData;
      }

      // ✅ Patterns candidature (envoyée par l'utilisateur)
      const posteCompanyResult = this.extractPosteAndCompany(subject, to);
      if (posteCompanyResult) {
        return {
          company: posteCompanyResult.company,
          poste: posteCompanyResult.poste,
          status: posteCompanyResult.isRelance ? 'Relance envoyée' : 'Candidature envoyée',
          date: messageDate,
          relanced: posteCompanyResult.isRelance,
          email: to,
          user_email: null,
          relance_count: posteCompanyResult.isRelance ? 1 : 0
        };
      }

      // ❌ Format non reconnu
      return null;
    } catch (error) {
      console.error('Error parsing email:', error);
      return null;
    }
  }

  /**
   * Extrait poste et entreprise depuis un objet email avec des patterns flexibles.
   * Retourne null si l'email ne ressemble pas à une candidature.
   */
  private extractPosteAndCompany(
    subject: string,
    to: string
  ): { poste: string; company: string; isRelance: boolean } | null {
    const s = subject.trim();

    // ── Mots-clés relance ──────────────────────────────────────────────
    const RELANCE_KW = /\b(relance|follow[\s-]?up|suite\s+[àa]\s+(?:ma\s+)?candidature|rappel)\b/i;
    const isRelance = RELANCE_KW.test(s);

    // ── Mots-clés candidature ──────────────────────────────────────────
    const CAND_KW = /\b(candidature|postulation|postuler|candidat|application|apply|applied|postulé|offre)\b/i;
    if (!CAND_KW.test(s) && !isRelance) return null;

    // Helper : extraire la company depuis l'adresse email destinataire
    const companyFromEmail = (): string => {
      const m = to.match(/@([^.>]+)/);
      if (!m?.[1]) return 'Entreprise';
      return m[1].charAt(0).toUpperCase() + m[1].slice(1);
    };

    // ── Séparateur central ─────────────────────────────────────────────
    // On cherche le « - » ou « : » qui sépare poste et entreprise
    // Patterns ordered from most specific to most generic

    const patterns: Array<RegExp> = [
      // "Candidature pour le poste de X chez Y"
      /(?:candidature|postulation|application)\s+(?:pour\s+)?(?:le\s+poste\s+de\s+|au\s+poste\s+de\s+)?(.+?)\s+(?:chez|@|at)\s+(.+)/i,
      // "Candidature X - Y" or "Candidature : X - Y"
      /(?:candidature|postulation|application)\s*[:\-–—]?\s*(.+?)\s*[-–—]\s*(.+)/i,
      // "X - Y - candidature" (poste en premier, company en deuxième)
      /^(.+?)\s*[-–—]\s*(.+?)\s*[-–—]\s*(?:candidature|postulation)/i,
      // Relance "Suite à ma candidature - Poste / Relance Poste - Company"
      /(?:relance|suite\s+[àa]\s+(?:ma\s+)?candidature)\s*[-–—:]\s*(.+?)\s*(?:[-–—]\s*(.+))?$/i,
      // Fallback: "Poste - Company" dans un email avec mot-clé candidature
      /^(.+?)\s*[-–—]\s*(.+)$/i,
    ];

    for (const pattern of patterns) {
      const m = s.match(pattern);
      if (!m) continue;

      let poste = (m[1] ?? '').trim();
      let company = (m[2] ?? '').trim();

      // Nettoyer les artefacts résiduels du mot-clé au début du poste
      poste = poste.replace(/^(?:candidature|postulation|application|relance|pour|le\s+poste\s+de|au\s+poste\s+de)\s*/i, '').trim();
      company = company.replace(/^(?:chez|at|@)\s*/i, '').trim();

      // Si l'extraction donne un poste vide ou trop long, ignorer
      if (!poste || poste.length > 100) continue;
      if (!company) company = companyFromEmail();

      return { poste, company, isRelance };
    }

    return null;
  }

  private getHeaderValue(headers: any[], name: string): string {
    const header = headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
    return header?.value || '';
  }

  private formatMessageDate(dateHeader: string): string {
    const parsed = dateHeader ? new Date(dateHeader) : new Date();
    if (Number.isNaN(parsed.getTime())) {
      return new Date().toISOString().split('T')[0] ?? '';
    }
    return parsed.toISOString().split('T')[0] ?? '';
  }

  private decodeBase64Url(data?: string): string {
    if (!data) return '';
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(normalized + padding, 'base64').toString('utf8');
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/\r/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private extractBodyText(payload: any): string {
    if (!payload) return '';

    const getPartText = (part: any, mime: string): string | null => {
      if (!part) return null;
      if (part.mimeType === mime && part.body?.data) {
        return this.decodeBase64Url(part.body.data);
      }
      if (part.parts && Array.isArray(part.parts)) {
        for (const child of part.parts) {
          const found = getPartText(child, mime);
          if (found) return found;
        }
      }
      return null;
    };

    const plain = getPartText(payload, 'text/plain');
    if (plain) return plain;

    const html = getPartText(payload, 'text/html');
    if (html) return this.stripHtml(html);

    if (payload.body?.data) {
      return this.decodeBase64Url(payload.body.data);
    }

    return '';
  }

  private extractUrls(text: string): string[] {
    if (!text) return [];
    const matches = text.match(/https?:\/\/[^\s<>"')]+/gi) || [];
    return matches.map(url => url.replace(/[),.]+$/g, '')).filter(Boolean);
  }

  private extractRawBodyHtml(payload: any): string {
    const getPartHtml = (part: any): string | null => {
      if (!part) return null;
      if (part.mimeType === 'text/html' && part.body?.data) {
        return this.decodeBase64Url(part.body.data);
      }
      if (part.parts && Array.isArray(part.parts)) {
        for (const child of part.parts) {
          const found = getPartHtml(child);
          if (found) return found;
        }
      }
      return null;
    };
    return getPartHtml(payload) ?? '';
  }

  private parseIndeedApplication(input: {
    subject: string;
    from: string;
    bodyText: string;
    bodyHtml: string;
    date: string;
  }): any | null {
    const { subject, from, bodyText, bodyHtml, date } = input;
    const fromLower = (from || '').toLowerCase();

    // Doit venir d'Indeed
    const isIndeed = fromLower.includes('indeed');
    if (!isIndeed) return null;

    const text = bodyText || '';

    // ─────────────────────────────────────────────────────────────────
    // Pattern principal : "Candidatures via Indeed : [poste]"
    // Expéditeur       : indeedapply@indeed.com
    // Company extraite : "envoyés à Veepee. Bonne chance !"
    // ─────────────────────────────────────────────────────────────────
    const indeedApplyPattern = /^Candidatures?\s+via\s+Indeed\s*:\s*(.+)$/i;
    const indeedApplyMatch = subject.match(indeedApplyPattern);

    if (indeedApplyMatch) {
      const poste = (indeedApplyMatch[1] ?? '').trim();
      let company = '';

      // Stratégie 1 (la plus fiable) : slug dans l'URL HTML
      // <a href="https://fr.indeed.com/cmp/veepee?...">
      const slugMatch = bodyHtml.match(/indeed\.com\/cmp\/([a-z0-9][a-z0-9\-]*)/i);
      if (slugMatch?.[1]) {
        company = slugMatch[1]
          .split('-')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }

      // Stratégie 2 : "envoyés à Veepee. Bonne chance !"
      if (!company) {
        const s2 = text.match(/envoy[ée]s?\s+[àa]\s+([^\.!\n\r]+)/i);
        if (s2?.[1]) company = s2[1].trim();
      }

      // Stratégie 3 : ligne après le titre du poste dans le body texte
      // Format: "Veepee - Saint-Denis"
      if (!company && poste) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
        const titleIdx = lines.findIndex(l => l.includes(poste.slice(0, 15)));
        if (titleIdx >= 0) {
          for (let i = titleIdx + 1; i < Math.min(titleIdx + 4, lines.length); i++) {
            const candidate = (lines[i] ?? '').split(/\s*[-–—]\s*/)[0]?.trim() ?? '';
            if (
              candidate.length > 1 && candidate.length < 60 &&
              !/^\d/.test(candidate) &&
              !/avis|candidature|cv|bonjour|éléments|envoy/i.test(candidate)
            ) {
              company = candidate;
              break;
            }
          }
        }
      }

      return {
        company: company || 'Indeed',
        poste,
        status: 'Candidature envoyée',
        date,
        relanced: false,
        email: null,
        user_email: null,
        relance_count: 0,
        company_website: this.pickWebsite(text)
      };
    }

    // ─────────────────────────────────────────────────────────────────
    // Patterns génériques pour d'autres formats Indeed
    // ─────────────────────────────────────────────────────────────────
    const combinedText = `${subject}\n${text}`;
    const hasApplicationKeyword = /(candidature|application|postul|applied|apply|appliqué|applique)/i.test(combinedText);
    if (!hasApplicationKeyword) return null;

    let poste = '';
    let company = '';

    const subjectPatterns: Array<{ regex: RegExp; swap?: boolean }> = [
      { regex: /(candidature|application)\s*(?:pour|to|for)\s*(?:le\s*poste\s*de\s*)?(.+?)\s*(?:chez|at)\s*(.+)/i },
      { regex: /(applied|postulé|postule)\s*(?:to|pour|for)\s*(?:the\s*role\s*of\s*)?(.+?)\s*(?:chez|at)\s*(.+)/i },
      { regex: /(?:chez|at)\s*(.+?)\s*(?:pour|for)\s*(?:le\s*poste\s*de\s*)?(.+)/i, swap: true }
    ];

    for (const pattern of subjectPatterns) {
      const match = subject.match(pattern.regex);
      if (match) {
        if (pattern.swap) {
          company = (match[1] || '').trim();
          poste = (match[2] || '').trim();
        } else {
          poste = (match[2] || '').trim();
          company = (match[3] || '').trim();
        }
        break;
      }
    }

    if (!poste || !company) {
      const posteMatch = text.match(/(?:poste|intitul[ée]\s*du\s*poste|job\s*title|position)\s*[:\-]\s*(.+)/i);
      const companyMatch = text.match(/(?:entreprise|soci[ée]t[ée]|company)\s*[:\-]\s*(.+)/i);
      if (!poste && posteMatch) poste = (posteMatch[1] ?? '').trim();
      if (!company && companyMatch) company = (companyMatch[1] ?? '').trim();
    }

    if (!poste || !company) {
      const fallback = combinedText.match(/(?:pour|to|for)\s+(.+?)\s+(?:chez|at)\s+([^\n\r]+)/i);
      if (fallback) {
        poste = poste || (fallback[1] ?? '').trim();
        company = company || (fallback[2] ?? '').trim();
      }
    }

    if (!poste || !company) return null;

    return {
      company,
      poste,
      status: 'Candidature envoyée',
      date,
      relanced: false,
      email: null,
      user_email: null,
      relance_count: 0,
      company_website: this.pickWebsite(text)
    };
  }

  private pickWebsite(text: string): string | null {
    if (!text) return null;
    const labeled = text.match(/(?:site\s*web|website)\s*[:\-]\s*(https?:\/\/[^\s<>"')]+)/i);
    if (labeled && labeled[1]) {
      return labeled[1].trim();
    }

    const urls = this.extractUrls(text);
    if (urls.length === 0) return null;

    const nonIndeed = urls.find(url => !/indeed\./i.test(url));
    return (nonIndeed || urls[0] || '').trim() || null;
  }

  /**
   * Envoie un email via Gmail API
   */
  public async sendEmail(
    userId: string,
    to: string,
    subject: string,
    body: string
  ): Promise<{ success: boolean; messageId: string }> {
    const oauth2Client = await this.getOAuth2ClientForUser(userId);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const gmailEmail = await this.getGmailEmail(userId);
    if (!gmailEmail) {
      throw new Error('Gmail non connecté');
    }

    // Construire le message RFC 2822
    const rawMessage = [
      `From: ${gmailEmail}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(body).toString('base64'),
    ].join('\r\n');

    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    return { success: true, messageId: result.data.id! };
  }

  /**
   * Déconnecte Gmail pour un utilisateur
   */
  public async disconnectGmail(userId: string): Promise<void> {
    // Arrêter le polling d'abord
    this.stopPollingForUser(userId);

    // Supprimer de la DB
    const { error } = await supabase
      .from('gmail_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to disconnect Gmail: ${error.message}`);
    }

    // Supprimer du cache
    this.oauth2Clients.delete(userId);

  }

  /**
   * Vérifie si un utilisateur a Gmail connecté
   */
  public async isGmailConnected(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('id')
      .eq('user_id', userId)
      .single();

    return !!data && !error;
  }

  /**
   * Récupère l'email Gmail d'un utilisateur
   */
  public async getGmailEmail(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from('gmail_tokens')
      .select('gmail_email')
      .eq('user_id', userId)
      .single();

    return data?.gmail_email || null;
  }
}

// Export singleton
export const gmailMultiUserService = new GmailMultiUserService();
