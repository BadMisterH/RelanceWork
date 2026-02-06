# 📧 Gmail Multi-Utilisateur - Guide Complet

## 🎯 Objectif

Permettre à chaque utilisateur de connecter **son propre Gmail** pour auto-détecter ses candidatures envoyées.

## ✨ Fonctionnalités

- ✅ Chaque user a son propre compte Gmail
- ✅ Détection automatique des emails de candidature
- ✅ Les candidatures détectées sont automatiquement liées au bon `user_id`
- ✅ Interface simple pour connecter/déconnecter Gmail
- ✅ Vérification manuelle des nouveaux emails
- ✅ Tokens Gmail stockés de manière sécurisée dans Supabase

## 📋 Configuration Initiale

### Étape 1 : Google Cloud Console

1. **Créer un projet** : https://console.cloud.google.com
2. **Activer l'API Gmail** :
   - Aller dans "APIs & Services" > "Enable APIs and Services"
   - Chercher "Gmail API" et l'activer
3. **Créer des credentials OAuth 2.0** :
   - Aller dans "APIs & Services" > "Credentials"
   - Cliquer "Create Credentials" > "OAuth client ID"
   - Type : "Web application"
   - Nom : "RelanceWork Gmail Integration"
   - Authorized redirect URIs :
     ```
     http://localhost:3000/api/gmail-user/callback
     https://votredomaine.com/api/gmail-user/callback (si en production)
     ```
4. **Copier les credentials** :
   - Client ID : `xxx.apps.googleusercontent.com`
   - Client Secret : `GOCSPX-xxxxx`

### Étape 2 : Variables d'Environnement

Ajoutez dans `.env` :

```env
# Gmail Multi-User OAuth
GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxxx
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail-user/callback
```

### Étape 3 : Créer la Table Supabase

Dans **Supabase Dashboard** → **SQL Editor**, exécutez :

```sql
-- Table pour stocker les tokens Gmail par utilisateur
CREATE TABLE IF NOT EXISTS public.gmail_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  gmail_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id) -- Un seul compte Gmail par user
);

-- Index
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user_id ON public.gmail_tokens(user_id);

-- RLS (Row Level Security)
ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only manage their own Gmail tokens"
  ON public.gmail_tokens
  FOR ALL
  USING (auth.uid() = user_id);
```

## 🚀 Utilisation

### Interface Utilisateur

1. **Connectez-vous** sur l'application
2. **Allez dans la section "Candidatures"**
3. **Vous verrez un encadré Gmail** avec deux états possibles :

#### État Déconnecté
```
📧 Détection Automatique des Candidatures
   Connectez votre Gmail pour auto-détecter vos candidatures

   [🔗 Connecter mon Gmail]
```

#### État Connecté
```
✅ Gmail Connecté
   votre@email.com

   [🔍 Vérifier les emails] [🔌 Déconnecter]
```

### Workflow

1. **Cliquez sur "Connecter mon Gmail"**
2. **Une fenêtre OAuth s'ouvre** → Autorisez l'accès Gmail
3. **Fermer la fenêtre** → Le statut passe à "Connecté"
4. **Cliquez sur "Vérifier les emails"** pour détecter les candidatures
5. **Les candidatures détectées** apparaissent automatiquement dans votre liste

## 🔧 API Endpoints

### Vérifier le statut Gmail
```bash
GET /api/gmail-user/status
Headers: Authorization: Bearer <votre-token>

Response:
{
  "connected": true,
  "gmail_email": "votre@email.com",
  "message": "Gmail connecté: votre@email.com"
}
```

### Connecter Gmail
```bash
GET /api/gmail-user/connect
Headers: Authorization: Bearer <votre-token>

Response:
{
  "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "message": "Ouvrez cette URL pour autoriser l'accès à votre Gmail"
}
```

### Vérifier les nouveaux emails
```bash
POST /api/gmail-user/check-emails
Headers: Authorization: Bearer <votre-token>

Response:
{
  "success": true,
  "message": "Emails vérifiés avec succès. Les nouvelles candidatures ont été ajoutées."
}
```

### Déconnecter Gmail
```bash
POST /api/gmail-user/disconnect
Headers: Authorization: Bearer <votre-token>

Response:
{
  "success": true,
  "message": "Gmail déconnecté avec succès"
}
```

## 🧠 Comment ça fonctionne ?

### 1. Connexion Gmail

```typescript
// L'utilisateur clique sur "Connecter Gmail"
// → Génère une URL OAuth avec son user_id dans le state
const authUrl = gmailMultiUserService.getAuthUrl(userId);

// → Ouvre la fenêtre d'autorisation Google
// → L'utilisateur autorise l'accès
// → Google redirige vers /api/gmail-user/callback?code=xxx&state=userId

// → Le serveur échange le code contre des tokens
// → Les tokens sont stockés dans Supabase avec le user_id
await supabase.from('gmail_tokens').insert({
  user_id: userId,
  access_token: tokens.access_token,
  refresh_token: tokens.refresh_token,
  token_expiry: expiryDate,
  gmail_email: gmailEmail
});
```

