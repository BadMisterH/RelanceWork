// RelanceWork - Content Script pour Gmail
// Détecte l'envoi d'emails et extrait les informations de candidature

const API_URL = 'http://localhost:3000/api';

// Parser l'objet de l'email pour extraire les informations
function parseEmailSubject(subject) {
  // Formats acceptés (du plus spécifique au plus général):
  // NOTE: Supporte les tirets normaux (-), les tirets longs (–), les deux-points (:)

  // Format 1: "Candidature - Poste - Entreprise" ou "Candidature : Poste - Entreprise"
  // Supporte aussi les tirets longs (–) utilisés par Gmail
  const format1 = /^candidature\s*[-–:]\s*(.+?)\s*[-–:]\s*(.+)$/i;
  let match = subject.match(format1);
  if (match) {
    return {
      poste: match[1].trim(),
      company: match[2].trim(),
      status: 'Candidature envoyée',
      isRelance: false
    };
  }

  // Format 2: "Candidature au poste de [Poste] - [Entreprise]"
  const format2 = /candidature\s*(?:au\s*)?(?:poste\s*)?(?:de\s*)?(.+?)\s*[-–]\s*(.+)/i;
  match = subject.match(format2);
  if (match) {
    return {
      poste: match[1].trim(),
      company: match[2].trim(),
      status: 'Candidature envoyée',
      isRelance: false
    };
  }

  // Format 3: "Suite à ma candidature - [Poste]" (pour les relances)
  const format3 = /suite\s*(?:à|a)\s*ma\s*candidature\s*[-–:]\s*(.+)/i;
  match = subject.match(format3);
  if (match) {
    return {
      poste: match[1].trim(),
      company: '', // On n'a pas l'entreprise dans ce format
      status: 'Relance envoyée',
      isRelance: true
    };
  }

  // Format 4: Ancien format "[CANDIDATURE] Entreprise - Poste" (rétrocompatibilité)
  const format4 = /\[(CANDIDATURE|RELANCE)\]\s*(.+?)\s*[-–]\s*(.+)/i;
  match = subject.match(format4);
  if (match) {
    const type = match[1].toUpperCase();
    return {
      company: match[2].trim(),
      poste: match[3].trim(),
      status: type === 'RELANCE' ? 'Relance envoyée' : 'Candidature envoyée',
      isRelance: type === 'RELANCE'
    };
  }

  return null;
}

// Envoyer les données à l'API RelanceWork
async function sendToAPI(data) {
  try {
    console.log('📤 Envoi vers API:', JSON.stringify(data, null, 2));

    const response = await fetch(`${API_URL}/application`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erreur HTTP ${response.status}:`, errorText);
      throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`);
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

// Récupérer l'email de l'expéditeur (ton email)
function getMyEmail() {
  console.log('🔍 Recherche de l\'email de l\'utilisateur...');

  // Méthode 1: Chercher dans le bouton de compte Google (coin supérieur droit)
  const accountButton = document.querySelector('a[href*="SignOutOptions"], a[aria-label*="Compte Google"]');
  if (accountButton) {
    const email = accountButton.getAttribute('aria-label')?.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0];
    if (email) {
      console.log('✅ Email trouvé via bouton compte:', email);
      return email;
    }
  }

  // Méthode 2: Chercher l'attribut data-email
  const dataEmailElement = document.querySelector('[data-email]');
  if (dataEmailElement) {
    const email = dataEmailElement.getAttribute('data-email');
    if (email) {
      console.log('✅ Email trouvé via data-email:', email);
      return email;
    }
  }

  // Méthode 3: Chercher dans le champ "De" (From) de la fenêtre de composition
  const fromSelectors = [
    '.aoD.hl [email]',  // Gmail compose "From" field
    '[data-hovercard-owner-id]',
    '.gD [email]',
    'span[email][name]'
  ];

  for (const selector of fromSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const email = el.getAttribute('email');
      if (email && email.includes('@')) {
        // Vérifier que c'est dans une zone "De" pas "À"
        const isInFromArea = el.closest('.aoD, .gD, [aria-label*="De"], [aria-label*="From"]');
        if (isInFromArea) {
          console.log('✅ Email trouvé via champ De:', email);
          return email;
        }
      }
    }
  }

  // Méthode 4: Chercher dans le header Gmail (zone utilisateur)
  const headerEmail = document.querySelector('header [data-email], [role="banner"] [data-email]');
  if (headerEmail) {
    const email = headerEmail.getAttribute('data-email');
    if (email) {
      console.log('✅ Email trouvé via header:', email);
      return email;
    }
  }

  // Méthode 5: Chercher via l'image de profil qui contient souvent l'email
  const profileImg = document.querySelector('img[data-hovercard-id*="@"]');
  if (profileImg) {
    const email = profileImg.getAttribute('data-hovercard-id');
    if (email && email.includes('@')) {
      console.log('✅ Email trouvé via image profil:', email);
      return email;
    }
  }

  // Méthode 6: Chercher dans le texte du menu utilisateur
  const userMenu = document.querySelector('[aria-label*="@"], [title*="@"]');
  if (userMenu) {
    const text = userMenu.getAttribute('aria-label') || userMenu.getAttribute('title') || '';
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      console.log('✅ Email trouvé via menu utilisateur:', emailMatch[0]);
      return emailMatch[0];
    }
  }

  // Méthode 7: Chercher tous les éléments avec un attribut contenant un email
  const allElements = document.querySelectorAll('[aria-label], [title], [alt]');
  for (const el of allElements) {
    const attrs = ['aria-label', 'title', 'alt'];
    for (const attr of attrs) {
      const value = el.getAttribute(attr);
      if (value) {
        const emailMatch = value.match(/[\w.-]+@gmail\.com/);
        if (emailMatch) {
          console.log('✅ Email trouvé via attribut', attr + ':', emailMatch[0]);
          return emailMatch[0];
        }
      }
    }
  }

  console.log('⚠️ Aucun email utilisateur trouvé');
  return null;
}

