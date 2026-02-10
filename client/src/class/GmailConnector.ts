/**
 * Composant pour connecter Gmail
 */

import api from '../lib/api';

export class GmailConnector {
  private container: HTMLElement | null;
  private isConnected: boolean = false;
  private gmailEmail: string | null = null;
  private isTracking: boolean = false;
  private trackingStartedAt: string | null = null;

  constructor(containerId: string = 'gmailConnector') {
    this.container = document.getElementById(containerId);
    this.init();
  }

  private async init() {
    await this.checkStatus();
    if (this.isConnected) {
      await this.checkTrackingStatus();
    }
    this.render();
  }

  /**
   * Vérifie si Gmail est connecté
   */
  private async checkStatus() {
    try {
      const response = await api.get('/gmail-user/status');
      this.isConnected = response.data.connected;
      this.gmailEmail = response.data.gmail_email;
    } catch (error) {
      console.error('Erreur lors de la vérification du statut Gmail:', error);
    }
  }

  /**
   * Vérifie le statut du tracking
   */
  private async checkTrackingStatus() {
    try {
      const response = await api.get('/gmail-user/tracking/status');
      this.isTracking = response.data.tracking;
      this.trackingStartedAt = response.data.started_at;
    } catch (error) {
      console.error('Erreur lors de la vérification du tracking:', error);
    }
  }

  /**
   * Formate une date ISO en texte lisible
   */
  private formatTrackingDate(isoDate: string): string {
    const date = new Date(isoDate);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Affiche le composant
   */
  private render() {
    if (!this.container) return;

    if (this.isConnected) {
      const trackingInfo = this.isTracking && this.trackingStartedAt
        ? `<span class="tracking-since">depuis le ${this.formatTrackingDate(this.trackingStartedAt)}</span>`
        : '';

      this.container.innerHTML = `
        <div class="gmail-status connected">
          <div class="gmail-icon">✅</div>
          <div class="gmail-info">
            <strong>Gmail Connecté</strong>
            <p>${this.gmailEmail}</p>
          </div>
          <div class="gmail-actions">
            <button id="trackingToggleBtn" class="btn-tracking ${this.isTracking ? 'active' : ''}">
              ${this.isTracking ? '⏹️ Arrêter le suivi' : '▶️ Démarrer le suivi'}
            </button>
            ${trackingInfo}
            <button id="checkEmailsBtn" class="btn-check" ${!this.isTracking ? 'disabled title="Activez le suivi d\'abord"' : ''}>
              🔍 Vérifier les emails
            </button>
            <button id="disconnectGmailBtn" class="btn-disconnect">
              🔌 Déconnecter
            </button>
          </div>
        </div>
      `;

      this.attachConnectedListeners();
    } else {
      this.container.innerHTML = `
        <div class="gmail-status disconnected">
          <div class="gmail-icon">📧</div>
          <div class="gmail-info">
            <strong>Détection Automatique des Candidatures</strong>
            <p>Connectez votre Gmail pour auto-détecter vos candidatures</p>
          </div>
          <button id="connectGmailBtn" class="btn-connect">
            🔗 Connecter mon Gmail
          </button>
        </div>
      `;

      this.attachDisconnectedListeners();
    }
  }

  /**
   * Gestion des événements (état déconnecté)
   */
  private attachDisconnectedListeners() {
    const connectBtn = document.getElementById('connectGmailBtn');
    connectBtn?.addEventListener('click', () => this.connectGmail());
  }

  /**
   * Gestion des événements (état connecté)
   */
  private attachConnectedListeners() {
    const trackingBtn = document.getElementById('trackingToggleBtn');
    const checkBtn = document.getElementById('checkEmailsBtn');
    const disconnectBtn = document.getElementById('disconnectGmailBtn');

    trackingBtn?.addEventListener('click', () => this.toggleTracking());
    checkBtn?.addEventListener('click', () => this.checkEmails());
    disconnectBtn?.addEventListener('click', () => this.disconnectGmail());
  }

  /**
   * Connecter Gmail
   */
  private async connectGmail() {
    try {
      const response = await api.get('/gmail-user/connect');
      const authUrl = response.data.auth_url;

      // Ouvrir l'URL d'authentification dans une nouvelle fenêtre
      const width = 600;
      const height = 700;
      const left = (screen.width / 2) - (width / 2);
      const top = (screen.height / 2) - (height / 2);

      const authWindow = window.open(
        authUrl,
        'Gmail Authentication',
        `width=${width},height=${height},top=${top},left=${left}`
      );

      // Écouter la fermeture de la fenêtre
      const checkClosed = setInterval(async () => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);

          // Vérifier si la connexion a réussi
          await this.checkStatus();
          this.render();

          if (this.isConnected) {
            alert('✅ Gmail connecté avec succès !');
          }
        }
      }, 500);
    } catch (error: any) {
      console.error('Erreur lors de la connexion Gmail:', error);
      alert('❌ Erreur lors de la connexion Gmail: ' + error.message);
    }
  }

  /**
   * Démarrer ou arrêter le suivi des emails
   */
  private async toggleTracking() {
    const trackingBtn = document.getElementById('trackingToggleBtn') as HTMLButtonElement;

    try {
      if (trackingBtn) {
        trackingBtn.disabled = true;
      }

      if (this.isTracking) {
        await api.post('/gmail-user/tracking/stop');
        this.isTracking = false;
        this.trackingStartedAt = null;
      } else {
        const response = await api.post('/gmail-user/tracking/start');
        this.isTracking = true;
        this.trackingStartedAt = response.data.started_at;
      }

      this.render();
    } catch (error: any) {
      console.error('Erreur lors du toggle tracking:', error);
      alert('Erreur: ' + error.message);
    }
  }

  /**
   * Vérifier les nouveaux emails
   */
  private async checkEmails() {
    try {
      const checkBtn = document.getElementById('checkEmailsBtn') as HTMLButtonElement;
      if (checkBtn) {
        checkBtn.disabled = true;
        checkBtn.textContent = '⏳ Vérification en cours...';
      }

      await api.post('/gmail-user/check-emails');

      alert('✅ Emails vérifiés ! Les nouvelles candidatures ont été ajoutées.');

      // Recharger les candidatures
      window.location.reload();
    } catch (error: any) {
      console.error('Erreur lors de la vérification des emails:', error);
      alert('❌ Erreur: ' + error.message);
    } finally {
      const checkBtn = document.getElementById('checkEmailsBtn') as HTMLButtonElement;
      if (checkBtn) {
        checkBtn.disabled = false;
        checkBtn.textContent = '🔍 Vérifier les emails';
      }
    }
  }

  /**
   * Déconnecter Gmail
   */
  private async disconnectGmail() {
    if (!confirm('Êtes-vous sûr de vouloir déconnecter Gmail ?')) {
      return;
    }

    try {
      await api.post('/gmail-user/disconnect');

      this.isConnected = false;
      this.gmailEmail = null;
      this.render();

      alert('✅ Gmail déconnecté');
    } catch (error: any) {
      console.error('Erreur lors de la déconnexion Gmail:', error);
      alert('❌ Erreur: ' + error.message);
    }
  }
}
