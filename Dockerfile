# Utiliser une image Node.js officielle
FROM node:18-alpine

# Définir le répertoire de travail
WORKDIR /usr/src/app

# Copier le package.json et installer les dépendances
COPY package*.json ./
RUN npm install

# Copier tout le code source
COPY . .

# Exposer le port de l'application
EXPOSE 3000

# Commande pour démarrer l'application
CMD ["npm", "run", "start:dev"]
