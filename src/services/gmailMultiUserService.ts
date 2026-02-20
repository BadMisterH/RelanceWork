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
      const listParams: any = {
        userId: 'me',
        labelIds: ['SENT'],
        maxResults: 10
      };

      if (trackingStartedAt) {
        const epochSeconds = Math.floor(new Date(trackingStartedAt).getTime() / 1000);
        listParams.q = `after:${epochSeconds}`;
      }

      const response = await gmail.users.messages.list(listParams);
      const messages = response.data.messages || [];


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
          await supabase
            .from('applications')
            .insert({
              ...emailData,
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
      const headers = message.payload.headers;
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const to = headers.find((h: any) => h.name === 'To')?.value || '';
      const date = headers.find((h: any) => h.name === 'Date')?.value || '';

      // ✅ Pattern 1: "Candidature [Poste] - [Entreprise]"
      const candidaturePattern = /^Candidature\s+(.+?)\s*-\s*(.+)$/i;
      const candidatureMatch = subject.match(candidaturePattern);

      if (candidatureMatch) {
        const poste = candidatureMatch[1].trim();
        const company = candidatureMatch[2].trim();

        return {
          company,
          poste,
          status: 'Candidature envoyée',
          date: new Date(date).toISOString().split('T')[0],
          relanced: false,
          email: to,
          user_email: null,
          relance_count: 0
        };
      }

      // ✅ Pattern 2: "Suite à ma candidature - [Poste]"
      const relancePattern = /^Suite à ma candidature\s*-\s*(.+)$/i;
      const relanceMatch = subject.match(relancePattern);

      if (relanceMatch) {
        const poste = relanceMatch[1].trim();

        // Extraire l'entreprise depuis le destinataire
        const emailMatch = to.match(/([^@]+)@([^.]+)/);
        const company = emailMatch ? emailMatch[2].charAt(0).toUpperCase() + emailMatch[2].slice(1) : 'Entreprise';

        return {
          company,
          poste,
          status: 'Relance envoyée',
          date: new Date(date).toISOString().split('T')[0],
          relanced: true,
          email: to,
          user_email: null,
          relance_count: 1
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
