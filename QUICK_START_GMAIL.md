# 🚀 Démarrage Rapide - Intégration Gmail

Voici les étapes essentielles pour activer la détection automatique des candidatures via Gmail.

## 📝 Ce dont vous avez besoin

1. Un compte Google (Gmail)
2. 15 minutes de configuration
3. Les accès à [Google Cloud Console](https://console.cloud.google.com/)

## ⚡ Configuration en 5 minutes

### 1. Google Cloud Console

1. Créez un projet sur [Google Cloud Console](https://console.cloud.google.com/)
2. Activez **Gmail API** et **Cloud Pub/Sub API**
3. Créez un topic Pub/Sub nommé `gmail-notifications`
4. Donnez les permissions à `gmail-api-push@system.gserviceaccount.com` (rôle: Pub/Sub Publisher)
5. Créez des credentials OAuth 2.0 (Application Web)
6. Téléchargez le fichier JSON des credentials

### 2. RelanceWork - Configuration

1. Placez le fichier JSON téléchargé dans `data/gmail-credentials.json`

   Ou créez manuellement :
   ```json
   {
     "client_id": "VOTRE_CLIENT_ID.apps.googleusercontent.com",
     "client_secret": "VOTRE_CLIENT_SECRET",
     "redirect_uri": "http://localhost:3000/api/gmail/auth/callback"
   }
   ```

2. Démarrez le serveur :
   ```bash
   npm run dev
   ```

### 3. Authentification

1. Obtenez l'URL d'authentification :
   ```bash
   curl http://localhost:3000/api/gmail/auth/url
   ```

2. Ouvrez l'URL dans votre navigateur et autorisez l'accès

3. Vous verrez une page "Authentication Successful!"

### 4. Installer ngrok (pour les notifications en temps réel)

```bash
# macOS
brew install ngrok

# Créez un compte sur ngrok.com et configurez votre authtoken
ngrok config add-authtoken VOTRE_TOKEN

# Lancez ngrok
ngrok http 3000
```

Notez l'URL HTTPS générée (ex: `https://abc123.ngrok.io`)

### 5. Activer la surveillance Gmail

Remplacez `YOUR_PROJECT_ID` par l'ID de votre projet Google Cloud :

```bash
curl -X POST http://localhost:3000/api/gmail/watch/setup \
  -H "Content-Type: application/json" \
  -d '{
    "topicName": "projects/YOUR_PROJECT_ID/topics/gmail-notifications"
  }'
```

## ✅ C'est tout !

Envoyez un email de test avec l'objet :
```
Candidature - Développeur Full-Stack - Test Company
```

Votre candidature sera automatiquement détectée et ajoutée à RelanceWork !

## 📚 Documentation complète

Pour plus de détails, consultez [GMAIL_SETUP.md](GMAIL_SETUP.md)

## 🆘 Problèmes ?

- **"Gmail not authenticated"** → Refaites l'étape 3
- **"Precondition check failed"** → Vérifiez les permissions Pub/Sub (étape 1.4)
- **Notifications non reçues** → Vérifiez que ngrok est lancé et l'URL est publique

---

💡 **Astuce** : Une fois configuré, vous n'aurez plus besoin de l'extension Chrome - tout est automatique !
