# Configuration Gmail API - Détection Automatique des Candidatures

Ce guide vous explique comment configurer l'intégration Gmail pour détecter automatiquement vos candidatures envoyées **en temps réel**, sans avoir besoin de l'extension Chrome.

## 🎯 Fonctionnement

Une fois configuré, RelanceWork surveillera automatiquement vos emails envoyés via Gmail et détectera les candidatures selon le format de l'objet :
- ✅ `Candidature - Développeur Full-Stack - Google`
- ✅ `Candidature au poste de Data Analyst - Meta`
- ✅ `Suite à ma candidature - Product Manager`
- ✅ `[CANDIDATURE] Amazon - Software Engineer`

Les candidatures sont automatiquement ajoutées à votre base de données dès l'envoi de l'email.

## 📋 Prérequis

- Un compte Google (Gmail)
- Node.js et npm installés
- Un tunnel pour exposer votre serveur local (ngrok ou équivalent)

## 🚀 Étape 1 : Configurer Google Cloud Console

### 1.1 Créer un projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Cliquez sur **"Créer un projet"** (ou sélectionnez un projet existant)
3. Donnez un nom à votre projet, par exemple : `RelanceWork`
4. Cliquez sur **"Créer"**

### 1.2 Activer les APIs nécessaires

1. Dans le menu de gauche, allez dans **"APIs et services"** → **"Bibliothèque"**
2. Activez les APIs suivantes :
   - **Gmail API** : Recherchez "Gmail API" et cliquez sur "Activer"
   - **Cloud Pub/Sub API** : Recherchez "Cloud Pub/Sub API" et cliquez sur "Activer"

### 1.3 Créer un Topic Pub/Sub

1. Dans le menu, allez dans **"Pub/Sub"** → **"Topics"**
2. Cliquez sur **"Créer un topic"**
3. Nom du topic : `gmail-notifications`
4. Cliquez sur **"Créer"**
5. **IMPORTANT** : Notez l'identifiant complet du topic, il ressemble à :
   ```
   projects/YOUR_PROJECT_ID/topics/gmail-notifications
   ```

### 1.4 Donner les permissions à Gmail

1. Dans la page de votre topic `gmail-notifications`, cliquez sur **"Permissions"**
2. Cliquez sur **"Ajouter un principal"**
3. Dans "Nouveaux principaux", ajoutez : `gmail-api-push@system.gserviceaccount.com`
4. Dans "Rôle", sélectionnez **"Pub/Sub Publisher"**
5. Cliquez sur **"Enregistrer"**

### 1.5 Créer les credentials OAuth 2.0

1. Allez dans **"APIs et services"** → **"Identifiants"**
2. Cliquez sur **"Créer des identifiants"** → **"ID client OAuth"**
3. Type d'application : **"Application Web"**
4. Nom : `RelanceWork OAuth Client`
5. **URIs de redirection autorisés** : Ajoutez :
   ```
   http://localhost:3000/api/gmail/auth/callback
   ```
6. Cliquez sur **"Créer"**
7. **TÉLÉCHARGEZ** le fichier JSON des credentials

### 1.6 Configurer l'écran de consentement OAuth

1. Allez dans **"APIs et services"** → **"Écran de consentement OAuth"**
2. Type d'utilisateur : **"Externe"** (ou "Interne" si vous avez un Google Workspace)
3. Remplissez les informations requises :
   - Nom de l'application : `RelanceWork`
   - Email d'assistance utilisateur : Votre email
   - Domaine de l'application : Laissez vide
4. **Portées (Scopes)** : Ajoutez les scopes suivants :
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/pubsub`
5. **Testeurs** : Ajoutez votre adresse email Gmail pour tester
6. Cliquez sur **"Enregistrer et continuer"**

## 🌐 Étape 2 : Exposer votre serveur local avec ngrok

Pour recevoir les notifications Gmail Push en temps réel, votre serveur doit être accessible depuis Internet.

### 2.1 Installer ngrok

```bash
# macOS (Homebrew)
brew install ngrok

