import api from '../lib/api';

interface SpontaneousProspect {
  id: string;
  company_name: string;
  company_domain: string | null;
  company_website: string | null;
  company_description: string | null;
  company_favicon: string | null;
  contact_email: string | null;
  email_subject: string | null;
  email_body: string | null;
  cv_attached: boolean;
  status: 'pending' | 'sent' | 'failed' | 'replied' | 'rejected';
  source: string;
  sent_at: string | null;
  created_at: string;
}

export class SpontaneousAgent {
  private container: HTMLElement | null;
  private prospects: SpontaneousProspect[] = [];
  private currentProspectId: string | null = null;
  private isEditing = false;

  constructor(containerId: string = 'spontaneousView') {
    this.container = document.getElementById(containerId);
  }

  public render() {
    if (!this.container) return;
    this.container.innerHTML = this.buildHTML();
    this.bindEvents();
    this.loadProspects();
  }

  // ─── HTML ─────────────────────────────────────────────────────────────────

  private buildHTML(): string {
    return `
      <div class="ja-layout">
        <div class="ja-results-panel">
          <div class="ja-results-header">
            <div class="ja-results-title">
              <h3>Prospects spontanés</h3>
              <span class="ja-count" id="sp-count">0 entreprise(s)</span>
            </div>
            <div class="ja-filter-row">
              <label class="ja-filter-label">Statut</label>
              <select id="sp-filter-status" class="ja-filter-select">
                <option value="">Tous</option>
                <option value="pending">En attente</option>
                <option value="sent">Envoyé</option>
                <option value="replied">Répondu</option>
                <option value="rejected">Refusé</option>
                <option value="failed">Échec</option>
              </select>
            </div>
          </div>

          <div class="ja-score-legend">
            <span class="legend-dot" style="background:#10b981"></span><span>Envoyé</span>
            <span class="legend-dot" style="background:#f59e0b"></span><span>En attente</span>
            <span class="legend-dot" style="background:#6366f1"></span><span>Répondu</span>
            <span class="legend-dot" style="background:#ef4444"></span><span>Refusé</span>
          </div>

          <div id="sp-results-list" class="ja-results-list">
            <div class="ja-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p>Aucun prospect pour le moment</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Email Preview Modal -->
      <div class="ja-modal-overlay" id="sp-modal" style="display:none">
        <div class="ja-modal">
          <div class="ja-modal-header">
            <h4 id="sp-modal-title">Email de candidature</h4>
            <div class="ja-modal-header-actions">
              <button class="ja-btn-edit" id="sp-edit-email" title="Modifier">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Modifier
              </button>
              <button class="ja-modal-close" id="sp-modal-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="sp-modal-subject-wrap" id="sp-modal-subject-wrap">
            <span class="sp-subject-label">Objet</span>
            <span class="sp-subject-value" id="sp-modal-subject-text"></span>
          </div>
          <input class="sp-subject-input" id="sp-modal-subject-input" type="text" style="display:none" placeholder="Objet de l'email" />

          <div class="ja-modal-body" id="sp-modal-body"></div>
          <textarea class="ja-modal-editor" id="sp-modal-editor" style="display:none" rows="12"></textarea>

          <div class="ja-modal-actions">
            <button class="ja-btn-secondary" id="sp-copy-email">Copier</button>
            <button class="ja-btn-save" id="sp-save-email" style="display:none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
              </svg>
              Sauvegarder
            </button>
            <button class="sp-btn-send" id="sp-send-now">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Envoyer
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  private bindEvents() {
    document.getElementById('sp-modal-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('sp-copy-email')?.addEventListener('click', () => this.copyEmail());
    document.getElementById('sp-edit-email')?.addEventListener('click', () => this.toggleEditMode());
    document.getElementById('sp-save-email')?.addEventListener('click', () => this.saveEmail());
    document.getElementById('sp-send-now')?.addEventListener('click', () => this.sendFromModal());
    document.getElementById('sp-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'sp-modal') this.closeModal();
    });
    document.getElementById('sp-filter-status')?.addEventListener('change', () => this.loadProspects());
  }

  // ─── Load & Render ────────────────────────────────────────────────────────

  private async loadProspects() {
    try {
      const statusFilter = (document.getElementById('sp-filter-status') as HTMLSelectElement)?.value;
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.get(`/spontaneous/prospects${params}`);
      this.prospects = res.data.prospects ?? [];
      this.renderProspects();
    } catch { /* silent */ }
  }

  private renderProspects() {
    const list = document.getElementById('sp-results-list');
    const count = document.getElementById('sp-count');
    if (!list) return;

    if (count) count.textContent = `${this.prospects.length} entreprise(s)`;

    if (this.prospects.length === 0) {
      list.innerHTML = `
        <div class="ja-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p>Aucun prospect pour le moment</p>
        </div>`;
      return;
    }

    list.innerHTML = this.prospects.map(p => this.buildCard(p)).join('');

    this.prospects.forEach(p => {
      document.getElementById(`sp-view-${p.id}`)?.addEventListener('click', () => this.openEmailModal(p));
      document.getElementById(`sp-gen-${p.id}`)?.addEventListener('click', () => this.generateEmail(p));
      document.getElementById(`sp-send-${p.id}`)?.addEventListener('click', () => this.sendProspect(p.id));
      document.getElementById(`sp-delete-${p.id}`)?.addEventListener('click', () => this.deleteProspect(p.id));
    });
  }

  private buildCard(p: SpontaneousProspect): string {
    const statusLabels: Record<string, string> = {
      pending: 'En attente', sent: 'Envoyé', failed: 'Échec',
      replied: 'Répondu', rejected: 'Refusé',
    };
    const label = statusLabels[p.status] ?? 'En attente';

    const favicon = p.company_favicon
      ? `<img src="${p.company_favicon}" class="sp-favicon" alt="" onerror="this.style.display='none'" />`
      : `<div class="sp-favicon-placeholder">${p.company_name.substring(0, 2).toUpperCase()}</div>`;

    const emailChip = p.contact_email
      ? `<span class="sp-email-chip">✉ ${p.contact_email}</span>`
      : `<span class="sp-email-chip no-email">Pas d'email trouvé</span>`;

    const desc = p.company_description
      ? `<p class="ja-card-why">${p.company_description.substring(0, 120)}...</p>`
      : '';

    const viewBtn = p.email_body
      ? `<button class="ja-btn-ghost" id="sp-view-${p.id}">Voir l'email</button>`
      : `<button class="ja-btn-ghost" id="sp-gen-${p.id}">Générer email</button>`;

    const sendBtn = (p.status === 'pending' && p.contact_email && p.email_body)
      ? `<button class="ja-btn-primary" id="sp-send-${p.id}">Envoyer</button>`
      : '';

    const websiteLink = p.company_website
      ? `<a href="${p.company_website}" target="_blank" class="ja-link">${p.company_domain || p.company_website} ↗</a>`
      : `<span class="ja-link" style="opacity:.4">${p.company_domain || '—'}</span>`;

    return `
      <div class="ja-card sp-card sp-bar-${p.status}">
        <div class="sp-card-status-bar"></div>
        <div class="ja-card-top">
          <div class="sp-company-row" style="flex:1;min-width:0">
            ${favicon}
            <span class="ja-card-title">${p.company_name}</span>
          </div>
          <div class="ja-card-actions-top" style="gap:8px">
            <span class="sp-status sp-status--${p.status}">${label}</span>
            <button class="ja-icon-btn" id="sp-delete-${p.id}" title="Supprimer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              </svg>
            </button>
          </div>
        </div>

        <div style="padding:4px 14px 6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${emailChip}
          ${p.sent_at ? `<span style="font-size:11px;color:var(--text-muted)">· ${new Date(p.sent_at).toLocaleDateString('fr-FR')}</span>` : ''}
        </div>

        ${desc}

        <div class="ja-card-footer">
          ${websiteLink}
          <div class="ja-card-btns">
            ${viewBtn}
            ${sendBtn}
          </div>
        </div>
      </div>`;
  }

