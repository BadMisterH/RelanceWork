/**
 * Executive Dashboard - Notion-Inspired Clean Interface
 * Aesthetic: Modern, minimal, professional
 * Icons: Lucide (lucide.dev)
 */

import type { Application } from '../main';
import {
  createIcons,
  BarChart2, Clock, Briefcase, CheckCircle, Bell,
  LayoutGrid, Send, XCircle, MinusCircle, Search,
  RefreshCw, Trash2, Plus, ExternalLink, Inbox,
  CornerDownLeft, Mail,
} from 'lucide';

const DASH_ICONS = {
  BarChart2, Clock, Briefcase, CheckCircle, Bell,
  LayoutGrid, Send, XCircle, MinusCircle, Search,
  RefreshCw, Trash2, Plus, ExternalLink, Inbox,
  CornerDownLeft, Mail,
};

export class ExecutiveDashboard {
  private container: HTMLElement | null;
  private applications: Application[] = [];
  private filteredApplications: Application[] = [];
  private searchTerm: string = '';
  private activeFilter: string = 'all';

  constructor(containerId: string = 'applicationsList') {
    this.container = document.getElementById(containerId);
  }

  /**
   * Affiche le dashboard
   */
  public render(applications: Application[]) {
    if (!this.container) return;

    this.applications = [...applications].sort((a, b) => {
      return this.parseDate(b.date).getTime() - this.parseDate(a.date).getTime();
    });

    let result = this.applications;

    if (this.activeFilter !== 'all') {
      result = result.filter(app => this.getStatusClass(app.status) === this.activeFilter);
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(app =>
        app.company.toLowerCase().includes(term) ||
        app.poste.toLowerCase().includes(term) ||
        app.status.toLowerCase().includes(term)
      );
    }

    this.filteredApplications = result;

    const html = `
      ${this.renderStats()}
      ${this.renderTrackingTable()}
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
    this.updateStatsNumbers();
    createIcons({ icons: DASH_ICONS });

    if (this.searchTerm) {
      const searchInput = document.getElementById('dashTableSearch') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = this.searchTerm;
        searchInput.focus();
        searchInput.setSelectionRange(this.searchTerm.length, this.searchTerm.length);
      }
    }
  }

  /**
   * Cartes de statistiques
   */
  private renderStats(): string {
    const stats = this.calculateStats();

    return `
      <div class="dash-stats-grid">
        <div class="dash-stat-card dash-stat-total" data-stat="total">
          <div class="dash-stat-header">
            <span class="dash-stat-label">Total</span>
            <div class="dash-stat-icon-wrap dash-stat-icon-total">
              <i data-lucide="bar-chart-2"></i>
            </div>
          </div>
          <div class="dash-stat-value" data-count="${stats.total}">0</div>
          <span class="dash-stat-subtitle">Candidatures envoyées</span>
        </div>

        <div class="dash-stat-card dash-stat-pending" data-stat="pending">
          <div class="dash-stat-header">
            <span class="dash-stat-label">En attente</span>
            <div class="dash-stat-icon-wrap dash-stat-icon-pending">
              <i data-lucide="clock"></i>
            </div>
          </div>
          <div class="dash-stat-value" data-count="${stats.pending}">0</div>
          <span class="dash-stat-subtitle">${stats.pendingPercent}% du total</span>
        </div>

        <div class="dash-stat-card dash-stat-interview" data-stat="interview">
          <div class="dash-stat-header">
            <span class="dash-stat-label">Entretiens</span>
            <div class="dash-stat-icon-wrap dash-stat-icon-interview">
              <i data-lucide="briefcase"></i>
            </div>
          </div>
          <div class="dash-stat-value" data-count="${stats.interviews}">0</div>
          <span class="dash-stat-subtitle">${stats.interviewRate}% de conversion</span>
        </div>

        <div class="dash-stat-card dash-stat-accepted" data-stat="accepted">
          <div class="dash-stat-header">
            <span class="dash-stat-label">Acceptées</span>
            <div class="dash-stat-icon-wrap dash-stat-icon-accepted">
              <i data-lucide="check-circle"></i>
            </div>
          </div>
          <div class="dash-stat-value" data-count="${stats.accepted}">0</div>
          <span class="dash-stat-subtitle">${stats.successRate}% de réussite</span>
        </div>

        <div class="dash-stat-card dash-stat-relance" data-stat="relance">
          <div class="dash-stat-header">
            <span class="dash-stat-label">À relancer</span>
            <div class="dash-stat-icon-wrap dash-stat-icon-relance">
              <i data-lucide="bell"></i>
            </div>
          </div>
          <div class="dash-stat-value" data-count="${stats.toRelance}">0</div>
          <span class="dash-stat-subtitle">${stats.relancePercent}% nécessitent action</span>
        </div>
      </div>
    `;
  }

  /**
   * Boutons de filtre par statut
   */
  private renderFilterButtons(): string {
    const filterIcons: Record<string, string> = {
      all: 'layout-grid',
      sent: 'send',
      waiting: 'clock',
      interview: 'briefcase',
      accepted: 'check-circle',
      rejected: 'x-circle',
      'no-response': 'minus-circle',
    };

    const filters = [
      { key: 'all', label: 'Tout' },
      { key: 'sent', label: 'Envoyée' },
      { key: 'waiting', label: 'En attente' },
      { key: 'interview', label: 'Entretien' },
      { key: 'accepted', label: 'Acceptée' },
      { key: 'rejected', label: 'Refusée' },
      { key: 'no-response', label: 'Sans réponse' },
    ];

    return filters.map(f => {
      const count = f.key === 'all'
        ? this.applications.length
        : this.applications.filter(a => this.getStatusClass(a.status) === f.key).length;

      return `<button class="dash-filter-btn ${this.activeFilter === f.key ? 'active' : ''} dash-filter-${f.key}"
        data-filter="${f.key}">
        <span class="dash-filter-icon"><i data-lucide="${filterIcons[f.key]}"></i></span>
        <span class="dash-filter-label">${f.label}</span>
        <span class="dash-filter-count">${count}</span>
      </button>`;
    }).join('');
  }

  /**
   * Tableau de suivi
   */
  private renderTrackingTable(): string {
    const apps = this.filteredApplications;

    return `
      <div class="dash-table-section">
        <div class="dash-table-header">
          <div class="dash-table-title-wrapper">
            <h2 class="dash-table-title">Mes Candidatures</h2>
            <span class="dash-table-count">${apps.length}</span>
          </div>
          <div class="dash-table-controls">
            <div class="dash-filter-group">
              ${this.renderFilterButtons()}
            </div>
            <div class="dash-search-wrapper">
              <i data-lucide="search" class="dash-search-icon"></i>
              <input
                type="text"
                placeholder="Rechercher une entreprise ou un poste..."
                id="dashTableSearch"
                class="dash-search-input"
              />
            </div>
          </div>
        </div>

        <div class="dash-table-wrapper">
          ${apps.length === 0 ? this.renderEmptyState() : this.renderTable(apps)}
        </div>
      </div>
    `;
  }

  /**
   * Tableau HTML
   */
  private renderTable(apps: Application[]): string {
    return `
      <table class="dash-table">
        <thead>
          <tr>
            <th class="dash-th dash-th-company">Entreprise</th>
            <th class="dash-th dash-th-poste">Poste</th>
            <th class="dash-th dash-th-status">Statut</th>
            <th class="dash-th dash-th-date">Date</th>
            <th class="dash-th dash-th-relance">Relances</th>
            <th class="dash-th dash-th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${apps.map((app, index) => this.renderTableRow(app, index)).join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Ligne de tableau
   */
  private renderTableRow(app: Application, index: number): string {
    const statusClass = this.getStatusClass(app.status);
    const statusIcon = this.getStatusIcon(app.status);
    const relanceText = app.relanced ? `${app.relance_count || 1}×` : '';
    const relanceClass = app.relanced ? 'dash-has-relance' : '';

    return `
      <tr class="dash-table-row" data-app-id="${app.id}" style="animation-delay: ${index * 0.03}s">
        <td class="dash-td dash-td-company">
          <div class="dash-company-wrapper">
            <div class="dash-company-avatar">${app.company.charAt(0).toUpperCase()}</div>
            <div class="dash-company-info">
              <div class="dash-company-name-row">
                <span class="dash-company-name">${this.escapeHtml(app.company)}</span>
                ${app.company_website ? `<a href="${this.escapeHtml(app.company_website)}" target="_blank" rel="noopener" class="dash-company-link" title="Voir le site web">
                  <i data-lucide="external-link"></i>
                </a>` : ''}
              </div>
              ${app.company_description ? `<span class="dash-company-desc">${this.escapeHtml(app.company_description).substring(0, 80)}${app.company_description.length > 80 ? '...' : ''}</span>` : ''}
            </div>
          </div>
        </td>
        <td class="dash-td dash-td-poste">
          <span class="dash-poste-text">${this.escapeHtml(app.poste)}</span>
        </td>
        <td class="dash-td dash-td-status">
          <div class="dash-status-dropdown" data-app-id="${app.id}">
            <button class="dash-status-badge dash-status-${statusClass} dash-status-trigger" type="button">
              <span class="dash-status-icon"><i data-lucide="${statusIcon}"></i></span>
              <span class="dash-status-text">${this.escapeHtml(app.status)}</span>
              <svg class="dash-status-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="dash-status-menu">
              ${this.renderStatusOptions(app.status)}
            </div>
          </div>
        </td>
        <td class="dash-td dash-td-date">
          <span class="dash-date-text">${this.formatDate(app.date)}</span>
        </td>
        <td class="dash-td dash-td-relance">
          <span class="dash-relance-badge ${relanceClass}">
            ${app.relanced
              ? `<i data-lucide="bell"></i> ${relanceText}`
              : '—'
            }
          </span>
        </td>
        <td class="dash-td dash-td-actions">
          <div class="dash-actions-group">
            <button
              class="dash-action-btn dash-btn-relance"
              data-action="relance"
              data-id="${app.id}"
              title="Relancer cette candidature"
            >
              <i data-lucide="refresh-cw"></i>
              <span>Relancer</span>
            </button>
            ${app.company_website && !app.company_description ? `<button
              class="dash-action-btn dash-btn-enrich"
              data-action="enrich"
              data-id="${app.id}"
              data-website="${this.escapeHtml(app.company_website)}"
              title="Enrichir les infos entreprise"
            >
              <i data-lucide="plus"></i>
            </button>` : ''}
            <button
              class="dash-action-btn dash-btn-delete"
              data-action="delete"
              data-id="${app.id}"
              title="Supprimer cette candidature"
            >
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * État vide
   */
  private renderEmptyState(): string {
    return `
      <div class="dash-empty-state">
        <div class="dash-empty-icon">
          <i data-lucide="inbox"></i>
        </div>
        <div class="dash-empty-title">Aucune candidature trouvée</div>
        <div class="dash-empty-text">
          ${this.searchTerm
            ? `Aucun résultat pour "${this.escapeHtml(this.searchTerm)}"`
            : 'Commencez par ajouter votre première candidature'
          }
        </div>
      </div>
    `;
  }

  /**
   * Calcul des statistiques
   */
  private calculateStats() {
    const total = this.applications.length;
    const pending = this.applications.filter(a =>
      a.status.toLowerCase().includes('attente') ||
      a.status.toLowerCase().includes('envoyée') ||
      a.status.toLowerCase().includes('postul')
    ).length;
    const interviews = this.applications.filter(a =>
      a.status.toLowerCase().includes('entretien')
    ).length;
    const accepted = this.applications.filter(a =>
      a.status.toLowerCase().includes('accepté') ||
      a.status.toLowerCase().includes('proposé')
    ).length;
    const toRelance = this.applications.filter(a => !a.relanced &&
      !a.status.toLowerCase().includes('accepté') &&
      !a.status.toLowerCase().includes('refusé') &&
      !a.status.toLowerCase().includes('retiré')
    ).length;

    return {
      total,
      pending,
      interviews,
      accepted,
      toRelance,
      pendingPercent: total > 0 ? Math.round((pending / total) * 100) : 0,
      interviewRate: total > 0 ? Math.round((interviews / total) * 100) : 0,
      successRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
      relancePercent: total > 0 ? Math.round((toRelance / total) * 100) : 0
    };
  }

  /**
   * Classe CSS selon le statut
   */
  private getStatusClass(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('envoyée') || s.includes('candidature') || s.includes('postul')) return 'sent';
    if (s.includes('entretien')) return 'interview';
    if (s.includes('accepté') || s.includes('proposé')) return 'accepted';
    if (s.includes('refusé')) return 'rejected';
    if (s.includes('attente')) return 'waiting';
    if (s.includes('pas de réponse') || s.includes('retiré')) return 'no-response';
    return 'sent';
  }

  /**
   * Nom d'icône Lucide selon le statut
   */
  private getStatusIcon(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('envoyée') || s.includes('candidature') || s.includes('postul')) return 'send';
    if (s.includes('entretien')) return 'briefcase';
    if (s.includes('accepté') || s.includes('proposé')) return 'check-circle';
    if (s.includes('refusé')) return 'x-circle';
    if (s.includes('attente')) return 'clock';
    if (s.includes('pas de réponse')) return 'minus-circle';
    if (s.includes('retiré')) return 'corner-down-left';
    return 'mail';
  }

  /**
   * Options du dropdown de statut
   */
  private renderStatusOptions(currentStatus: string): string {
    const statuses = [
      { label: 'En attente', icon: 'clock', class: 'waiting' },
      { label: 'Entretien', icon: 'briefcase', class: 'interview' },
      { label: 'Accepté', icon: 'check-circle', class: 'accepted' },
      { label: 'Refusé', icon: 'x-circle', class: 'rejected' },
      { label: 'Pas de réponse', icon: 'minus-circle', class: 'no-response' },
    ];

    return statuses.map(s => {
      const isActive = currentStatus.toLowerCase().includes(s.label.toLowerCase().split(' ')[0]);
      return `
        <button
          class="dash-status-option dash-status-${s.class} ${isActive ? 'active' : ''}"
          data-status="${s.label}"
          type="button"
        >
          <span class="dash-status-icon"><i data-lucide="${s.icon}"></i></span>
          <span class="dash-status-text">${s.label}</span>
          ${isActive ? '<svg class="dash-status-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </button>
      `;
    }).join('');
  }

  /**
   * Formatage de date relatif
   */
  private formatDate(dateStr: string): string {
    if (!dateStr) return '—';

    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)}sem`;

    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Animation des chiffres
   */
  private animateNumber(element: HTMLElement, target: number) {
    const duration = 1000;
    const start = 0;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (target - start) * easeOut);

      element.textContent = current.toString();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.textContent = target.toString();
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Mettre à jour les chiffres des stats avec animation
   */
  private updateStatsNumbers() {
    const statValues = document.querySelectorAll('.dash-stat-value');
    statValues.forEach(element => {
      const target = parseInt((element as HTMLElement).dataset.count || '0');
      this.animateNumber(element as HTMLElement, target);
    });
  }

  /**
   * Échapper le HTML pour éviter les injections XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Gestion des événements
   */
  private attachEventListeners() {
    document.querySelectorAll('.dash-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = (btn as HTMLElement).dataset.filter || 'all';
        this.activeFilter = filter;
        this.filterApplications();
      });
    });

    const searchInput = document.getElementById('dashTableSearch') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = (e.target as HTMLInputElement).value;
        this.filterApplications();
      });
    }

    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const action = target.dataset.action;
        const id = target.dataset.id;

        if (action === 'relance') {
          this.handleRelance(Number(id));
        } else if (action === 'delete') {
          this.handleDelete(Number(id));
        } else if (action === 'enrich') {
          const website = target.dataset.website;
          this.handleEnrich(Number(id), website || '');
        }
      });
    });

    this.attachStatusDropdownListeners();
  }

  /**
   * Gérer les dropdowns de statut
   */
  private attachStatusDropdownListeners() {
    document.querySelectorAll('.dash-status-trigger').forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = (trigger as HTMLElement).closest('.dash-status-dropdown');
        const isOpen = dropdown?.classList.contains('active');

        document.querySelectorAll('.dash-status-dropdown').forEach(d => d.classList.remove('active'));

        if (!isOpen) {
          dropdown?.classList.add('active');
        }
      });
    });

    document.querySelectorAll('.dash-status-option').forEach(option => {
      option.addEventListener('click', async (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const newStatus = target.dataset.status;
        const dropdown = target.closest('.dash-status-dropdown');
        const appId = dropdown?.getAttribute('data-app-id');

        if (newStatus && appId) {
          await this.handleStatusChange(Number(appId), newStatus);
        }

        dropdown?.classList.remove('active');
      });
    });

    document.addEventListener('click', () => {
      document.querySelectorAll('.dash-status-dropdown').forEach(d => d.classList.remove('active'));
    });
  }

  /**
   * Gérer le changement de statut
   */
  private async handleStatusChange(id: number, newStatus: string) {
    const event = new CustomEvent('status-change', { detail: { id, status: newStatus } });
    window.dispatchEvent(event);
  }

  /**
   * Parse une date au format JJ/MM/AAAA ou ISO
   */
  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date(0);

    const parts = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (parts) {
      return new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
    }

    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }

  /**
   * Filtrer les candidatures
   */
  private filterApplications() {
    let result = this.applications;

    if (this.activeFilter !== 'all') {
      result = result.filter(app => this.getStatusClass(app.status) === this.activeFilter);
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(app =>
        app.company.toLowerCase().includes(term) ||
        app.poste.toLowerCase().includes(term) ||
        app.status.toLowerCase().includes(term)
      );
    }

    this.filteredApplications = result;

    const tableWrapper = document.querySelector('.dash-table-wrapper');
    const countBadge = document.querySelector('.dash-table-count');

    if (tableWrapper) {
      const apps = this.filteredApplications;
      tableWrapper.innerHTML = apps.length === 0 ? this.renderEmptyState() : this.renderTable(apps);
      createIcons({ icons: DASH_ICONS });

      document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const target = e.currentTarget as HTMLElement;
          const action = target.dataset.action;
          const id = target.dataset.id;

          if (action === 'relance') {
            this.handleRelance(Number(id));
          } else if (action === 'delete') {
            this.handleDelete(Number(id));
          } else if (action === 'enrich') {
            const website = target.dataset.website;
            this.handleEnrich(Number(id), website || '');
          }
        });
      });

      this.attachStatusDropdownListeners();
    }

    if (countBadge) {
      countBadge.textContent = `${this.filteredApplications.length}`;
    }

    document.querySelectorAll('.dash-filter-btn').forEach(btn => {
      const key = (btn as HTMLElement).dataset.filter;
      btn.classList.toggle('active', key === this.activeFilter);
    });
  }

  private handleRelance(id: number) {
    const event = new CustomEvent('relance-application', { detail: { id } });
    window.dispatchEvent(event);
  }

  private handleEnrich(id: number, website: string) {
    const event = new CustomEvent('enrich-company', { detail: { id, website } });
    window.dispatchEvent(event);
  }

  private handleDelete(id: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette candidature ?')) {
      const event = new CustomEvent('delete-application', { detail: { id } });
      window.dispatchEvent(event);
    }
  }
}