# ou téléchargez depuis https://ngrok.com/download
```

### 2.2 Créer un compte ngrok (gratuit)

1. Allez sur [ngrok.com](https://ngrok.com/) et créez un compte
2. Récupérez votre authtoken dans le dashboard
3. Configurez ngrok :
   ```bash
   ngrok config add-authtoken VOTRE_AUTH_TOKEN
   ```

### 2.3 Lancer ngrok

```bash
ngrok http 3000
```

Vous obtiendrez une URL publique comme :
```
Forwarding   https://abc123.ngrok.io -> http://localhost:3000
```

**⚠️ IMPORTANT** : Notez cette URL, vous en aurez besoin pour la configuration.

## ⚙️ Étape 3 : Configurer RelanceWork

### 3.1 Sauvegarder les credentials Gmail

1. Prenez le fichier JSON téléchargé à l'étape 1.5
2. Placez-le dans le dossier `/data/` de RelanceWork
3. Renommez-le : `gmail-credentials.json`

Ou créez manuellement le fichier `data/gmail-credentials.json` :

```json
{
  "client_id": "VOTRE_CLIENT_ID.apps.googleusercontent.com",
  "client_secret": "VOTRE_CLIENT_SECRET",
  "redirect_uri": "http://localhost:3000/api/gmail/auth/callback"
}
```

### 3.2 Mettre à jour l'URI de redirection avec ngrok

Si vous utilisez ngrok, vous devez ajouter l'URL ngrok dans Google Cloud Console :

1. Retournez dans **Google Cloud Console** → **"APIs et services"** → **"Identifiants"**
2. Cliquez sur votre ID client OAuth
3. Dans **"URIs de redirection autorisés"**, ajoutez :
   ```
   https://VOTRE_URL_NGROK.ngrok.io/api/gmail/auth/callback
   ```
4. Cliquez sur **"Enregistrer"**

## 🔐 Étape 4 : Authentification OAuth

### 4.1 Démarrer le serveur RelanceWork

```bash
npm run dev
```

### 4.2 Obtenir l'URL d'authentification

Faites une requête GET vers :
```bash
curl http://localhost:3000/api/gmail/auth/url
```

Vous obtiendrez une réponse comme :
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

### 4.3 Autoriser RelanceWork

1. Copiez l'URL et ouvrez-la dans votre navigateur
2. Connectez-vous avec votre compte Google
3. Acceptez les permissions demandées
4. Vous serez redirigé vers une page de succès

✅ Votre authentification est maintenant configurée !

## 📡 Étape 5 : Activer la surveillance Gmail

### 5.1 Configurer le watch Gmail

Faites une requête POST avec votre topic Pub/Sub :

```bash
curl -X POST http://localhost:3000/api/gmail/watch/setup \
  -H "Content-Type: application/json" \
  -d '{
    "topicName": "projects/YOUR_PROJECT_ID/topics/gmail-notifications"
  }'
```

Remplacez `YOUR_PROJECT_ID` par l'ID de votre projet Google Cloud.

### 5.2 Vérifier que tout fonctionne

Vous devriez voir dans les logs :
```
✅ Gmail watch enabled
📧 Watching for sent emails. Expires at: ...
```

## ✅ Étape 6 : Tester la détection

### 6.1 Envoyer un email de test

Envoyez un email depuis Gmail avec l'objet :
```
Candidature - Développeur Full-Stack - Test Company
```

### 6.2 Vérifier les logs

Dans les logs de RelanceWork, vous devriez voir :
```
📬 Received Gmail notification
📧 Processing email...
📝 Subject: Candidature - Développeur Full-Stack - Test Company
✨ Application detected
💾 Adding application to database
✅ Application added successfully
```

### 6.3 Vérifier dans la base de données

```bash
# Lister les candidatures
curl http://localhost:3000/api/applications
```

Votre candidature devrait apparaître dans la liste !

## 🔧 Configuration avancée

### Endpoint webhook personnalisé

Par défaut, le webhook est accessible à :
```
http://localhost:3000/api/gmail/webhook
```

Si vous utilisez ngrok, l'URL publique sera :
```
https://VOTRE_URL_NGROK.ngrok.io/api/gmail/webhook
```

### Renouvellement automatique du watch

Le watch Gmail expire après 7 jours. RelanceWork le renouvelle automatiquement tous les 6 jours.

Pour vérifier le statut :
```bash
curl http://localhost:3000/api/gmail/auth/status
```

Pour arrêter la surveillance :
```bash
curl -X POST http://localhost:3000/api/gmail/watch/stop
```

## 🧪 Endpoints de test

### Lister les emails récents
```bash
curl http://localhost:3000/api/gmail/test/recent?max=5
```

### Traiter un email spécifique
```bash
curl -X POST http://localhost:3000/api/gmail/test/process \
  -H "Content-Type: application/json" \
  -d '{"messageId": "18d123abc456"}'
```

## 🐛 Dépannage

### Erreur : "Gmail not authenticated"
- Vérifiez que le fichier `data/gmail-token.json` existe
- Refaites l'authentification OAuth (Étape 4)

### Erreur : "Precondition check failed"
- Vérifiez que le topic Pub/Sub existe
- Vérifiez que Gmail a les permissions Publisher sur le topic

### Notifications non reçues
- Vérifiez que ngrok est bien lancé
- Vérifiez que le webhook est accessible publiquement
- Vérifiez les logs de Pub/Sub dans Google Cloud Console

### Emails non détectés
- Vérifiez le format de l'objet de l'email
- Testez avec les endpoints de test pour voir si le parsing fonctionne

## 🎉 Félicitations !

Votre système de détection automatique est maintenant configuré !

Plus besoin d'utiliser l'extension Chrome - RelanceWork détecte automatiquement vos candidatures dès que vous envoyez un email depuis Gmail.

## 📚 Ressources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google Cloud Pub/Sub](https://cloud.google.com/pubsub/docs)
- [ngrok Documentation](https://ngrok.com/docs)

---

**💡 Astuce** : Pour une utilisation en production, utilisez un vrai domaine avec un certificat SSL au lieu de ngrok.