// Extraire l'email du destinataire depuis la fenêtre de composition ACTIVE
function getRecipientEmail() {
  console.log('🔍 Recherche de l\'email du destinataire...');

  // D'abord, récupérer mon propre email pour l'exclure
  const myEmail = getMyEmail();
  console.log('👤 Mon email (à exclure):', myEmail);

  // Méthode 1: Chercher l'input textarea/div où on tape le destinataire
  // Gmail utilise un div avec role="combobox" ou un input pour le champ "À"
  const toInputs = document.querySelectorAll(
    'input[name="to"], ' +
    '[gh="tl"] input, ' +  // Gmail compose "to" field
    '[aria-label="À"] input, ' +
    '[aria-label="To"] input, ' +
    'div[aria-label*="À"][role="combobox"], ' +
    'div[aria-label*="To"][role="combobox"]'
  );

  for (const input of toInputs) {
    if (input.value && input.value.includes('@')) {
      const email = input.value.trim();
      if (email !== myEmail) {
        console.log('✅ Email destinataire trouvé via input "to":', email);
        return email;
      }
    }
  }

  // Méthode 2: Chercher dans les "chips" de destinataires (les bulles avec les noms)
  // Ces chips sont dans un conteneur spécifique avec la classe qui contient le champ À
  const composeBoxes = document.querySelectorAll('.aoD, .aDh, [role="dialog"]');

  for (const box of composeBoxes) {
    // Vérifier que c'est une fenêtre de composition visible
    if (!box.offsetParent) continue;

    // Chercher la zone "À" spécifiquement (première ligne du formulaire)
    const toRow = box.querySelector('.aB, .aoD, [name="to"]')?.closest('tr, div');

    if (toRow) {
      // Chercher les spans avec attribut email DANS cette zone
      const emailSpans = toRow.querySelectorAll('span[email], div[data-hovercard-id]');

      for (const span of emailSpans) {
        const email = span.getAttribute('email') || span.getAttribute('data-hovercard-id');
        if (email && email.includes('@') && email !== myEmail) {
          console.log('✅ Email destinataire trouvé dans zone À:', email);
          return email;
        }
      }
    }
  }

  // Méthode 3: Chercher tous les spans avec email et filtrer
  // En excluant: mon email, les emails dans la zone "De", les emails hors composition
  const allEmailSpans = document.querySelectorAll('span[email]');

  for (const span of allEmailSpans) {
    const email = span.getAttribute('email');

    // Ignorer mon propre email
    if (email === myEmail) continue;

    // Vérifier que c'est dans une fenêtre de composition
    const isInCompose = span.closest('[role="dialog"], .nH.Hd, .AD, .aoP');
    if (!isInCompose) continue;

    // Vérifier que ce n'est PAS dans le champ "De" (From)
    const isInFromField = span.closest('[aria-label*="De"], [aria-label*="From"], .aFm');
    if (isInFromField) continue;

    // Vérifier que c'est visible
    if (!span.offsetParent) continue;

    if (email && email.includes('@')) {
      console.log('✅ Email destinataire trouvé (filtré):', email);
      return email;
    }
  }

  // Méthode 4: Chercher via data-hovercard-id (autre attribut Gmail)
  const hovercardElements = document.querySelectorAll('[data-hovercard-id]');

  for (const el of hovercardElements) {
    const email = el.getAttribute('data-hovercard-id');

    if (!email || !email.includes('@')) continue;
    if (email === myEmail) continue;

    // Vérifier que c'est dans une zone de composition
    const isInCompose = el.closest('[role="dialog"], .aoP, .nH.Hd');
    if (!isInCompose) continue;

    // Exclure la zone "De"
    const isInFromField = el.closest('[aria-label*="De"], [aria-label*="From"]');
    if (isInFromField) continue;

    if (el.offsetParent) {
      console.log('✅ Email destinataire trouvé via hovercard:', email);
      return email;
    }
  }

  console.log('⚠️ Aucun email destinataire détecté');
  return null;
}

// Surveiller les changements dans le champ objet et le destinataire
function watchSubjectField() {
  console.log('🔍 Démarrage de la surveillance du champ objet et destinataire...');

  const checkFields = () => {
    // Capturer l'objet - chercher TOUS les champs possibles
    let currentSubject = null;
    
    const subjectField = document.querySelector('input[name="subjectbox"]');
    if (subjectField && subjectField.value && subjectField.offsetParent !== null) {
      currentSubject = subjectField.value;
    }

    // Chercher aussi dans les inputs avec aria-label contenant "objet" ou "subject"
    if (!currentSubject) {
      const inputs = document.querySelectorAll('input[aria-label*="Objet"], input[aria-label*="Subject"]');
      for (const input of inputs) {
        if (input.value && input.offsetParent !== null) {
          currentSubject = input.value;
          break;
        }
      }
    }

    if (currentSubject && currentSubject !== lastSubjectBeforeSend) {
      lastSubjectBeforeSend = currentSubject;
      console.log('📌 Objet capturé:', lastSubjectBeforeSend);
    }

    // Capturer l'email du destinataire
    const recipientEmail = getRecipientEmail();
    if (recipientEmail && recipientEmail !== lastRecipientEmail) {
      lastRecipientEmail = recipientEmail;
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

  // Ajouter l'email de l'expéditeur (utilisateur) pour les rappels
  const userEmail = getMyEmail();
  if (userEmail) {
    parsed.userEmail = userEmail;
    console.log('👤 Email utilisateur ajouté:', userEmail);
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
