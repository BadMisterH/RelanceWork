// RelanceWork - Content Script pour Gmail
// Détecte l'envoi d'emails et extrait les informations de candidature

const API_URL = 'http://localhost:3000/api';

// Parser l'objet de l'email pour extraire les informations
function parseEmailSubject(subject) {
  // Format attendu: [CANDIDATURE] Entreprise - Poste
  // ou: [RELANCE] Entreprise - Poste
  const regex = /\[(CANDIDATURE|RELANCE)\]\s*(.+?)\s*-\s*(.+)/i;
  const match = subject.match(regex);

  if (!match) {
    return null;
  }

  const type = match[1].toUpperCase();
  const company = match[2].trim();
  const poste = match[3].trim();

  return {
    company,
    poste,
    status: type === 'RELANCE' ? 'Relance envoyée' : 'Candidature envoyée',
    isRelance: type === 'RELANCE'
  };
}

// Envoyer les données à l'API RelanceWork
async function sendToAPI(data) {
  try {
    const response = await fetch(`${API_URL}/application`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Candidature ajoutée à RelanceWork:', result);
    return result;
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi à l\'API:', error);
    throw error;
  }
}

// Afficher une notification dans Gmail
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background-color: ${type === 'success' ? '#4CAF50' : '#f44336'};
    color: white;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    max-width: 300px;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transition = 'opacity 0.5s';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 500);
  }, 4000);
}

// Variables globales pour stocker l'objet et l'email avant l'envoi
let lastSubjectBeforeSend = null;
let lastRecipientEmail = null;

// Extraire l'email du destinataire UNIQUEMENT depuis la fenêtre de composition ACTIVE
function getRecipientEmail() {
  // Trouver le champ objet actuellement actif/visible
  const subjectField = document.querySelector('input[name="subjectbox"]');
  if (!subjectField) {
    return null;
  }

  // Chercher le textarea "À" (destinataires) qui est AVANT le champ objet dans le DOM
  // On remonte dans le DOM puis on cherche uniquement dans la zone "to"
  const form = subjectField.closest('form');
  if (!form) {
    return null;
  }

  // Méthode 1: Chercher le div avec name="to" (zone des destinataires)
  const toField = form.querySelector('[name="to"]');
  if (toField) {
    // Chercher span[email] uniquement dans cette zone
    const emailSpan = toField.querySelector('span[email]');
    if (emailSpan) {
      const email = emailSpan.getAttribute('email');
      console.log('✅ Email trouvé dans zone TO:', email);
      return email;
    }

    // Si pas trouvé, chercher data-hovercard-id
    const hovercardElement = toField.querySelector('[data-hovercard-id*="@"]');
    if (hovercardElement) {
      const email = hovercardElement.getAttribute('data-hovercard-id');
      console.log('✅ Email trouvé via hovercard:', email);
      return email;
    }

    // Dernière chance: chercher un email dans le texte
    const spans = toField.querySelectorAll('span');
    for (const span of spans) {
      const text = span.textContent || '';
      const match = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (match) {
        console.log('✅ Email trouvé dans texte:', match[1]);
        return match[1];
      }
    }
  }

  return null;
}

// Surveiller les changements dans le champ objet et le destinataire
function watchSubjectField() {
  console.log('🔍 Démarrage de la surveillance du champ objet et destinataire...');

  let lastSubject = null;
  let lastEmail = null;

  const checkFields = () => {
    // Capturer l'objet
    const subjectField = document.querySelector('input[name="subjectbox"]');
    if (subjectField && subjectField.value) {
      if (lastSubjectBeforeSend !== subjectField.value) {
        lastSubjectBeforeSend = subjectField.value;
        console.log('📌 Objet capturé:', lastSubjectBeforeSend);
      }
    }

    // Capturer l'email du destinataire (sans spam de console.log)
    const recipientEmail = getRecipientEmail();
    if (recipientEmail && recipientEmail !== lastEmail) {
      lastRecipientEmail = recipientEmail;
      lastEmail = recipientEmail;
      console.log('📧 Email destinataire capturé:', lastRecipientEmail);
    }
  };

  // Vérifier toutes les 500ms (plus réactif)
  setInterval(checkFields, 500);

  // Vérifier immédiatement aussi
  checkFields();
}

