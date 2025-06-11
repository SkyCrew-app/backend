# Étape 1 : Build de l'application NestJS
FROM node:22-alpine AS builder
WORKDIR /app
# Installer les outils de build éventuellement nécessaires (ex: compilateurs natifs)
RUN apk add --no-cache g++ make python3
COPY package*.json ./
RUN npm install --force
COPY . .
RUN npm run build

# Étape 2 : Image de production minimaliste
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV production
COPY package*.json ./
RUN npm install --force --only=production
COPY --from=builder /app/dist ./dist
# Copier d'autres fichiers nécessaires au runtime le cas échéant (config, assets, etc.)
EXPOSE 3000
CMD ["node", "dist/main.js"]
