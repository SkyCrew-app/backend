import { registerEnumType } from '@nestjs/graphql';

/**
 * Enumération des niveaux de criticité pour les items d'audit
 */
export enum CriticalityLevel {
  CRITIQUE = 'CRITIQUE',
  MAJEUR = 'MAJEUR',
  MINEUR = 'MINEUR',
  INFO = 'INFO',
}

// Enregistrement de l'enum pour GraphQL
registerEnumType(CriticalityLevel, {
  name: 'CriticalityLevel',
  description: "Niveaux de criticité pour les items d'audit",
});

/**
 * Conversion du niveau de criticité en texte descriptif
 */
export const getCriticalityLabel = (level: CriticalityLevel): string => {
  const labels = {
    [CriticalityLevel.CRITIQUE]: 'Critique',
    [CriticalityLevel.MAJEUR]: 'Majeur',
    [CriticalityLevel.MINEUR]: 'Mineur',
    [CriticalityLevel.INFO]: 'Information',
  };

  return labels[level] || 'Inconnu';
};
