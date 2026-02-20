import { gmailAuthService } from './gmailAuthService';
import { gmailWatchService } from './gmailWatchService';
import { addApplication } from '../controllers/applicationController';

const POLLING_INTERVAL = 30000; // 30 secondes

export class GmailPollingService {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastCheckedMessageId: string | null = null;
  private processedMessageIds: Set<string> = new Set();

  /**
   * Démarre le polling automatique
   */
  public start(): void {
    if (this.isRunning) {
      return;
    }

    if (!gmailAuthService.isAuthenticated()) {
      return;
    }


    this.isRunning = true;

    // Vérification initiale
    this.checkForNewEmails();

    // Vérification périodique
    this.intervalId = setInterval(() => {
      this.checkForNewEmails();
    }, POLLING_INTERVAL);
  }

  /**
   * Arrête le polling automatique
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
  }

  /**
   * Vérifie s'il y a de nouveaux emails
   */
  private async checkForNewEmails(): Promise<void> {
    try {
      // Récupérer les 10 derniers emails envoyés
      const recentEmails = await gmailWatchService.listRecentSentEmails(10);

      if (!recentEmails || recentEmails.length === 0) {
        return;
      }

      // Si c'est la première vérification, on marque le dernier email comme référence
      if (!this.lastCheckedMessageId) {
        this.lastCheckedMessageId = recentEmails[0].id;
        return;
      }

      // Trouver les nouveaux emails (ceux qui sont après le dernier vérifié)
      const newEmails: any[] = [];
      for (const email of recentEmails) {
        if (email.id === this.lastCheckedMessageId) {
          break; // On arrête dès qu'on trouve le dernier email traité
        }
        if (!this.processedMessageIds.has(email.id)) {
          newEmails.push(email);
        }
      }

      if (newEmails.length === 0) {
        return;
      }


      // Traiter chaque nouveau email
      for (const email of newEmails) {
        await this.processNewEmail(email.id);
      }

      // Mettre à jour la référence
      if (newEmails.length > 0) {
        this.lastCheckedMessageId = recentEmails[0].id;
      }
    } catch (error: any) {
      console.error('❌ Error checking for new emails:', error.message);

      // Si l'erreur est liée à l'authentification, arrêter le polling
      if (error.message.includes('invalid_grant') || error.message.includes('Token')) {
        this.stop();
      }
    }
  }

  /**
   * Traite un nouvel email
   */
  private async processNewEmail(messageId: string): Promise<void> {
    try {
      // Marquer comme traité immédiatement pour éviter les doublons
      this.processedMessageIds.add(messageId);


      // Analyser l'email
      const emailData = await gmailWatchService.processEmail(messageId);

      if (!emailData) {
        return;
      }

      // Vérifier si c'est une candidature valide
      if (!emailData.poste || !emailData.status) {
        return;
      }


      // TODO: Refactor Gmail polling pour multi-user support
      // Le service Gmail doit être lié à un utilisateur spécifique
      // Pour l'instant, on skip la création automatique car userId est requis
      console.warn('⚠️  Auto-création désactivée : le service Gmail nécessite un userId');
      console.warn('   → Refactoriser pour lier le compte Gmail à un utilisateur Supabase');

      // await addApplication(emailData); // Désactivé temporairement

    } catch (error: any) {
      console.error(`❌ Error processing email ${messageId}:`, error.message);

      // En cas d'erreur, retirer de la liste des traités pour réessayer plus tard
      this.processedMessageIds.delete(messageId);
    }
  }

  /**
   * Retourne le statut du polling
   */
  public getStatus(): {
    isRunning: boolean;
    interval: number;
    lastCheckedMessageId: string | null;
    processedCount: number;
  } {
    return {
      isRunning: this.isRunning,
      interval: POLLING_INTERVAL,
      lastCheckedMessageId: this.lastCheckedMessageId,
      processedCount: this.processedMessageIds.size
    };
  }

  /**
   * Nettoie les anciens IDs traités (garde seulement les 100 derniers)
   */
  private cleanupProcessedIds(): void {
    if (this.processedMessageIds.size > 100) {
      const idsArray = Array.from(this.processedMessageIds);
      this.processedMessageIds = new Set(idsArray.slice(-100));
    }
  }
}

// Export singleton instance
export const gmailPollingService = new GmailPollingService();
