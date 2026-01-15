# 📚 Guide d'Utilisation - RelanceWork Extension

## 🎯 Comment ça marche ?

L'extension **détecte automatiquement** quand vous envoyez un email de candidature depuis Gmail et l'ajoute à votre base RelanceWork.

---

## 📝 Format de l'objet de l'email

### Pour une nouvelle candidature

```
[CANDIDATURE] Nom de l'entreprise - Intitulé du poste
```

**Exemples :**
- `[CANDIDATURE] Google - Développeur Backend`
- `[CANDIDATURE] Microsoft - Cloud Engineer`
- `[CANDIDATURE] Airbnb - Full Stack Developer`

### Pour une relance

```
[RELANCE] Nom de l'entreprise - Intitulé du poste
```

**Exemples :**
- `[RELANCE] Amazon - Software Engineer`
- `[RELANCE] Apple - iOS Developer`

---

## 📧 Exemple d'utilisation complète

### 1. Composer un email dans Gmail

- Destinataire : `recrutement@google.com`
- **Objet : `[CANDIDATURE] Google - Développeur Backend`**
- Corps : Votre lettre de motivation...

### 2. Envoyer l'email

Cliquez sur "Envoyer"

### 3. Confirmation automatique

Une notification verte apparaît en haut à droite :

```
✅ Candidature "Google" ajoutée à RelanceWork !
```

### 4. Vérification

Ouvrez votre application RelanceWork → La candidature est là !

- **Entreprise :** Google
- **Poste :** Développeur Backend
- **Status :** Candidature envoyée
- **Date :** 13/01/2026 (automatique)
- **Relancée :** Non

---

## 🔄 Workflow complet

```
1. Vous écrivez un email de candidature
         ↓
2. Vous mettez le bon format dans l'objet
   [CANDIDATURE] Entreprise - Poste
         ↓
3. Vous envoyez l'email
         ↓
4. L'extension détecte l'envoi
         ↓
5. Elle extrait : Entreprise, Poste, Type
         ↓
6. Elle envoie un POST à votre API
         ↓
7. La candidature est ajoutée à la DB
         ↓
8. Notification de confirmation ✅
```

---

## 🎨 Ce qui est ajouté automatiquement

### Vous fournissez (dans l'objet) :
- Nom de l'entreprise
- Intitulé du poste
- Type (CANDIDATURE ou RELANCE)

### L'API ajoute automatiquement :
- **Date :** Date du jour au format JJ/MM/AAAA
- **Status :**
  - "Candidature envoyée" si type = CANDIDATURE
  - "Relance envoyée" si type = RELANCE
- **Relancée :**
  - 0 (non) si type = CANDIDATURE
  - 1 (oui) si type = RELANCE

---

## ✅ Cas d'usage réels

### Cas 1 : Première candidature

**Email envoyé :**
- Objet : `[CANDIDATURE] Netflix - Data Engineer`

**Résultat dans RelanceWork :**
| Entreprise | Poste | Status | Date | Relancée |
|------------|-------|--------|------|----------|
| Netflix | Data Engineer | Candidature envoyée | 13/01/2026 | Non |

### Cas 2 : Relance après 1 semaine

**Email envoyé :**
- Objet : `[RELANCE] Netflix - Data Engineer`

**Résultat dans RelanceWork :**
| Entreprise | Poste | Status | Date | Relancée |
|------------|-------|--------|------|----------|
| Netflix | Data Engineer | Relance envoyée | 20/01/2026 | Oui |

---

## 🚫 Formats NON valides

❌ `Candidature Google - Backend` (pas de crochets)
❌ `[CANDIDATURE] Google` (pas de tiret et de poste)
❌ `CANDIDATURE - Google - Backend` (pas de crochets)
❌ `[candidature] Google - Backend` (minuscules dans les crochets)

**Note :** L'extension ignore les emails dont l'objet ne correspond pas au format.

---

## 🔍 Vérifier que l'extension fonctionne

### Méthode 1 : Console du navigateur

1. Sur Gmail, appuyez sur **F12**
2. Allez dans l'onglet **Console**
3. Vous devriez voir : `🚀 RelanceWork Extension chargée !`

### Méthode 2 : Popup de l'extension

1. Cliquez sur l'icône de l'extension (en haut à droite)
2. Vous devriez voir : **✅ Extension active**

### Méthode 3 : Envoyer un email test

Envoyez un email avec l'objet : `[CANDIDATURE] Test - Developer`

Si une notification verte apparaît → ✅ Tout fonctionne !

---

## 💡 Astuces

### Créer un modèle d'objet dans Gmail

1. Gmail → Paramètres → Réponses standardisées
2. Créez un modèle avec votre format préféré
3. Utilisez-le à chaque candidature

### Raccourci pour le format

Gardez ce texte dans un fichier :
```
[CANDIDATURE] ENTREPRISE - POSTE
```

Copiez-collez et remplacez ENTREPRISE et POSTE à chaque fois.

### Suivi des relances

L'application RelanceWork affiche une checkbox "Relancée" pour chaque candidature. Utilisez `[RELANCE]` dans vos emails de relance pour le marquer automatiquement !

---

## 📊 Statistiques

Une fois configurée, l'extension vous permet de :
- ✅ Ne jamais oublier une candidature
- ✅ Avoir un historique complet
- ✅ Suivre vos relances automatiquement
- ✅ Voir rapidement toutes vos candidatures en cours

---

**Bonne recherche d'emploi ! 🚀**