  // ─── Email Modal ──────────────────────────────────────────────────────────

  private openEmailModal(p: SpontaneousProspect) {
    if (!p.email_body) { this.generateEmail(p); return; }

    this.currentProspectId = p.id;
    this.isEditing = false;
    this.setEditMode(false);

    const modal = document.getElementById('sp-modal');
    const titleEl = document.getElementById('sp-modal-title');
    const subjectText = document.getElementById('sp-modal-subject-text');
    const subjectInput = document.getElementById('sp-modal-subject-input') as HTMLInputElement;
    const body = document.getElementById('sp-modal-body');
    const sendBtn = document.getElementById('sp-send-now');

    if (titleEl) titleEl.textContent = `Email — ${p.company_name}`;
    if (subjectText) subjectText.textContent = p.email_subject ?? '';
    if (subjectInput) subjectInput.value = p.email_subject ?? '';
    if (body) body.textContent = p.email_body;
    if (sendBtn) sendBtn.classList.toggle('visible', p.status === 'pending' && !!p.contact_email);
    if (modal) modal.style.display = 'flex';
  }

  private closeModal() {
    const modal = document.getElementById('sp-modal');
    if (modal) modal.style.display = 'none';
    this.isEditing = false;
    this.setEditMode(false);
    this.currentProspectId = null;
  }

