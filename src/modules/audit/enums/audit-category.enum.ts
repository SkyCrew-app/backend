import { registerEnumType } from '@nestjs/graphql';

/**
 * Enumération des catégories d'items d'audit
 */
export enum AuditCategoryType {
  CELLULE = 'CELLULE',
  MOTEUR = 'MOTEUR',
  AVIONIQUE = 'AVIONIQUE',
  TRAIN_ATTERRISSAGE = 'TRAIN_ATTERRISSAGE',
  SYSTEME_CARBURANT = 'SYSTEME_CARBURANT',
  SYSTEME_ELECTRIQUE = 'SYSTEME_ELECTRIQUE',
  DOCUMENTATION = 'DOCUMENTATION',
  EQUIPEMENT_SECURITE = 'EQUIPEMENT_SECURITE',
  AUTRE = 'AUTRE',
}

// Enregistrement de l'enum pour GraphQL
registerEnumType(AuditCategoryType, {
  name: 'AuditCategoryType',
  description: "Catégories possibles pour les items d'audit",
});

/**
 * Conversion de la catégorie d'audit en texte descriptif
 */
export const getAuditCategoryLabel = (category: AuditCategoryType): string => {
  const labels = {
    [AuditCategoryType.CELLULE]: 'Cellule',
    [AuditCategoryType.MOTEUR]: 'Moteur',
    [AuditCategoryType.AVIONIQUE]: 'Avionique',
    [AuditCategoryType.TRAIN_ATTERRISSAGE]: "Train d'atterrissage",
    [AuditCategoryType.SYSTEME_CARBURANT]: 'Système carburant',
    [AuditCategoryType.SYSTEME_ELECTRIQUE]: 'Système électrique',
    [AuditCategoryType.DOCUMENTATION]: 'Documentation',
    [AuditCategoryType.EQUIPEMENT_SECURITE]: 'Équipement de sécurité',
    [AuditCategoryType.AUTRE]: 'Autre',
  };

  return labels[category] || 'Inconnu';
};
