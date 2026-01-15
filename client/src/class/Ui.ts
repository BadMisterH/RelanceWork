import type { Application } from "../main.ts";

export class UI {
  applicationsList: HTMLElement | null;

  constructor() {
    // Initialiser les propriétés ICI
    this.applicationsList = document.getElementById("applicationsList");
  }

  // Vérifier si la candidature a plus de X jours
  // TODO: Remettre à 3 jours après les tests
  private static DAYS_BEFORE_RELANCE = 0; // Mettre 3 en production

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
      `[RELANCE] ${element.company} - ${element.poste}`
    );
    const body = encodeURIComponent(
      `Bonjour,

Je me permets de revenir vers vous concernant ma candidature pour le poste de ${element.poste} envoyée le ${element.date}.

Je reste très motivé par cette opportunité et serais ravi d'échanger avec vous sur ma candidature.

Je me tiens à votre disposition pour un entretien à votre convenance.

Cordialement`
    );
    return `mailto:${element.email}?subject=${subject}&body=${body}`;
  }

  getAffichage(dataAffichage: Application[]) {
    if (!this.applicationsList) return;

    this.applicationsList.innerHTML = dataAffichage
      .map((element: Application) => {
        const isChecked = element.relanced === 1;
        const hasEmail = !!element.email;
        const isOldEnough = this.isOlderThanXDays(element.date);
        // Afficher le bouton de relance si: case cochée + email présent + assez de jours passés
        const showRelanceButton = isChecked && hasEmail && isOldEnough;
        const daysSince = this.getDaysSince(element.date);

        return `<ul class="box-candidature ${showRelanceButton ? "needs-relance" : ""}">
        <h2>${element.company}</h2>
        <li>${element.poste}</li>
        ${element.email ? `<li>Email: ${element.email}</li>` : ""}
        <li>${element.status}</li>
        <li>${element.date} (${daysSince} jour${daysSince > 1 ? "s" : ""})</li>
        <li>
          <label>
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
        <div class="relance-actions" id="relance-actions-${element.id}" style="display: ${showRelanceButton ? "block" : "none"};">
          <a href="${this.generateMailtoLink(element)}" class="btn-relance">
            Envoyer la relance
          </a>
        </div>
        ${!hasEmail && isChecked ? '<span class="badge-no-email">Email manquant</span>' : ""}
        <button class="btn-delete" data-id="${element.id}">DELETE</button>
        </ul>
        `;
      })
      .join("");

    // Attacher les événements pour les checkboxes
    this.attachRelanceEvents();
    this.attachDeleteEvents();
  }

  private attachDeleteEvents() {
    const buttons = document.querySelectorAll(".btn-delete");

    buttons.forEach((buttons) => {
      buttons.addEventListener("click", async (e) => {
        const target = e.target as HTMLButtonElement;
        const id = target.getAttribute("data-id");

        if (id) {
          const result = await fetch(
            `http://localhost:3000/api/applications/${id}`,
            {
              method: "DELETE",
            }
          );
          if (result.ok) {
            const card = target.closest(".box-candidature");
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
}
