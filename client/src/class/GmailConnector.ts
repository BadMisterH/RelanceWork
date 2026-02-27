/**
 * Composant pour connecter Gmail
 */

import api from '../lib/api';
import {
  createIcons,
  CheckCircle, Mail, Play, Square, RefreshCw, LogOut, Link, Info, XCircle,
} from 'lucide';

const GMAIL_ICONS = { CheckCircle, Mail, Play, Square, RefreshCw, LogOut, Link, Info, XCircle };

export class GmailConnector {
  private container: HTMLElement | null;
  private isConnected: boolean = false;
  private gmailEmail: string | null = null;
  private isTracking: boolean = false;
  private trackingStartedAt: string | null = null;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private static readonly POLLING_DELAY = 60_000; // 60 secondes

  constructor(containerId: string = 'gmailConnector') {
    this.container = document.getElementById(containerId);
    this.ensureToastContainer();
    this.init();
  }

  private async init() {
    await this.checkStatus();
    if (this.isConnected) {
      await this.checkTrackingStatus();
      // Démarrer le polling si le tracking était déjà actif
      if (this.isTracking) {
        this.startPolling();
      }
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
      const trackingMeta = this.isTracking && this.trackingStartedAt
        ? `<div class="gmail-status-meta">
             <span class="tracking-since">depuis le ${this.formatTrackingDate(this.trackingStartedAt)}</span>
             <span class="gmail-polling-indicator"><span class="gmail-polling-dot"></span>Auto-sync actif</span>
           </div>`
        : '';

      this.container.innerHTML = `
        <div class="gmail-status connected">
          <div class="gmail-status-left">
            <div class="gmail-status-icon connected">
              <i data-lucide="check-circle"></i>
            </div>
            <div class="gmail-info">
              <strong>Gmail Connecté</strong>
              <span>${this.gmailEmail}</span>
            </div>
          </div>
          ${trackingMeta}
          <div class="gmail-actions">
            <button id="trackingToggleBtn" class="btn-tracking ${this.isTracking ? 'active' : ''}">
              <i data-lucide="${this.isTracking ? 'square' : 'play'}"></i>
              <span>${this.isTracking ? 'Arrêter le suivi' : 'Démarrer le suivi'}</span>
            </button>
            <button id="checkEmailsBtn" class="btn-check" ${!this.isTracking ? 'disabled title="Activez le suivi d\'abord"' : ''}>
              <i data-lucide="refresh-cw"></i>
              <span>Vérifier</span>
            </button>
            <button id="disconnectGmailBtn" class="btn-disconnect" title="Déconnecter Gmail">
              <i data-lucide="log-out"></i>
            </button>
          </div>
        </div>
        <div class="gmail-detection-hint">
          <div class="gmail-detection-hint-title">
            <i data-lucide="info"></i>
            Formats d'objet détectés automatiquement
          </div>
          <div class="gmail-detection-hint-examples">
            <code>Candidature [Poste] - [Entreprise]</code>
            <span class="gmail-detection-hint-sep">ou</span>
            <code>Suite à ma candidature - [Poste]</code>
          </div>
          <p class="gmail-detection-hint-desc">Utilisez ces formats dans l'objet de vos emails pour que RelanceWork détecte et ajoute automatiquement vos candidatures.</p>
        </div>
      `;
      createIcons({ icons: GMAIL_ICONS });
      this.attachConnectedListeners();
    } else {
      this.container.innerHTML = `
        <div class="gmail-status disconnected">
          <div class="gmail-status-left">
            <div class="gmail-status-icon disconnected">
              <i data-lucide="mail"></i>
            </div>
            <div class="gmail-info">
              <strong>Détection Automatique des Candidatures</strong>
              <span>Connectez votre Gmail pour auto-détecter vos candidatures</span>
            </div>
          </div>
          <button id="connectGmailBtn" class="btn-connect">
            <i data-lucide="link"></i>
            <span>Connecter mon Gmail</span>
          </button>
        </div>
        <div class="gmail-detection-hint">
          <div class="gmail-detection-hint-title">
            <i data-lucide="info"></i>
            Comment fonctionne la détection ?
          </div>
          <p class="gmail-detection-hint-desc">Une fois connecté, RelanceWork scanne vos emails envoyés et détecte automatiquement les candidatures. Pour que la détection fonctionne, l'objet de vos emails doit suivre un de ces formats :</p>
          <div class="gmail-detection-hint-examples">
            <code>Candidature [Poste] - [Entreprise]</code>
            <span class="gmail-detection-hint-sep">ou</span>
            <code>Suite à ma candidature - [Poste]</code>
          </div>
        </div>
      `;
      createIcons({ icons: GMAIL_ICONS });
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
            this.showToast('success', 'Gmail connecté avec succès !');
          }
        }
      }, 500);
    } catch (error: any) {
      console.error('Erreur lors de la connexion Gmail:', error);
      this.showToast('error', 'Erreur lors de la connexion Gmail: ' + error.message);
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
        this.stopPolling();
        this.showToast('info', 'Suivi Gmail arrêté.');
      } else {
        const response = await api.post('/gmail-user/tracking/start');
        this.isTracking = true;
        this.trackingStartedAt = response.data.started_at;
        this.startPolling();
        // Vérification immédiate au démarrage du suivi
        this.checkEmails(true);
        this.showToast('success', 'Suivi Gmail activé ! Vérification automatique toutes les 60s.');
      }

      this.render();
    } catch (error: any) {
      console.error('Erreur lors du toggle tracking:', error);
      this.showToast('error', 'Erreur: ' + error.message);
    }
  }

  /**
   * Vérifier les nouveaux emails
   */
  private async checkEmails(silent: boolean = false) {
    try {
      const checkBtn = document.getElementById('checkEmailsBtn') as HTMLButtonElement;
      if (checkBtn && !silent) {
        checkBtn.disabled = true;
        const span = checkBtn.querySelector('span');
        if (span) span.textContent = 'Vérification…';
      }

      const response = await api.post('/gmail-user/check-emails');
      const newCount = response.data?.new_applications ?? response.data?.count ?? 0;

      if (newCount > 0) {
        this.showToast('success', `${newCount} nouvelle(s) candidature(s) détectée(s) !`);
      } else if (!silent) {
        this.showToast('info', 'Aucune nouvelle candidature détectée.');
      }

      // Rafraîchir le dashboard sans recharger la page
      window.dispatchEvent(new CustomEvent('gmail-refresh'));
    } catch (error: any) {
      console.error('Erreur lors de la vérification des emails:', error);
      if (!silent) {
        this.showToast('error', 'Erreur lors de la vérification des emails.');
      }
    } finally {
      const checkBtn = document.getElementById('checkEmailsBtn') as HTMLButtonElement;
      if (checkBtn) {
        checkBtn.disabled = !this.isTracking;
        const span = checkBtn.querySelector('span');
        if (span) span.textContent = 'Vérifier';
      }
    }
  }

  // ==========================================
  // POLLING AUTOMATIQUE
  // ==========================================

  /**
   * Démarre le polling automatique
   */
  private startPolling() {
    this.stopPolling();
    this.pollingInterval = setInterval(() => {
      this.checkEmails(true);
    }, GmailConnector.POLLING_DELAY);
  }

  /**
   * Arrête le polling automatique
   */
  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================

  /**
   * Crée le container de toasts s'il n'existe pas
   */
  private ensureToastContainer() {
    if (!document.getElementById('toastContainer')) {
      const container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
  }

  /**
   * Affiche une notification toast
   */
  private showToast(type: 'success' | 'error' | 'info', message: string) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const iconNames = { success: 'check-circle', error: 'x-circle', info: 'info' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon"><i data-lucide="${iconNames[type]}"></i></span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);
    createIcons({ icons: GMAIL_ICONS });

    setTimeout(() => {
      toast.classList.add('toast-exit');
      toast.addEventListener('animationend', () => toast.remove());
    }, 3500);
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
      this.stopPolling();
      this.render();

      this.showToast('info', 'Gmail déconnecté.');
    } catch (error: any) {
      console.error('Erreur lors de la déconnexion Gmail:', error);
      this.showToast('error', 'Erreur lors de la déconnexion: ' + error.message);
    }
  }
}
