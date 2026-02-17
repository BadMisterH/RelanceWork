import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { supabase } from '../config/supabase';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/pubsub'
];

const TOKEN_PATH = path.join(__dirname, '../../data/gmail-token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../../data/gmail-credentials.json');
const SERVICE_TOKEN_ID = 'service';

export interface GmailCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

export class GmailAuthService {
  private oauth2Client: any;
  private credentials: GmailCredentials | null = null;

  constructor() {
    this.loadCredentials();
    if (this.credentials) {
      this.oauth2Client = new google.auth.OAuth2(
        this.credentials.client_id,
        this.credentials.client_secret,
        this.credentials.redirect_uri
      );
      this.hydrateTokenFromStorage().catch((error) => {
        console.error('❌ Error loading Gmail token from storage:', error);
      });
    }
  }

  /**
   * Charge les credentials OAuth depuis le fichier
   */
  private loadCredentials(): void {
    try {
      const envClientId = process.env.GMAIL_CLIENT_ID;
      const envClientSecret = process.env.GMAIL_CLIENT_SECRET;
      const envRedirectUri = process.env.GMAIL_REDIRECT_URI;

      if (envClientId && envClientSecret && envRedirectUri) {
        if (
          process.env.NODE_ENV === 'production' &&
          /localhost|127\.0\.0\.1/.test(envRedirectUri)
        ) {
          throw new Error('GMAIL_REDIRECT_URI points to localhost in production');
        }
        this.credentials = {
          client_id: envClientId,
          client_secret: envClientSecret,
          redirect_uri: envRedirectUri
        };
        console.log('✅ Gmail credentials loaded from environment');
        return;
      }

      if (fs.existsSync(CREDENTIALS_PATH)) {
        const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
        const data = JSON.parse(content);

        // Support both formats: direct credentials or Google Cloud Console format
        if (data.installed) {
          this.credentials = {
            client_id: data.installed.client_id,
            client_secret: data.installed.client_secret,
            redirect_uri: data.installed.redirect_uris[0]
          };
        } else if (data.web) {
          this.credentials = {
            client_id: data.web.client_id,
            client_secret: data.web.client_secret,
            redirect_uri: data.web.redirect_uris[0]
          };
        } else {
          this.credentials = data;
        }

        console.log('✅ Gmail credentials loaded successfully');
      } else {
        console.log('⚠️  Gmail credentials file not found. Please run the setup first.');
      }
    } catch (error) {
      console.error('❌ Error loading Gmail credentials:', error);
    }
  }

  /**
   * Charge le token d'authentification depuis le fichier
   */
  private loadTokenFromFile(): void {
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        const token = fs.readFileSync(TOKEN_PATH, 'utf-8');
        this.oauth2Client.setCredentials(JSON.parse(token));
        console.log('✅ Gmail token loaded successfully');
      }
    } catch (error) {
      console.error('❌ Error loading Gmail token:', error);
    }
  }

  /**
   * Sauvegarde le token d'authentification
   */
  private saveTokenToFile(token: any): void {
    try {
      const dataDir = path.dirname(TOKEN_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
      console.log('✅ Gmail token saved successfully');
    } catch (error) {
      console.error('❌ Error saving Gmail token:', error);
    }
  }

  private async loadTokenFromSupabase(): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('gmail_service_tokens')
        .select('token_json')
        .eq('id', SERVICE_TOKEN_ID)
        .single();

      if (error || !data?.token_json) {
        return null;
      }

      console.log('✅ Gmail token loaded from Supabase');
      return data.token_json;
    } catch (error) {
      console.error('❌ Error loading Gmail token from Supabase:', error);
      return null;
    }
  }

  private async saveTokenToSupabase(token: any): Promise<void> {
    try {
      const payload = {
        id: SERVICE_TOKEN_ID,
        token_json: token,
        token_expiry: token?.expiry_date ? new Date(token.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('gmail_service_tokens')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        throw error;
      }

      console.log('✅ Gmail token saved to Supabase');
    } catch (error) {
      console.error('❌ Error saving Gmail token to Supabase:', error);
    }
  }

  private async hydrateTokenFromStorage(): Promise<void> {
    if (!this.oauth2Client) return;

    const token = await this.loadTokenFromSupabase();
    if (token) {
      this.oauth2Client.setCredentials(token);
      return;
    }

    this.loadTokenFromFile();
  }

  private async saveToken(token: any): Promise<void> {
    if (!this.oauth2Client) return;
    this.oauth2Client.setCredentials(token);
    await this.saveTokenToSupabase(token);
    this.saveTokenToFile(token);
  }

  /**
   * Configure les credentials manuellement (pour setup automatique)
   */
  public setCredentials(credentials: GmailCredentials): void {
    this.credentials = credentials;
    this.oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uri
    );

    // Sauvegarder les credentials
    const dataDir = path.dirname(CREDENTIALS_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
    console.log('✅ Gmail credentials configured');
  }

  /**
   * Génère l'URL d'authentification OAuth
   */
  public getAuthUrl(): string {
    if (!this.oauth2Client) {
      throw new Error('OAuth2 client not initialized. Please configure credentials first.');
    }

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
  }

  /**
   * Échange le code d'autorisation contre un token
   */
  public async getTokenFromCode(code: string): Promise<void> {
    if (!this.oauth2Client) {
      throw new Error('OAuth2 client not initialized');
    }

    const { tokens } = await this.oauth2Client.getToken(code);
    await this.saveToken(tokens);
  }

  /**
   * Vérifie si l'utilisateur est authentifié
   */
  public isAuthenticated(): boolean {
    const creds = this.oauth2Client?.credentials;
    return !!(this.oauth2Client && creds && (creds.refresh_token || creds.access_token));
  }

  /**
   * Récupère le client OAuth2
   */
  public getOAuth2Client(): any {
    return this.oauth2Client;
  }

  /**
   * Rafraîchit le token si nécessaire
   */
  public async refreshTokenIfNeeded(): Promise<void> {
    if (!this.oauth2Client) return;

    try {
      const credentials = this.oauth2Client.credentials;
      if (credentials.expiry_date && credentials.expiry_date < Date.now()) {
        console.log('🔄 Refreshing expired token...');
        const { credentials: newCredentials } = await this.oauth2Client.refreshAccessToken();
        this.oauth2Client.setCredentials(newCredentials);
        await this.saveToken(newCredentials);
        console.log('✅ Token refreshed successfully');
      }
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      throw error;
    }
  }

  public async ensureAuthenticated(): Promise<boolean> {
    if (!this.oauth2Client) return false;
    if (this.isAuthenticated()) return true;
    await this.hydrateTokenFromStorage();
    return this.isAuthenticated();
  }
}

// Export singleton instance
export const gmailAuthService = new GmailAuthService();
