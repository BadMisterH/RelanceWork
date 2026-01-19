import type { Application } from "../main.ts";

export class UI {
  applicationsList: HTMLElement | null;
  private allApplications: Application[] = [];
  private currentFilter: string = "all";
  private searchQuery: string = "";

  constructor() {
    this.applicationsList = document.getElementById("applicationsList");
    this.initFilters();
    this.initSearch();
    this.initForm();
  }

  // Vérifier si la candidature a plus de X jours
  private static DAYS_BEFORE_RELANCE = 3;

  private isOlderThanXDays(dateStr: string): boolean {
    // Format de date: DD/MM/YYYY
    const [day, month, year] = dateStr.split("/").map(Number);
    const applicationDate = new Date(year, month - 1, day);
    const today = new Date();
    const diffTime = today.getTime() - applicationDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= UI.DAYS_BEFORE_RELANCE;
  }

  // Calculer le nombre de jours depuis la candidature
  private getDaysSince(dateStr: string): number {
    const [day, month, year] = dateStr.split("/").map(Number);
    const applicationDate = new Date(year, month - 1, day);
    const today = new Date();
    const diffTime = today.getTime() - applicationDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  // Générer le lien mailto pour la relance
  private generateMailtoLink(element: Application): string {
    const subject = encodeURIComponent(
      `Suite à ma candidature - ${element.poste}`
    );
    const body = encodeURIComponent(
      `Bonjour,

Je me permets de revenir vers vous concernant ma candidature pour le poste de ${element.poste} au sein de ${element.company}, envoyée le ${element.date}.

Toujours très intéressé par cette opportunité, je souhaitais savoir si vous aviez eu l'occasion d'examiner mon dossier.

Je reste à votre entière disposition pour un entretien à votre convenance.

Dans l'attente de votre retour, je vous prie d'agréer mes salutations distinguées.

Cordialement`
    );
    return `mailto:${element.email}?subject=${subject}&body=${body}`;
  }

  getAffichage(dataAffichage: Application[]) {
    if (!this.applicationsList) return;

    // Stocker les données pour les filtres
    this.allApplications = dataAffichage;

    // Mettre à jour les stats
    this.updateStats();

    // Rendre les candidatures
    this.renderApplications(dataAffichage);
  }

  private attachDeleteEvents() {
    const buttons = document.querySelectorAll(".btn-delete");

    buttons.forEach((button) => {
      button.addEventListener("click", async (e) => {
        const target = e.target as HTMLButtonElement;
        const id = target.getAttribute("data-id");
        const card = target.closest(".box-candidature");
        const companyName = card?.querySelector("h2")?.textContent || "cette candidature";

        if (id) {
          const confirmed = confirm(`Êtes-vous sûr de vouloir supprimer la candidature chez ${companyName} ?`);

          if (!confirmed) return;

          const result = await fetch(
            `http://localhost:3000/api/applications/${id}`,
            {
              method: "DELETE",
            }
          );
          if (result.ok) {
            card?.remove();
          }
        }
      });
    });
  }

  // Méthode pour gérer les événements des checkboxes
  private attachRelanceEvents() {
    const checkboxes = document.querySelectorAll(".relance-checkbox");

    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", async (e) => {
        const target = e.target as HTMLInputElement;
        const id = target.getAttribute("data-id");
        const email = target.getAttribute("data-email");
        const company = target.getAttribute("data-company");
        const poste = target.getAttribute("data-poste");
        const date = target.getAttribute("data-date");
        const isChecked = target.checked;

        if (id) {
          await this.updateRelanceStatus(parseInt(id), isChecked ? 1 : 0);

          // Afficher/masquer le bouton de relance dynamiquement
          const relanceActions = document.getElementById(
            `relance-actions-${id}`
          );
          const boxCandidature = target.closest(".box-candidature");

          if (relanceActions && email) {
            if (isChecked) {
              // Générer le lien mailto dynamiquement
              const mailtoLink = this.generateMailtoLink({
                id: parseInt(id),
                company: company || "",
                poste: poste || "",
                status: "",
                date: date || "",
                relanced: 1,
                email: email,
              });
              relanceActions.innerHTML = `
                <a href="${mailtoLink}" class="btn-relance">
                  Envoyer la relance
                </a>
              `;
              relanceActions.style.display = "block";
              boxCandidature?.classList.add("needs-relance");
            } else {
              relanceActions.style.display = "none";
              boxCandidature?.classList.remove("needs-relance");
            }
          } else if (!email && isChecked) {
            // Afficher un message si pas d'email
            alert(
              "Attention: Aucun email n'est associé à cette candidature. Ajoutez un email pour pouvoir envoyer une relance."
            );
          }
        }
      });
    });
  }

  // Méthode pour mettre à jour le statut de relance via l'API
  private async updateRelanceStatus(id: number, relanced: number) {
    try {
      const API_URL = "http://localhost:3000/api";
      const response = await fetch(`${API_URL}/applications/${id}/relance`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ relanced }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la mise à jour");
      }

      const data = await response.json();
      console.log("Statut de relance mis à jour:", data);
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      alert("Erreur lors de la mise à jour du statut de relance");
    }
  }

  // Mettre à jour les statistiques
  private updateStats() {
    const total = this.allApplications.length;
    const pending = this.allApplications.filter(app => app.status === "En attente").length;
    const relance = this.allApplications.filter(app => app.relanced === 1).length;
    const nomail = this.allApplications.filter(app => !app.email).length;

    const statTotal = document.querySelector("#stat-total .stat-number");
    const statPending = document.querySelector("#stat-pending .stat-number");
    const statRelance = document.querySelector("#stat-relance .stat-number");
    const statNomail = document.querySelector("#stat-nomail .stat-number");

    if (statTotal) statTotal.textContent = String(total);
    if (statPending) statPending.textContent = String(pending);
    if (statRelance) statRelance.textContent = String(relance);
    if (statNomail) statNomail.textContent = String(nomail);
  }

  // Initialiser les filtres
  private initFilters() {
    const filterButtons = document.querySelectorAll(".filter-btn");

    filterButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.target as HTMLButtonElement;
        const filter = target.getAttribute("data-filter") || "all";

        // Mettre à jour le bouton actif
        filterButtons.forEach((b) => b.classList.remove("active"));
        target.classList.add("active");

        this.currentFilter = filter;
        this.applyFilters();
      });
    });
  }

  // Initialiser la recherche
  private initSearch() {
    const searchInput = document.getElementById("searchInput") as HTMLInputElement;

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const target = e.target as HTMLInputElement;
        this.searchQuery = target.value.toLowerCase();
        this.applyFilters();
      });
    }
  }

  // Appliquer les filtres et la recherche
  private applyFilters() {
    let filtered = [...this.allApplications];

    // Appliquer le filtre de statut
    if (this.currentFilter === "pending") {
      filtered = filtered.filter(app => app.status === "En attente");
    } else if (this.currentFilter === "relance") {
      filtered = filtered.filter(app => app.relanced === 1);
    }

    // Appliquer la recherche
    if (this.searchQuery) {
      filtered = filtered.filter(app =>
        app.company.toLowerCase().includes(this.searchQuery) ||
        app.poste.toLowerCase().includes(this.searchQuery)
      );
    }

    this.renderApplications(filtered);
  }

  // Initialiser le formulaire
  private initForm() {
    const toggleBtn = document.getElementById("toggleFormBtn");
    const form = document.getElementById("addApplicationForm") as HTMLFormElement;
    const cancelBtn = document.getElementById("cancelFormBtn");

    if (toggleBtn && form) {
      toggleBtn.addEventListener("click", () => {
        form.classList.toggle("hidden");
        toggleBtn.textContent = form.classList.contains("hidden")
          ? "+ Ajouter une candidature"
          : "- Fermer le formulaire";
      });
    }

    if (cancelBtn && form) {
      cancelBtn.addEventListener("click", () => {
        form.classList.add("hidden");
        form.reset();
        if (toggleBtn) toggleBtn.textContent = "+ Ajouter une candidature";
      });
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleFormSubmit(form);
      });
    }
  }

  // Gérer la soumission du formulaire
  private async handleFormSubmit(form: HTMLFormElement) {
    const formData = new FormData(form);
    const data = {
      company: formData.get("company") as string,
      poste: formData.get("poste") as string,
      email: formData.get("email") as string || undefined,
      status: formData.get("status") as string,
      isRelance: false,
    };

    try {
      const API_URL = "http://localhost:3000/api";
      const response = await fetch(`${API_URL}/application`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l'ajout");
      }

      const result = await response.json();
      console.log("Candidature ajoutée:", result);

      // Ajouter à la liste et rafraîchir
      if (result.data) {
        this.allApplications.unshift(result.data);
        this.updateStats();
        this.applyFilters();
      }

      // Réinitialiser le formulaire
      form.reset();
      form.classList.add("hidden");
      const toggleBtn = document.getElementById("toggleFormBtn");
      if (toggleBtn) toggleBtn.textContent = "+ Ajouter une candidature";

    } catch (error) {
      console.error("Erreur lors de l'ajout:", error);
      alert("Erreur lors de l'ajout de la candidature");
    }
  }

  // Rendre les candidatures (séparé de getAffichage pour les filtres)
  private renderApplications(applications: Application[]) {
    if (!this.applicationsList) return;

    if (applications.length === 0) {
      this.applicationsList.innerHTML = `
        <div class="empty-state">
          <p>Aucune candidature trouvée</p>
          <span>Ajoutez votre première candidature ou modifiez vos filtres</span>
        </div>
      `;
      return;
    }

    this.applicationsList.innerHTML = applications
      .map((element: Application) => {
        const isChecked = element.relanced === 1;
        const hasEmail = !!element.email;
        const isOldEnough = this.isOlderThanXDays(element.date);
        const showRelanceButton = isChecked && hasEmail && isOldEnough;
        const daysSince = this.getDaysSince(element.date);

        return `<div class="box-candidature ${showRelanceButton ? "needs-relance" : ""}">
        <h2>${element.company}</h2>
        <ul>
          <li>${element.poste}</li>
          ${element.email ? `<li>Email: ${element.email}</li>` : ""}
          <li><span class="status-badge ${this.getStatusClass(element.status)}">${element.status}</span></li>
          <li>${element.date} (${daysSince} jour${daysSince > 1 ? "s" : ""})</li>
          <li>
            <label class="relance-checkbox-label">
              <input
                type="checkbox"
                class="relance-checkbox"
                data-id="${element.id}"
                data-email="${element.email || ""}"
                data-company="${element.company}"
                data-poste="${element.poste}"
                data-date="${element.date}"
                ${isChecked ? "checked" : ""}
              />
              À relancer
            </label>
          </li>
        </ul>
        <div class="relance-actions" id="relance-actions-${element.id}" style="display: ${showRelanceButton ? "block" : "none"};">
          <a href="${this.generateMailtoLink(element)}" class="btn-relance">
            Envoyer la relance
          </a>
        </div>
        ${!hasEmail && isChecked ? '<span class="badge-no-email">Email manquant</span>' : ""}
        <button class="btn-delete" data-id="${element.id}">Supprimer</button>
        </div>
        `;
      })
      .join("");

    this.attachRelanceEvents();
    this.attachDeleteEvents();
  }

  // Obtenir la classe CSS du statut
  private getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      "En attente": "en-attente",
      "Entretien prévu": "en-attente",
      "Relancé": "relance",
      "Refusé": "refuse",
      "Accepté": "accepte",
    };
    return statusMap[status] || "en-attente";
  }
}
