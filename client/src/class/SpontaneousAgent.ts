import api from '../lib/api';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const PROFILE_KEY = 'relancework-spont-profile';

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
  private isSearching = false;
  private currentProspectId: string | null = null;
  private isEditing = false;
  private cvFile: File | null = null;        // Fichier CV pour l'envoi (pièce jointe)
  private cvBase64: string | null = null;    // CV en base64

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
    const savedProfile = localStorage.getItem(PROFILE_KEY) || '';
    return `
      <div class="ja-layout">
        <!-- Left: Form -->
        <div class="ja-panel">
          <div class="ja-panel-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <h3>Candidatures spontanées</h3>
          </div>

          <div class="ja-form">
            <!-- Source -->
            <div class="ja-field">
              <label>Source des entreprises</label>
              <select id="sp-source">
                <option value="indeed">Indeed — extraire les entreprises d'offres d'emploi</option>
                <option value="jsearch">JSearch — LinkedIn + Indeed + Glassdoor</option>
                <option value="manual">Liste manuelle</option>
              </select>
            </div>

            <!-- Keyword / Location (caché en mode manual) -->
            <div id="sp-auto-fields">
              <div class="ja-field-row">
                <div class="ja-field">
                  <label>Secteur / Poste cible</label>
                  <input id="sp-keyword" type="text" placeholder="Ex: startup tech, agence web..." />
                </div>
                <div class="ja-field">
                  <label>Localisation</label>
                  <input id="sp-location" type="text" value="Paris" />
                </div>
              </div>
            </div>

            <!-- Liste manuelle (cachée par défaut) -->
            <div id="sp-manual-fields" style="display:none">
              <div class="ja-field">
                <label>Entreprises <span class="ja-label-hint">(une par ligne : Nom, domaine.fr)</span></label>
                <textarea id="sp-manual-list" rows="5" placeholder="Google, google.fr&#10;Doctolib, doctolib.fr&#10;Contentsquare"></textarea>
              </div>
            </div>

            <!-- Poste visé -->
            <div class="ja-field">
              <label>Poste visé <span class="ja-label-hint">(optionnel)</span></label>
              <input id="sp-role" type="text" placeholder="Ex: Développeur React, Product Manager..." />
            </div>

            <!-- CV texte (profil) -->
            <div class="ja-field">
              <label>CV <span class="ja-label-hint">(PDF — texte extrait pour l'IA)</span></label>
              <div class="ja-cv-drop" id="sp-cv-drop">
                <input type="file" id="sp-cv-input" accept=".pdf" style="display:none" />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                <span id="sp-cv-label">${savedProfile ? 'CV importé — cliquer pour changer' : 'Déposer votre CV (PDF) ou <u>cliquer ici</u>'}</span>
                <span class="ja-cv-hint" id="sp-cv-status" style="color:${savedProfile ? '#10b981' : ''}">${savedProfile ? savedProfile.length + ' car. en mémoire' : ''}</span>
              </div>
            </div>

            <!-- Options envoi -->
            <div class="sp-send-options">
              <label class="ja-checkbox-label">
                <input type="checkbox" id="sp-auto-send" />
                Envoyer automatiquement les emails (Gmail requis)
              </label>
              <div id="sp-attach-note" class="sp-attach-note" style="display:none">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
                CV joint en pièce jointe à l'envoi
              </div>
            </div>

            <textarea id="sp-profile" style="display:none">${savedProfile}</textarea>

            <button class="ja-search-btn" id="sp-search-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Lancer la recherche
            </button>
          </div>

          <div class="ja-loading" id="sp-loading" style="display:none">
            <div class="ja-spinner"></div>
            <p id="sp-loading-msg">Découverte des entreprises...</p>
          </div>
        </div>

        <!-- Right: Results -->
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
              <p>Lance une recherche pour générer tes candidatures spontanées</p>
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

          <!-- Subject display -->
          <div class="sp-modal-subject" id="sp-modal-subject-wrap">
            <span class="sp-subject-label">Objet :</span>
            <span id="sp-modal-subject-text"></span>
          </div>
          <input class="sp-modal-subject-input" id="sp-modal-subject-input" type="text" style="display:none" placeholder="Objet de l'email" />

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
            <button class="ja-btn-primary" id="sp-send-now" style="display:none">
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
    document.getElementById('sp-search-btn')?.addEventListener('click', () => this.startSearch());
    document.getElementById('sp-modal-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('sp-copy-email')?.addEventListener('click', () => this.copyEmail());
    document.getElementById('sp-edit-email')?.addEventListener('click', () => this.toggleEditMode());
    document.getElementById('sp-save-email')?.addEventListener('click', () => this.saveEmail());
    document.getElementById('sp-send-now')?.addEventListener('click', () => this.sendFromModal());

    document.getElementById('sp-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'sp-modal') this.closeModal();
    });

    document.getElementById('sp-filter-status')?.addEventListener('change', () => this.renderProspects());

    // Source toggle
    document.getElementById('sp-source')?.addEventListener('change', () => this.toggleSourceFields());

    // Auto-send toggle
    document.getElementById('sp-auto-send')?.addEventListener('change', () => {
      const checked = (document.getElementById('sp-auto-send') as HTMLInputElement).checked;
      const note = document.getElementById('sp-attach-note');
      if (note) note.style.display = checked && this.cvFile ? 'flex' : 'none';
    });

    // PDF Upload
    const dropZone = document.getElementById('sp-cv-drop');
    const fileInput = document.getElementById('sp-cv-input') as HTMLInputElement;
    dropZone?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) this.handlePdfFile(file);
    });
    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('ja-cv-drop-active');
    });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('ja-cv-drop-active'));
    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('ja-cv-drop-active');
      const file = (e as DragEvent).dataTransfer?.files?.[0];
      if (file?.type === 'application/pdf') this.handlePdfFile(file);
    });
  }

  private toggleSourceFields() {
    const source = (document.getElementById('sp-source') as HTMLSelectElement).value;
    const autoFields = document.getElementById('sp-auto-fields');
    const manualFields = document.getElementById('sp-manual-fields');
    if (autoFields) autoFields.style.display = source === 'manual' ? 'none' : '';
    if (manualFields) manualFields.style.display = source === 'manual' ? '' : 'none';
  }

  // ─── PDF Handling ─────────────────────────────────────────────────────────

  private async handlePdfFile(file: File) {
    const statusEl = document.getElementById('sp-cv-status');
    const labelEl = document.getElementById('sp-cv-label');
    if (labelEl) labelEl.textContent = `Lecture de "${file.name}"...`;

    try {
      const text = await this.extractPdfText(file);
      const textarea = document.getElementById('sp-profile') as HTMLTextAreaElement;
      if (textarea) textarea.value = text;
      localStorage.setItem(PROFILE_KEY, text);

      // Stocker le fichier pour la pièce jointe
      this.cvFile = file;
      this.cvBase64 = await this.fileToBase64(file);

      if (labelEl) labelEl.innerHTML = `<strong>${file.name}</strong> importé`;
      if (statusEl) {
        statusEl.textContent = `${text.length} caractères + pièce jointe prête`;
        statusEl.style.color = '#10b981';
      }

      // Afficher note d'attachement si autoSend est coché
      const autoSend = (document.getElementById('sp-auto-send') as HTMLInputElement)?.checked;
      const note = document.getElementById('sp-attach-note');
      if (note) note.style.display = autoSend ? 'flex' : 'none';

    } catch {
      if (labelEl) labelEl.innerHTML = `Déposer votre CV (PDF) ou <u>cliquer ici</u>`;
      if (statusEl) { statusEl.textContent = 'Erreur de lecture du PDF'; statusEl.style.color = '#ef4444'; }
    }
  }

  private async extractPdfText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => item.str).join(' ').replace(/\s+/g, ' ').trim();
      if (text) parts.push(text);
    }
    return parts.join('\n\n').substring(0, 6000);
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data URL prefix: "data:application/pdf;base64,"
        const base64 = result.split(',')[1] ?? '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  private async startSearch() {
    if (this.isSearching) return;

    const source = (document.getElementById('sp-source') as HTMLSelectElement)?.value || 'indeed';
    const keyword = (document.getElementById('sp-keyword') as HTMLInputElement)?.value.trim();
    const location = (document.getElementById('sp-location') as HTMLInputElement)?.value.trim() || 'France';
    const targetRole = (document.getElementById('sp-role') as HTMLInputElement)?.value.trim();
    const autoSend = (document.getElementById('sp-auto-send') as HTMLInputElement)?.checked;
    const cvText = (document.getElementById('sp-profile') as HTMLTextAreaElement)?.value.trim();
    const manualRaw = (document.getElementById('sp-manual-list') as HTMLTextAreaElement)?.value.trim();

    if (!cvText) { (window as any).showToast?.('warning', 'Importez votre CV PDF'); return; }
    if (source !== 'manual' && !keyword) { (window as any).showToast?.('warning', 'Entrez un secteur/poste cible'); return; }

    // Parser les entreprises manuelles
    let manualCompanies: Array<{ name: string; domain?: string }> = [];
    if (source === 'manual') {
      if (!manualRaw) { (window as any).showToast?.('warning', 'Entrez au moins une entreprise'); return; }
      manualCompanies = manualRaw.split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const parts = line.split(',').map(p => p.trim());
          return { name: parts[0] ?? line, domain: parts[1] };
        });
    }

    this.setLoading(true, 'Découverte des entreprises...');

    try {
      const payload: Record<string, any> = {
        source, location, userProfile: cvText, targetRole: targetRole || undefined, autoSend,
      };
      if (source !== 'manual') { payload['keyword'] = keyword; payload['maxPages'] = 1; }
      else { payload['manualCompanies'] = manualCompanies; }
      if (autoSend && this.cvBase64 && this.cvFile) {
        payload['cvBase64'] = this.cvBase64;
        payload['cvFileName'] = this.cvFile.name;
      }

      const res = await api.post('/spontaneous/search', payload);
      const r = res.data.result;
      this.setLoading(false);
      (window as any).showToast?.('success',
        `${r.saved} prospect(s) sauvegardés${r.sent ? ` · ${r.sent} email(s) envoyés` : ''}`
      );
      await this.loadProspects();
    } catch (err: any) {
      this.setLoading(false);
      (window as any).showToast?.('error', err.response?.data?.error || 'Erreur lors de la recherche');
    }
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
          <p>Aucun prospect pour le moment — lance une recherche</p>
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
    const statusConfig: Record<string, { color: string; label: string }> = {
      pending:  { color: '#f59e0b', label: 'En attente' },
      sent:     { color: '#10b981', label: 'Envoyé' },
      failed:   { color: '#ef4444', label: 'Échec' },
      replied:  { color: '#6366f1', label: 'Répondu' },
      rejected: { color: '#94a3b8', label: 'Refusé' },
    };
    const sc = statusConfig[p.status] ?? statusConfig['pending']!;

    const favicon = p.company_favicon
      ? `<img src="${p.company_favicon}" width="16" height="16" style="border-radius:3px;margin-right:6px" onerror="this.style.display='none'" />`
      : '';

    const emailInfo = p.contact_email
      ? `<span class="sp-card-email">📧 ${p.contact_email}</span>`
      : `<span class="sp-card-email sp-no-email">Pas d'email trouvé</span>`;

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
      <div class="ja-card">
        <div class="ja-card-top">
          <div class="ja-card-score" style="background:${sc.color};font-size:10px;min-width:60px;padding:4px 8px">
            ${sc.label}
          </div>
          <div class="ja-card-info">
            <div class="ja-card-title">${favicon}${p.company_name}</div>
            ${emailInfo}
            ${p.sent_at ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">Envoyé le ${new Date(p.sent_at).toLocaleDateString('fr-FR')}</div>` : ''}
          </div>
          <div class="ja-card-actions-top">
            <button class="ja-icon-btn" id="sp-delete-${p.id}" title="Supprimer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              </svg>
            </button>
          </div>
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
    if (sendBtn) sendBtn.style.display = (p.status === 'pending' && !!p.contact_email) ? 'flex' : 'none';
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
    const cvText = (document.getElementById('sp-profile') as HTMLTextAreaElement)?.value.trim()
      || localStorage.getItem(PROFILE_KEY) || '';
    const targetRole = (document.getElementById('sp-role') as HTMLInputElement)?.value.trim();

    if (!cvText) { (window as any).showToast?.('warning', 'Importez votre CV pour générer l\'email'); return; }

    (window as any).showToast?.('info', `Génération en cours pour ${p.company_name}...`);

    try {
      const res = await api.post(`/spontaneous/prospects/${p.id}/generate-email`, {
        userProfile: cvText, targetRole: targetRole || undefined,
      });
      // Mettre à jour localement
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
      await api.post(`/spontaneous/prospects/${id}/send`, {
        cvBase64: this.cvBase64 || undefined,
        cvFileName: this.cvFile?.name,
      });
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
      body.style.display = 'block';
      editor.style.display = 'none';
      if (subjectWrap) subjectWrap.style.display = 'flex';
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

  // ─── Utils ────────────────────────────────────────────────────────────────

  private setLoading(loading: boolean, msg = '') {
    this.isSearching = loading;
    const btn = document.getElementById('sp-search-btn') as HTMLButtonElement;
    const loadingEl = document.getElementById('sp-loading');
    const msgEl = document.getElementById('sp-loading-msg');
    if (btn) btn.disabled = loading;
    if (loadingEl) loadingEl.style.display = loading ? 'flex' : 'none';
    if (msgEl) msgEl.textContent = msg;
  }
}
