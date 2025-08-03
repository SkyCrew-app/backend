import { registerEnumType } from '@nestjs/graphql';

/**
 * Enumération des fréquences d'audit possibles pour les aéronefs
 */
export enum AuditFrequencyType {
  QUOTIDIEN = 'QUOTIDIEN',
  HEBDOMADAIRE = 'HEBDOMADAIRE',
  MENSUEL = 'MENSUEL',
  TRIMESTRIEL = 'TRIMESTRIEL',
  SEMESTRIEL = 'SEMESTRIEL',
  ANNUEL = 'ANNUEL',
  BIANNUEL = 'BIANNUEL',
  HEURES_DE_VOL = 'HEURES_DE_VOL',
  APRES_INCIDENT = 'APRES_INCIDENT',
  AUTRE = 'AUTRE',
}

// Enregistrement de l'enum pour GraphQL
registerEnumType(AuditFrequencyType, {
  name: 'AuditFrequencyType',
  description: 'Fréquences possibles pour les audits de sécurité des aéronefs',
});

/**
 * Conversion de la fréquence d'audit en texte descriptif
 */
export const getAuditFrequencyLabel = (
  frequency: AuditFrequencyType,
): string => {
  const labels = {
    [AuditFrequencyType.QUOTIDIEN]: 'Quotidien',
    [AuditFrequencyType.HEBDOMADAIRE]: 'Hebdomadaire',
    [AuditFrequencyType.MENSUEL]: 'Mensuel',
    [AuditFrequencyType.TRIMESTRIEL]: 'Trimestriel',
    [AuditFrequencyType.SEMESTRIEL]: 'Semestriel',
    [AuditFrequencyType.ANNUEL]: 'Annuel',
    [AuditFrequencyType.BIANNUEL]: 'Tous les 2 ans',
    [AuditFrequencyType.HEURES_DE_VOL]: 'Basé sur les heures de vol',
    [AuditFrequencyType.APRES_INCIDENT]: 'Après incident',
    [AuditFrequencyType.AUTRE]: 'Autre fréquence',
  };

  return labels[frequency] || 'Inconnu';
};

/**
 * Calcule la date du prochain audit en fonction de la fréquence
 * Note: pour HEURES_DE_VOL et APRES_INCIDENT, retourne null car
 * ces fréquences ne sont pas basées sur des dates calendaires fixes
 */
export const calculateNextAuditDate = (
  currentDate: Date,
  frequency: AuditFrequencyType,
): Date | null => {
  const nextDate = new Date(currentDate);

  switch (frequency) {
    case AuditFrequencyType.QUOTIDIEN:
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case AuditFrequencyType.HEBDOMADAIRE:
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case AuditFrequencyType.MENSUEL:
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case AuditFrequencyType.TRIMESTRIEL:
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case AuditFrequencyType.SEMESTRIEL:
      nextDate.setMonth(nextDate.getMonth() + 6);
      break;
    case AuditFrequencyType.ANNUEL:
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    case AuditFrequencyType.BIANNUEL:
      nextDate.setFullYear(nextDate.getFullYear() + 2);
      break;
    case AuditFrequencyType.HEURES_DE_VOL:
    case AuditFrequencyType.APRES_INCIDENT:
    case AuditFrequencyType.AUTRE:
      return null;
    default:
      return null;
  }
  return nextDate;
};
