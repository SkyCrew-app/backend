import { DataSource } from 'typeorm';
import { Audit } from '../../modules/audit/entity/audit.entity';
import { AuditItem } from '../../modules/audit/entity/audit-item.entity';
import { AuditTemplate } from '../../modules/audit/entity/audit-template.entity';
import { AuditTemplateItem } from '../../modules/audit/entity/audit-template-item.entity';
import { AuditResultType } from '../../modules/audit/enums/audit-result.enum';
import { AuditFrequencyType } from '../../modules/audit/enums/audit-frequency.enum';
import { AuditCategoryType } from '../../modules/audit/enums/audit-category.enum';
import { CriticalityLevel } from '../../modules/audit/enums/criticality-level.enum';
import { User } from '../../modules/users/entity/users.entity';
import { Aircraft } from '../../modules/aircraft/entity/aircraft.entity';

export const seedDemoAudits = async (
  dataSource: DataSource,
  users: User[],
  aircraft: Aircraft[],
): Promise<void> => {
  const auditRepo = dataSource.getRepository(Audit);
  const auditItemRepo = dataSource.getRepository(AuditItem);
  const auditTemplateRepo = dataSource.getRepository(AuditTemplate);
  const auditTemplateItemRepo = dataSource.getRepository(AuditTemplateItem);

  const now = new Date();
  const admin = users[0];
  const techniciens = [users[3], users[7]]; // Pierre, Thomas

  // ============================================
  // Audit Templates
  // ============================================
  const annualTemplate = auditTemplateRepo.create({
    name: 'Audit annuel de sécurité aéronef',
    description: 'Audit complet annuel couvrant la cellule, le moteur, l\'avionique et les équipements de sécurité. Conforme aux exigences EASA Part-M.',
    recommended_frequency: AuditFrequencyType.ANNUEL,
    applicable_aircraft_types: ['Cessna 172', 'Piper PA-28', 'Robin DR400', 'Diamond DA40', 'Cirrus SR22', 'Tecnam P2002'],
    is_active: true,
    created_by: admin,
    version: 1,
  });
  const savedAnnualTemplate = await auditTemplateRepo.save(annualTemplate);

  const annualTemplateItems = [
    { order_index: 1, category: AuditCategoryType.CELLULE, title: 'État structurel de la cellule', description: 'Inspection visuelle complète de la cellule : fuselage, ailes, empennage. Recherche de corrosion, fissures, déformations.', inspection_method: 'Inspection visuelle + tap test sur zones critiques', expected_result: 'Aucune anomalie structurelle détectée', criticality: CriticalityLevel.CRITIQUE, is_mandatory: true },
    { order_index: 2, category: AuditCategoryType.CELLULE, title: 'État des surfaces mobiles', description: 'Vérification des gouvernes, volets, ailerons : jeu, débattement, câbles/biellettes.', inspection_method: 'Mesure des jeux + test de débattement', expected_result: 'Jeux dans les tolérances constructeur', criticality: CriticalityLevel.CRITIQUE, is_mandatory: true },
    { order_index: 3, category: AuditCategoryType.MOTEUR, title: 'Compression cylindres', description: 'Test de compression différentielle sur chaque cylindre.', inspection_method: 'Compression différentielle à 80 PSI', expected_result: '> 60/80 sur chaque cylindre', criticality: CriticalityLevel.CRITIQUE, is_mandatory: true },
    { order_index: 4, category: AuditCategoryType.MOTEUR, title: 'Analyse d\'huile', description: 'Prélèvement et analyse spectrométrique de l\'huile moteur.', inspection_method: 'Analyse spectrométrique en laboratoire', expected_result: 'Taux de métaux dans les normes', criticality: CriticalityLevel.MAJEUR, is_mandatory: true },
    { order_index: 5, category: AuditCategoryType.TRAIN_ATTERRISSAGE, title: 'État du train d\'atterrissage', description: 'Inspection pneus, freins, amortisseurs, mécanisme de rétraction (si applicable).', inspection_method: 'Inspection visuelle + mesure usure pneus', expected_result: 'Usure pneus < 80%, freins > 3mm', criticality: CriticalityLevel.MAJEUR, is_mandatory: true },
    { order_index: 6, category: AuditCategoryType.AVIONIQUE, title: 'Test instruments de vol', description: 'Vérification du fonctionnement des instruments : altimètre, anémomètre, horizon, compas.', inspection_method: 'Test au sol + comparaison étalons', expected_result: 'Erreurs dans les tolérances EASA', criticality: CriticalityLevel.MAJEUR, is_mandatory: true },
    { order_index: 7, category: AuditCategoryType.AVIONIQUE, title: 'Test transpondeur et ELT', description: 'Vérification du transpondeur (Mode S) et de la balise de détresse ELT.', inspection_method: 'Test avec équipement certifié', expected_result: 'Réponse correcte sur toutes les fréquences', criticality: CriticalityLevel.CRITIQUE, is_mandatory: true },
    { order_index: 8, category: AuditCategoryType.SYSTEME_CARBURANT, title: 'Circuit carburant', description: 'Inspection des réservoirs, conduites, filtres, sélecteur, jauges.', inspection_method: 'Inspection visuelle + test d\'étanchéité', expected_result: 'Aucune fuite, filtres propres', criticality: CriticalityLevel.CRITIQUE, is_mandatory: true },
    { order_index: 9, category: AuditCategoryType.SYSTEME_ELECTRIQUE, title: 'Système électrique', description: 'Batterie, alternateur, câblage, fusibles, éclairage.', inspection_method: 'Test charge/décharge + mesure tensions', expected_result: 'Batterie > 24V, alternateur 28V ±0.5V', criticality: CriticalityLevel.MAJEUR, is_mandatory: true },
    { order_index: 10, category: AuditCategoryType.EQUIPEMENT_SECURITE, title: 'Équipements de sécurité', description: 'Extincteur, gilets de sauvetage, trousse de secours, harnais.', inspection_method: 'Vérification visuelle + dates de péremption', expected_result: 'Tous équipements présents et en date', criticality: CriticalityLevel.MINEUR, is_mandatory: true },
    { order_index: 11, category: AuditCategoryType.DOCUMENTATION, title: 'Documentation aéronef', description: 'CDN, CEN, carnet de route, manuel de vol, fiches de pesée.', inspection_method: 'Vérification présence et validité', expected_result: 'Tous documents présents et à jour', criticality: CriticalityLevel.MAJEUR, is_mandatory: true },
  ];

  for (const itemData of annualTemplateItems) {
    const item = auditTemplateItemRepo.create({
      ...itemData,
      template: savedAnnualTemplate,
      requires_photo_evidence: itemData.criticality === CriticalityLevel.CRITIQUE,
    });
    await auditTemplateItemRepo.save(item);
  }

  // Second template: visite pré-saison
  const seasonTemplate = auditTemplateRepo.create({
    name: 'Inspection pré-saison estivale',
    description: 'Inspection rapide avant le pic d\'activité estival. Focus sur les éléments critiques et la disponibilité de la flotte.',
    recommended_frequency: AuditFrequencyType.SEMESTRIEL,
    applicable_aircraft_types: ['Cessna 172', 'Piper PA-28', 'Robin DR400'],
    is_active: true,
    created_by: admin,
    version: 1,
  });
  const savedSeasonTemplate = await auditTemplateRepo.save(seasonTemplate);

  const seasonTemplateItems = [
    { order_index: 1, category: AuditCategoryType.CELLULE, title: 'État extérieur général', description: 'Inspection rapide de la cellule et des surfaces.', criticality: CriticalityLevel.MAJEUR, is_mandatory: true },
    { order_index: 2, category: AuditCategoryType.MOTEUR, title: 'Vérification moteur rapide', description: 'Niveau huile, état bougies, filtre air.', criticality: CriticalityLevel.CRITIQUE, is_mandatory: true },
    { order_index: 3, category: AuditCategoryType.SYSTEME_CARBURANT, title: 'Circuit carburant', description: 'Étanchéité et propreté du circuit.', criticality: CriticalityLevel.CRITIQUE, is_mandatory: true },
    { order_index: 4, category: AuditCategoryType.AVIONIQUE, title: 'Avionique fonctionnelle', description: 'Test rapide radios, GPS, transpondeur.', criticality: CriticalityLevel.MAJEUR, is_mandatory: true },
    { order_index: 5, category: AuditCategoryType.DOCUMENTATION, title: 'Documents à jour', description: 'Vérification validité des documents de bord.', criticality: CriticalityLevel.MINEUR, is_mandatory: true },
  ];

  for (const itemData of seasonTemplateItems) {
    const item = auditTemplateItemRepo.create({
      ...itemData,
      template: savedSeasonTemplate,
      description: itemData.description,
      inspection_method: null,
      expected_result: null,
      reference_documentation: null,
      requires_photo_evidence: false,
    });
    await auditTemplateItemRepo.save(item);
  }

  // ============================================
  // Audits réalisés
  // ============================================

  // Audit 1: Cessna 172 - Annuel conforme
  const items1 = [];
  for (const cat of [AuditCategoryType.CELLULE, AuditCategoryType.MOTEUR, AuditCategoryType.AVIONIQUE, AuditCategoryType.TRAIN_ATTERRISSAGE, AuditCategoryType.SYSTEME_CARBURANT]) {
    const item = auditItemRepo.create({
      category: cat,
      description: `Inspection ${cat.toLowerCase()} - F-GSKY Cessna 172`,
      result: AuditResultType.CONFORME,
      notes: 'RAS',
      requires_action: false,
    });
    items1.push(await auditItemRepo.save(item));
  }

  const audit1 = auditRepo.create({
    aircraft: aircraft[0],
    audit_date: new Date(now.getTime() - 30 * 24 * 3600000),
    audit_result: AuditResultType.CONFORME,
    audit_notes: 'Audit annuel complet. Tous les points conformes. Aéronef en excellent état pour son âge.',
    next_audit_date: new Date(now.getTime() + 335 * 24 * 3600000),
    audit_frequency: AuditFrequencyType.ANNUEL,
    auditor: techniciens[0],
    audit_items: items1,
    is_closed: true,
    closed_date: new Date(now.getTime() - 29 * 24 * 3600000),
    closed_by: admin,
  });
  await auditRepo.save(audit1);

  // Audit 2: Piper PA-28 - Conforme avec remarques
  const items2 = [];
  const item2a = auditItemRepo.create({
    category: AuditCategoryType.CELLULE,
    description: 'Inspection cellule Piper PA-28 F-HCRE',
    result: AuditResultType.CONFORME,
    notes: 'Cellule en bon état général',
    requires_action: false,
  });
  items2.push(await auditItemRepo.save(item2a));

  const item2b = auditItemRepo.create({
    category: AuditCategoryType.TRAIN_ATTERRISSAGE,
    description: 'Train avant - suite réparation post-incident',
    result: AuditResultType.CONFORME_AVEC_REMARQUES,
    notes: 'Train avant remplacé suite à atterrissage dur. Alignement OK mais surveillance renforcée recommandée pour les 50 prochaines heures.',
    requires_action: true,
  });
  items2.push(await auditItemRepo.save(item2b));

  const item2c = auditItemRepo.create({
    category: AuditCategoryType.MOTEUR,
    description: 'Moteur Lycoming O-320 - inspection post-réparation',
    result: AuditResultType.CONFORME,
    notes: 'Moteur conforme, compression OK',
    requires_action: false,
  });
  items2.push(await auditItemRepo.save(item2c));

  const audit2 = auditRepo.create({
    aircraft: aircraft[1],
    audit_date: new Date(now.getTime() - 18 * 24 * 3600000),
    audit_result: AuditResultType.CONFORME_AVEC_REMARQUES,
    audit_notes: 'Audit post-réparation train avant. Avion conforme avec remarque : surveillance train avant renforcée pendant 50h.',
    corrective_actions: 'Surveillance renforcée du train avant lors des prochaines visites pré-vol. Inspection spécifique à 50h.',
    next_audit_date: new Date(now.getTime() + 60 * 24 * 3600000),
    audit_frequency: AuditFrequencyType.HEURES_DE_VOL,
    auditor: techniciens[1],
    audit_items: items2,
    is_closed: true,
    closed_date: new Date(now.getTime() - 17 * 24 * 3600000),
    closed_by: admin,
  });
  await auditRepo.save(audit2);

  // Audit 3: Robin DR400 - En cours (bird strike)
  const items3 = [];
  const item3a = auditItemRepo.create({
    category: AuditCategoryType.CELLULE,
    description: 'Bord d\'attaque aile droite - impact aviaire',
    result: AuditResultType.NON_CONFORME,
    notes: 'Déformation du bord d\'attaque aile droite suite à un bird strike. Nécessite inspection approfondie et possible remplacement du panneau.',
    requires_action: true,
  });
  items3.push(await auditItemRepo.save(item3a));

  const item3b = auditItemRepo.create({
    category: AuditCategoryType.CELLULE,
    description: 'Structure aile droite - longerons et nervures',
    result: AuditResultType.NON_APPLICABLE,
    notes: 'En attente de résultat du contrôle NDT (ressuage)',
    requires_action: true,
  });
  items3.push(await auditItemRepo.save(item3b));

  const audit3 = auditRepo.create({
    aircraft: aircraft[2],
    audit_date: new Date(now.getTime() - 5 * 24 * 3600000),
    audit_result: AuditResultType.NON_CONFORME,
    audit_notes: 'Audit suite à bird strike en approche. Déformation bord d\'attaque aile droite. Avion au sol en attente d\'inspection NDT.',
    corrective_actions: 'Contrôle NDT (ressuage) commandé. Remplacement panneau bord d\'attaque si nécessaire. Avion INTERDIT DE VOL jusqu\'à clearance.',
    audit_frequency: AuditFrequencyType.APRES_INCIDENT,
    auditor: techniciens[0],
    audit_items: items3,
    is_closed: false,
  });
  await auditRepo.save(audit3);

  // Audit 4: Diamond DA40 - Conforme
  const items4 = [];
  for (const cat of [AuditCategoryType.CELLULE, AuditCategoryType.MOTEUR, AuditCategoryType.AVIONIQUE]) {
    const item = auditItemRepo.create({
      category: cat,
      description: `Inspection ${cat.toLowerCase()} - F-HTBA Diamond DA40 NG`,
      result: AuditResultType.CONFORME,
      notes: 'Conforme - avion récent en excellent état',
      requires_action: false,
    });
    items4.push(await auditItemRepo.save(item));
  }

  const audit4 = auditRepo.create({
    aircraft: aircraft[3],
    audit_date: new Date(now.getTime() - 60 * 24 * 3600000),
    audit_result: AuditResultType.CONFORME,
    audit_notes: 'Premier audit annuel du DA40 NG. Avion en parfait état. Avionique Garmin G1000 NXi fonctionnelle à 100%.',
    next_audit_date: new Date(now.getTime() + 305 * 24 * 3600000),
    audit_frequency: AuditFrequencyType.ANNUEL,
    auditor: techniciens[1],
    audit_items: items4,
    is_closed: true,
    closed_date: new Date(now.getTime() - 59 * 24 * 3600000),
    closed_by: admin,
  });
  await auditRepo.save(audit4);

  // Audit 5: Cirrus SR22 - CAPS check
  const items5 = [];
  const item5a = auditItemRepo.create({
    category: AuditCategoryType.EQUIPEMENT_SECURITE,
    description: 'Système CAPS (Cirrus Airframe Parachute System)',
    result: AuditResultType.CONFORME,
    notes: 'Rocket et harnais en bon état. Timer CAPS remis à zéro. Prochaine révision dans 10 ans ou après déploiement.',
    requires_action: false,
  });
  items5.push(await auditItemRepo.save(item5a));

  const item5b = auditItemRepo.create({
    category: AuditCategoryType.AVIONIQUE,
    description: 'Suite avionique Cirrus Perspective+',
    result: AuditResultType.CONFORME,
    notes: 'Garmin Perspective+ fonctionnel. Bases de données navigation à jour.',
    requires_action: false,
  });
  items5.push(await auditItemRepo.save(item5b));

  const audit5 = auditRepo.create({
    aircraft: aircraft[4],
    audit_date: new Date(now.getTime() - 45 * 24 * 3600000),
    audit_result: AuditResultType.CONFORME,
    audit_notes: 'Audit spécial CAPS + avionique. Système de parachute balistique conforme. Avionique OK.',
    next_audit_date: new Date(now.getTime() + 320 * 24 * 3600000),
    audit_frequency: AuditFrequencyType.ANNUEL,
    auditor: techniciens[1],
    audit_items: items5,
    is_closed: true,
    closed_date: new Date(now.getTime() - 44 * 24 * 3600000),
    closed_by: admin,
  });
  await auditRepo.save(audit5);

  console.log('2 audit templates and 5 audits with items created');
};