  private async generateEmail(p: SpontaneousProspect) {
    (window as any).showToast?.('info', `Génération en cours pour ${p.company_name}...`);
    try {
      const res = await api.post(`/spontaneous/prospects/${p.id}/generate-email`, {});
      const prospect = this.prospects.find(pr => pr.id === p.id);
      if (prospect) {
        prospect.email_subject = res.data.subject;
        prospect.email_body = res.data.body;
      }
      (window as any).showToast?.('success', 'Email généré');
      this.renderProspects();
      this.openEmailModal({ ...p, email_subject: res.data.subject, email_body: res.data.body });
    } catch (err: any) {
      (window as any).showToast?.('error', err.response?.data?.error || 'Erreur génération');
    }
  }

  private async sendProspect(id: string) {
    try {
      await api.post(`/spontaneous/prospects/${id}/send`);
      const p = this.prospects.find(pr => pr.id === id);
      if (p) p.status = 'sent';
      (window as any).showToast?.('success', 'Email envoyé avec succès');
      this.renderProspects();
    } catch (err: any) {
      (window as any).showToast?.('error', err.response?.data?.error || 'Erreur lors de l\'envoi');
    }
  }

  private async sendFromModal() {
    if (!this.currentProspectId) return;
    await this.sendProspect(this.currentProspectId);
    this.closeModal();
  }

  private async deleteProspect(id: string) {
    try {
      await api.delete(`/spontaneous/prospects/${id}`);
      this.prospects = this.prospects.filter(p => p.id !== id);
      this.renderProspects();
    } catch {
      (window as any).showToast?.('error', 'Erreur suppression');
    }
  }

  // ─── Edit Mode ────────────────────────────────────────────────────────────

  private toggleEditMode() {
    this.isEditing = !this.isEditing;
    this.setEditMode(this.isEditing);
  }

  private setEditMode(editing: boolean) {
    const body = document.getElementById('sp-modal-body');
    const editor = document.getElementById('sp-modal-editor') as HTMLTextAreaElement;
    const subjectWrap = document.getElementById('sp-modal-subject-wrap');
    const subjectInput = document.getElementById('sp-modal-subject-input') as HTMLInputElement;
    const editBtn = document.getElementById('sp-edit-email');
    const saveBtn = document.getElementById('sp-save-email');

    if (!body || !editor) return;

    if (editing) {
      editor.value = body.textContent || '';
      body.style.display = 'none';
      editor.style.display = 'block';
      editor.focus();
      if (subjectWrap) subjectWrap.style.display = 'none';
      if (subjectInput) subjectInput.style.display = 'block';
      if (editBtn) editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Annuler`;
      if (saveBtn) saveBtn.style.display = 'flex';
    } else {
      if (editor.style.display !== 'none') body.textContent = editor.value;
      body.style.display = '';
      editor.style.display = 'none';
      if (subjectWrap) subjectWrap.style.display = '';
      if (subjectInput) subjectInput.style.display = 'none';
      if (editBtn) editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Modifier`;
      if (saveBtn) saveBtn.style.display = 'none';
    }
  }

  private copyEmail() {
    const body = document.getElementById('sp-modal-body');
    const editor = document.getElementById('sp-modal-editor') as HTMLTextAreaElement;
    const text = this.isEditing ? editor?.value : body?.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text);
    (window as any).showToast?.('success', 'Copié dans le presse-papiers');
  }

  private async saveEmail() {
    const editor = document.getElementById('sp-modal-editor') as HTMLTextAreaElement;
    const subjectInput = document.getElementById('sp-modal-subject-input') as HTMLInputElement;
    if (!this.currentProspectId) return;

    const body = editor.value.trim();
    const subject = subjectInput.value.trim();
    if (!body) return;

    const saveBtn = document.getElementById('sp-save-email') as HTMLButtonElement;
    if (saveBtn) saveBtn.disabled = true;

    try {
      await api.patch(`/spontaneous/prospects/${this.currentProspectId}/email`, { subject, body });
      const p = this.prospects.find(pr => pr.id === this.currentProspectId);
      if (p) { p.email_body = body; if (subject) p.email_subject = subject; }
      this.isEditing = false;
      this.setEditMode(false);
      (window as any).showToast?.('success', 'Email sauvegardé');
    } catch {
      (window as any).showToast?.('error', 'Erreur sauvegarde');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }
}