// Détecter l'envoi d'email
function detectEmailSend() {
  // Observer les changements dans le DOM pour détecter l'envoi
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        // Vérifier si c'est un message de confirmation d'envoi
        if (node.nodeType === 1 && node.textContent) {
          const text = node.textContent.toLowerCase();

          // Gmail affiche "Message envoyé" ou "Votre message a été envoyé"
          if (text.includes('message envoyé') || text.includes('message sent')) {
            console.log('📧 Email envoyé détecté !');

            // Utiliser l'objet et l'email stockés
            if (lastSubjectBeforeSend) {
              console.log('📝 Utilisation de l\'objet stocké:', lastSubjectBeforeSend);
              console.log('📧 Email destinataire:', lastRecipientEmail);
              processEmailSubject(lastSubjectBeforeSend, lastRecipientEmail);
              lastSubjectBeforeSend = null; // Réinitialiser
              lastRecipientEmail = null; // Réinitialiser
            } else {
              console.log('⚠️ Aucun objet stocké trouvé');
            }
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('👀 RelanceWork: Surveillance des emails activée');
}

// Récupérer l'objet du dernier email envoyé
function getLastSentEmailSubject() {
  // Essayer de récupérer depuis le formulaire de composition
  const subjectField = document.querySelector('input[name="subjectbox"]');

  if (subjectField && subjectField.value) {
    return subjectField.value;
  }

  // Fallback: chercher dans les emails récents envoyés
  const sentEmails = document.querySelectorAll('[data-legacy-thread-id]');
  if (sentEmails.length > 0) {
    const lastEmail = sentEmails[0];
    const subjectElement = lastEmail.querySelector('[data-legacy-last-message-subject]');
    if (subjectElement) {
      return subjectElement.getAttribute('data-legacy-last-message-subject');
    }
  }

  return null;
}

// Traiter l'objet de l'email
async function processEmailSubject(subject, recipientEmail) {
  console.log('📝 Objet de l\'email:', subject);
  console.log('📧 Email du destinataire:', recipientEmail);

  const parsed = parseEmailSubject(subject);
  //detecter le format de l'objet du mail

  if (!parsed) {
    console.log('ℹ️ Email ignoré (format non reconnu)');
    return;
  }

  console.log('✨ Candidature détectée:', parsed);

  // Ajouter l'email du destinataire aux données
  if (recipientEmail) {
    parsed.email = recipientEmail;
  }

  try {
    await sendToAPI(parsed);
    showNotification(
      `✅ Candidature "${parsed.company}" ajoutée à RelanceWork !`,
      'success'
    );
  } catch (error) {
    showNotification(
      `❌ Erreur: impossible d'ajouter la candidature`,
      'error'
    );
  }
}

// Alternative: Observer le bouton d'envoi directement
function observeSendButton() {
  // Chercher le bouton d'envoi
  const findSendButton = () => {
    return document.querySelector('[data-tooltip*="Envoyer"], [aria-label*="Envoyer"], [aria-label*="Send"]');
  };

  const attachListener = () => {
    const sendButton = findSendButton();

    if (sendButton && !sendButton.hasAttribute('data-relancework-listener')) {
      sendButton.setAttribute('data-relancework-listener', 'true');

      sendButton.addEventListener('click', () => {
        const subjectField = document.querySelector('input[name="subjectbox"]');
        const recipientEmail = getRecipientEmail();

        if (subjectField && subjectField.value) {
          const subject = subjectField.value;
          console.log('🎯 Objet capturé au clic:', subject);
          console.log('📧 Email capturé au clic:', recipientEmail);

          // Traiter après un court délai pour s'assurer que l'email est envoyé
          setTimeout(() => {
            console.log('⏰ Traitement de l\'objet après délai');
            processEmailSubject(subject, recipientEmail);
          }, 1000);
        } else {
          console.log('❌ Pas de champ objet trouvé ou vide');
        }
      });

      console.log('✅ Listener attaché au bouton Envoyer');
    }
  };

  // Observer l'apparition du bouton d'envoi
  const observer = new MutationObserver(() => {
    attachListener();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Essayer immédiatement
  attachListener();
}

// Initialisation
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    detectEmailSend();
    observeSendButton();
    watchSubjectField();
  });
} else {
  detectEmailSend();
  observeSendButton();
  watchSubjectField();
}

console.log('🚀 RelanceWork Extension chargée !');
