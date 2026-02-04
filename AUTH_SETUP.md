# Configuration de l'Authentification RelanceWork

## 📋 Vue d'ensemble

Le système d'authentification de RelanceWork offre une expérience sécurisée et moderne avec:

- ✅ Inscription et connexion par email/mot de passe
- ✅ Hachage sécurisé des mots de passe avec bcrypt
- ✅ Authentification JWT (JSON Web Tokens)
- ✅ UI/UX professionnelle avec split-screen design
- ✅ Validation en temps réel des formulaires
- ✅ Indicateur de force du mot de passe
- ✅ Design responsive mobile-friendly

## 🚀 Installation

### 1. Installer les dépendances

Les dépendances ont déjà été installées. Si nécessaire:

```bash
npm install bcrypt jsonwebtoken @types/bcrypt @types/jsonwebtoken
```

### 2. Créer la table users dans PostgreSQL

```bash
npm run create-users-table
```

Cette commande va:
- Créer la table `users` avec les champs: id, name, email, password, created_at, last_login
- Créer un index sur l'email pour des recherches rapides
- Ajouter une colonne `user_id` à la table `applications` pour lier les candidatures aux utilisateurs

### 3. Configuration des variables d'environnement

Ajoutez dans votre fichier `.env`:

```env
JWT_SECRET=votre-clé-secrète-super-longue-et-complexe
```

⚠️ **Important**: Changez cette clé en production! Utilisez une clé aléatoire et sécurisée.

Générer une clé sécurisée:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 📁 Structure des fichiers

### Frontend (Client)
```
client/
├── auth.html                    # Page d'authentification
├── src/
│   ├── auth.ts                  # Logique d'authentification frontend
│   └── styles/
│       └── auth.css             # Styles de la page d'authentification
```

### Backend (Serveur)
```
src/
├── routes/
│   └── authRoutes.ts            # Routes d'authentification
├── controllers/
│   └── authController.ts        # Contrôleurs d'authentification
├── middleware/
│   └── authMiddleware.ts        # Middleware de protection des routes
└── scripts/
    └── createUsersTable.ts      # Script de création de la table users
```

## 🔐 API Endpoints

### Routes publiques

#### POST /api/auth/signup
Créer un nouveau compte utilisateur.

**Body:**
```json
{
  "name": "Jean Dupont",
  "email": "jean@example.com",
  "password": "MotDePasse123!"
}
```

**Response (201):**
```json
{
  "message": "Compte créé avec succès",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Jean Dupont",
    "email": "jean@example.com",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### POST /api/auth/login
Se connecter avec un compte existant.

**Body:**
```json
{
  "email": "jean@example.com",
  "password": "MotDePasse123!",
  "rememberMe": true
}
```

**Response (200):**
```json
{
  "message": "Connexion réussie",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Jean Dupont",
    "email": "jean@example.com"
  }
}
```

### Routes protégées

Toutes les routes protégées nécessitent un header Authorization:
```
Authorization: Bearer <token>
```

#### GET /api/auth/me
Récupérer les informations de l'utilisateur connecté.

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "name": "Jean Dupont",
    "email": "jean@example.com",
    "created_at": "2024-01-15T10:30:00.000Z",
    "last_login": "2024-01-16T14:20:00.000Z"
  }
}
```

#### POST /api/auth/logout
Se déconnecter (le client supprime le token).

**Response (200):**
```json
{
  "message": "Déconnexion réussie"
}
```

## 🔨 Utilisation dans votre code

### Protéger une route

```typescript
import { authenticateToken } from "./middleware/authMiddleware";

router.get("/api/protected-route", authenticateToken, (req, res) => {
  const userId = (req as any).user.id;
  // Votre logique ici
});
```

### Accéder aux informations de l'utilisateur

Dans une route protégée:

```typescript
const userId = (req as any).user.id;
const userEmail = (req as any).user.email;
```

### Stocker le token côté client

```typescript
// Connexion réussie
const { token } = await response.json();

// Stockage persistant (se souvenir de moi)
localStorage.setItem("authToken", token);

// Stockage de session
sessionStorage.setItem("authToken", token);
```

### Faire des requêtes authentifiées

```typescript
const token = localStorage.getItem("authToken");

fetch("/api/protected-route", {
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  }
});
```

## 🎨 Design UI/UX

### Caractéristiques

- **Split-screen layout**: Panneau gauche avec branding, panneau droit avec formulaires
- **Floating labels**: Labels qui flottent au-dessus des champs lors de la saisie
- **Validation en temps réel**: Retour visuel immédiat sur la validité des champs
- **Indicateur de force de mot de passe**: Barre de progression colorée
- **États de chargement**: Spinner animé pendant les requêtes
- **Messages d'erreur clairs**: Affichage sous chaque champ concerné
- **Animations subtiles**: Transitions fluides et professionnelles

### Typographies

- **Headlines**: Crimson Pro (serif élégant pour autorité)
- **Body**: Lexend (sans-serif lisible)

### Couleurs

- Primaire: `#d97757` (terracotta chaleureux)
- Charcoal: `#1e293b` (texte principal)
- Success: `#10b981` (vert émeraude)
- Error: `#ef4444` (rouge vif)
- Warning: `#f59e0b` (orange ambre)

## 🔄 Prochaines étapes

Pour implémenter complètement l'authentification:

1. **Ajouter la vérification d'email**
   - Envoyer un email de confirmation lors de l'inscription
   - Ajouter un champ `email_verified` dans la table users

2. **Réinitialisation de mot de passe**
   - Endpoint pour demander un reset
   - Email avec lien de réinitialisation
   - Page de nouveau mot de passe

3. **Protéger les routes frontend**
   - Vérifier la présence du token avant d'accéder au dashboard
   - Rediriger vers /auth.html si non connecté

4. **Lier les candidatures aux utilisateurs**
   - Modifier les contrôleurs pour utiliser `user_id`
   - Filtrer les candidatures par utilisateur

5. **Refresh tokens**
   - Implémenter un système de refresh pour prolonger les sessions

## 📝 Sécurité

✅ **Bonnes pratiques implémentées:**
- Mots de passe hachés avec bcrypt (10 rounds)
- Emails stockés en minuscules
- Validation côté serveur et client
- Tokens JWT avec expiration
- Protection CSRF avec tokens

⚠️ **À améliorer en production:**
- Ajouter rate limiting (limiter les tentatives de connexion)
- Implémenter HTTPS obligatoire
- Ajouter une authentification à deux facteurs (2FA)
- Logger les tentatives de connexion suspectes
- Implémenter une blacklist de tokens pour les déconnexions

## 🐛 Dépannage

### Erreur: "JWT_SECRET not defined"
Ajoutez `JWT_SECRET` dans votre fichier `.env`

### Erreur: "Table users does not exist"
Exécutez `npm run create-users-table`

### Les tokens expirent trop vite
Modifiez l'expiration dans `authController.ts`:
```typescript
const expiresIn = "30d"; // 30 jours au lieu de 7
```

### Erreur CORS lors des requêtes
Vérifiez que l'en-tête Authorization est bien autorisé dans `app.ts`

## 📚 Documentation

- [bcrypt Documentation](https://github.com/kelektiv/node.bcrypt.js)
- [JWT Documentation](https://jwt.io/)
- [Express Middleware Guide](https://expressjs.com/en/guide/using-middleware.html)

---

Créé avec ❤️ pour RelanceWork
