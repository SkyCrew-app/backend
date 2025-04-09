import { registerEnumType } from '@nestjs/graphql';

/**
 * Enumération des résultats possibles pour un audit ou un item d'audit
 */
export enum AuditResultType {
  CONFORME = 'CONFORME',
  NON_CONFORME = 'NON_CONFORME',
  CONFORME_AVEC_REMARQUES = 'CONFORME_AVEC_REMARQUES',
  NON_APPLICABLE = 'NON_APPLICABLE',
}

// Enregistrement de l'enum pour GraphQL
registerEnumType(AuditResultType, {
  name: 'AuditResultType',
  description: 'Résultats possibles pour un audit de sécurité',
});

/**
 * Conversion du résultat d'audit en texte descriptif
 */
export const getAuditResultLabel = (result: AuditResultType): string => {
  const labels = {
    [AuditResultType.CONFORME]: 'Conforme',
    [AuditResultType.NON_CONFORME]: 'Non conforme',
    [AuditResultType.CONFORME_AVEC_REMARQUES]: 'Conforme avec remarques',
    [AuditResultType.NON_APPLICABLE]: 'Non applicable',
  };

  return labels[result] || 'Inconnu';
};
