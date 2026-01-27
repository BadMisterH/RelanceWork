# Configuration Google Maps API

Ce guide explique comment obtenir et configurer une clé API Google Maps pour le système de recherche d'entreprises.

## 1. Obtenir une clé API Google Maps

### Étape 1: Créer un compte Google Cloud Platform

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Connectez-vous avec votre compte Google
3. Acceptez les conditions d'utilisation

### Étape 2: Créer un nouveau projet

1. Dans la barre supérieure, cliquez sur le sélecteur de projet
2. Cliquez sur "Nouveau projet"
3. Donnez un nom à votre projet (ex: "RelanceWork")
4. Cliquez sur "Créer"

### Étape 3: Activer les API nécessaires

1. Dans le menu de gauche, allez dans "API et services" > "Bibliothèque"
2. Recherchez et activez les API suivantes:
   - **Maps JavaScript API** (obligatoire)
   AIzaSyAowMY6dN-uTSxzK0UgjZKvHEhlpw9K784
   AIzaSyC9CmJ2zW7Rsz0i_kgEvwx16WEGjKsg-is
   - **Places API** (obligatoire)
   - **Geocoding API** (optionnel mais recommandé)

### Étape 4: Créer une clé API

1. Allez dans "API et services" > "Identifiants"
2. Cliquez sur "+ CRÉER DES IDENTIFIANTS" > "Clé API"
3. Une clé API sera générée (elle ressemble à: `AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
4. Copiez cette clé

### Étape 5: (Recommandé) Sécuriser votre clé API

Pour éviter une utilisation non autorisée:

1. Cliquez sur votre clé API dans la liste
2. Dans "Restrictions relatives aux applications", sélectionnez:
   - **Référents HTTP (sites web)**
   - Ajoutez: `http://localhost:*/*` et `http://127.0.0.1:*/*`
3. Dans "Restrictions relatives aux API", sélectionnez:
   - **Limiter la clé aux API sélectionnées**
   - Cochez: Maps JavaScript API, Places API
4. Cliquez sur "Enregistrer"

## 2. Configurer la clé dans l'application

### Option A: Directement dans le HTML (développement uniquement)

Ouvrez le fichier [client/index.html](client/index.html) et remplacez `YOUR_API_KEY` par votre clé:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=VOTRE_CLE_API_ICI&libraries=places&callback=initMap" async defer></script>
```

### Option B: Variable d'environnement (recommandé pour la production)

1. Créez un fichier `.env` dans le dossier `client/`:

```env
VITE_GOOGLE_MAPS_API_KEY=VOTRE_CLE_API_ICI
```

2. Modifiez le fichier HTML pour utiliser la variable d'environnement:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=import.meta.env.VITE_GOOGLE_MAPS_API_KEY&libraries=places&callback=initMap" async defer></script>
```

3. Ajoutez `.env` dans votre `.gitignore` pour ne pas le versionner

## 3. Quota et facturation

Google Maps API offre un crédit gratuit de **$200/mois**. Voici les tarifs approximatifs:

- **Maps JavaScript API**: $7 / 1000 chargements
- **Places API (Text Search)**: $32 / 1000 requêtes
- **Places API (Place Details)**: $17 / 1000 requêtes

Avec le crédit gratuit, vous pouvez faire:
- ~28,500 chargements de carte
- ~6,250 recherches de lieux
- ~11,750 demandes de détails

Pour activer la facturation:
1. Allez dans "Facturation" dans Google Cloud Console
2. Associez une carte de crédit (nécessaire même pour utiliser le crédit gratuit)
3. Définissez des alertes budgétaires pour éviter les surprises

## 4. Tester l'installation

1. Démarrez l'application:
```bash
cd client
npm run dev
```

2. Ouvrez l'application dans votre navigateur
3. Cliquez sur "Chercher entreprises" dans la sidebar
4. Effectuez une recherche (ex: "Restaurants à Paris")
5. Vous devriez voir une carte et une liste de résultats

## 5. Résolution des problèmes

### Erreur: "This API key is not authorized to use this service"

- Vérifiez que vous avez activé Maps JavaScript API et Places API
- Vérifiez les restrictions de votre clé API

### Erreur: "RefererNotAllowedMapError"

- Ajoutez `http://localhost:*/*` dans les restrictions de référent
- Attendez quelques minutes que les changements se propagent

### La carte ne s'affiche pas

- Ouvrez la console du navigateur (F12) pour voir les erreurs
- Vérifiez que la clé API est correctement insérée dans le HTML
- Vérifiez que le script Google Maps se charge correctement

### Aucun résultat de recherche

- Vérifiez que Places API est bien activée
- Vérifiez la console pour les erreurs d'API
- Essayez une recherche plus spécifique (ex: "Boulangeries à Lyon" plutôt que "Boulangeries")

## Ressources utiles

- [Documentation Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [Documentation Places API](https://developers.google.com/maps/documentation/places/web-service)
- [Tarification Google Maps Platform](https://mapsplatform.google.com/pricing/)
- [Console Google Cloud](https://console.cloud.google.com/)
