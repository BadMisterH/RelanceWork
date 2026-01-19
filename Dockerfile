# Image Node.js (version LTS légère)
FROM node:20-alpine

# Dossier de travail dans le conteneur
WORKDIR /app

# Copier les fichiers package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier tout le code source
COPY . .

# Compiler TypeScript en JavaScript
RUN npm run build

# Le serveur écoute sur le port 3000
EXPOSE 3000

# Lancer l'application
CMD ["npm", "start"]
