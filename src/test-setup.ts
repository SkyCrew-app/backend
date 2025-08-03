// src/test-setup.ts
import { webcrypto } from 'crypto';

// Polyfill pour crypto dans l'environnement de test
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}

// Alternative si la première approche ne fonctionne pas
Object.defineProperty(global, 'crypto', {
  value: {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    randomUUID: () => require('crypto').randomUUID(),
    // Ajoutez d'autres méthodes crypto si nécessaire
  },
});
