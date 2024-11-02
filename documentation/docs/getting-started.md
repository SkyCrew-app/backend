---
id: getting-started
title: Prise en Main
description: Guide pour débuter avec le projet SkyCrew.
---

# Prise en Main

Cette section vous guide dans la configuration initiale de l'application SkyCrew.

## Installation

1. Clonez le dépôt GitHub.
2. Installer docker et docker-compose.
3. Exécutez la commande suivante pour démarrer l'application :
```bash
docker-compose up
```
4. Ouvrez votre navigateur et accédez à l'URL suivante : [http://localhost:3000](http://localhost:3000).

## Authentification

SkyCrew utilise un système d'authentification sécurisé :
- **OAuth** pour les utilisateurs internes.
- **JWT** pour sécuriser les requêtes API externes.

## Requêtes de base

Exemple de requête GraphQL pour récupérer les informations de la flotte :
```graphql
query {
  fleetStatus {
    id
    status
    lastMaintenanceDate
  }
}