### 2. Détection des Candidatures

```typescript
// L'utilisateur clique sur "Vérifier les emails"
// → Le serveur récupère les tokens de CET utilisateur depuis Supabase
const oauth2Client = await getOAuth2ClientForUser(userId);

// → Liste les 10 derniers emails envoyés depuis SON Gmail
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
const messages = await gmail.users.messages.list({ labelIds: ['SENT'] });

// → Pour chaque email, vérifie si c'est une candidature
for (const message of messages) {
  const emailData = parseJobApplicationEmail(message);

  if (emailData) {
    // ✅ CRITIQUE : Attache automatiquement au bon user_id
    await supabase.from('applications').insert({
      ...emailData,
      user_id: userId // ← Lié au bon utilisateur !
    });
  }
}
```

### 3. Sécurité & Isolation

- **Row Level Security (RLS)** : Chaque user ne voit QUE ses tokens Gmail
- **Refresh automatique** : Les tokens sont automatiquement rafraîchis par Google OAuth
- **Un seul compte** : Constraint `UNIQUE(user_id)` empêche plusieurs comptes Gmail par user

## 🎨 Personnalisation

### Changer les critères de détection

Éditez `src/services/gmailMultiUserService.ts` ligne ~180 :

```typescript
private parseJobApplicationEmail(message: any): any | null {
  const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';

  // ✏️ Personnalisez les mots-clés ici
  const isCandidature =
    subject.toLowerCase().includes('candidature') ||
    subject.toLowerCase().includes('application') ||
    subject.toLowerCase().includes('cv') ||
    subject.toLowerCase().includes('poste') ||
    subject.toLowerCase().includes('recrutement'); // ← Ajoutez vos mots-clés

  if (!isCandidature) return null;

  // ✏️ Personnalisez l'extraction du nom d'entreprise
  const company = extractCompanyName(to);
  const poste = extractPosition(subject);

  return { company, poste, status: 'Candidature envoyée', ... };
}
```

### Activer la détection automatique (polling)

Pour vérifier automatiquement toutes les 5 minutes :

1. Créez un service de polling par utilisateur
2. Utilisez `setInterval` ou un cron job
3. Appelez `gmailMultiUserService.checkEmailsForUser(userId)` pour chaque user connecté

```typescript
// Exemple : Polling automatique toutes les 5 minutes
setInterval(async () => {
  // Récupérer tous les users qui ont Gmail connecté
  const { data: users } = await supabase
    .from('gmail_tokens')
    .select('user_id');

  // Vérifier les emails pour chaque user
  for (const user of users) {
    await gmailMultiUserService.checkEmailsForUser(user.user_id);
  }
}, 5 * 60 * 1000); // 5 minutes
```

## 🐛 Dépannage

### Erreur : "Gmail not connected for user"
➡️ L'utilisateur n'a pas connecté son Gmail. Demandez-lui de cliquer sur "Connecter Gmail".

### Erreur : "Invalid grant" ou "Token expired"
➡️ Les tokens ont expiré. Le système devrait les rafraîchir automatiquement, mais si ça persiste, déconnectez et reconnectez Gmail.

### Erreur : "The API returned an error: 403 Forbidden"
➡️ L'API Gmail n'est pas activée dans Google Cloud Console ou les credentials sont incorrects.

### Aucune candidature détectée
➡️ Vérifiez les critères de détection dans `parseJobApplicationEmail()`. Peut-être que vos emails ne contiennent pas les mots-clés attendus.

## 📊 Fichiers Créés/Modifiés

### Backend
- ✅ `src/services/gmailMultiUserService.ts` - Service Gmail multi-user
- ✅ `src/routes/gmailMultiUserRoutes.ts` - Routes API protégées
- ✅ `src/app.ts` - Ajout de `/api/gmail-user` routes

### Frontend
- ✅ `client/src/class/GmailConnector.ts` - Composant UI
- ✅ `client/src/styles/gmail-connector.css` - Styles
- ✅ `client/index.html` - Ajout du div `#gmailConnector`
- ✅ `client/src/main.ts` - Initialisation du composant

### Base de données
- ✅ Table `gmail_tokens` avec RLS policies

## 🎉 Résultat Final

Maintenant, **chaque utilisateur** peut :
- ✅ Connecter son propre Gmail
- ✅ Voir uniquement SES candidatures
- ✅ Auto-détecter les emails envoyés depuis SON Gmail
- ✅ Les candidatures sont automatiquement liées à SON compte

## 🔗 Liens Utiles

- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

Made with 📧 by Claude Code
