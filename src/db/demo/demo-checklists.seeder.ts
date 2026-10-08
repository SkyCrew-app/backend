import { DataSource } from 'typeorm';
import { ChecklistTemplate } from '../../modules/checklists/entity/checklist-template.entity';
import { ChecklistItem, ChecklistCategory } from '../../modules/checklists/entity/checklist-item.entity';
import { ChecklistSubmission, ChecklistSubmissionStatus } from '../../modules/checklists/entity/checklist-submission.entity';
import { User } from '../../modules/users/entity/users.entity';
import { Reservation } from '../../modules/reservations/entity/reservations.entity';

export const seedDemoChecklists = async (
  dataSource: DataSource,
  users: User[],
  reservations: Reservation[],
): Promise<void> => {
  const templateRepo = dataSource.getRepository(ChecklistTemplate);
  const itemRepo = dataSource.getRepository(ChecklistItem);
  const submissionRepo = dataSource.getRepository(ChecklistSubmission);

  const admin = users[0];
  const instructeur = users[2]; // Marie

  // ============================================
  // Template 1: Cessna 172 Pre-flight
  // ============================================
  const cessnaTemplate = templateRepo.create({
    aircraft_model: 'Cessna 172 Skyhawk',
    name: 'Visite pré-vol Cessna 172',
    description: 'Check-list complète de visite pré-vol pour Cessna 172 Skyhawk. À effectuer avant chaque vol.',
    is_active: true,
    created_by: admin,
  });
  const savedCessnaTemplate = await templateRepo.save(cessnaTemplate);

  const cessnaItems = [
    // DOCUMENTS
    { category: ChecklistCategory.DOCUMENTS, item_name: 'Carnet de route à jour', description: 'Vérifier que le carnet de route est présent et à jour avec les dernières heures de vol.', is_required: true, sort_order: 1 },
    { category: ChecklistCategory.DOCUMENTS, item_name: 'Certificat de navigabilité (CDN)', description: 'Vérifier la présence et la validité du CDN.', is_required: true, sort_order: 2 },
    { category: ChecklistCategory.DOCUMENTS, item_name: 'Certificat d\'immatriculation', description: 'Vérifier la présence du certificat d\'immatriculation.', is_required: true, sort_order: 3 },
    { category: ChecklistCategory.DOCUMENTS, item_name: 'Assurance valide', description: 'Vérifier que l\'attestation d\'assurance est valide.', is_required: true, sort_order: 4 },
    { category: ChecklistCategory.DOCUMENTS, item_name: 'Manuel de vol (POH)', description: 'Vérifier la présence du manuel de vol dans l\'appareil.', is_required: true, sort_order: 5 },
    // EXTERIOR
    { category: ChecklistCategory.EXTERIOR, item_name: 'État général de la cellule', description: 'Inspecter visuellement la cellule pour déformations, corrosion ou dommages.', is_required: true, sort_order: 6 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Bord d\'attaque ailes', description: 'Vérifier l\'absence de déformation ou d\'impact sur les bords d\'attaque des deux ailes.', is_required: true, sort_order: 7 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Hélice', description: 'Inspecter l\'hélice : pas de nick, crique ou déformation. Vérifier le serrage.', is_required: true, sort_order: 8 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Prise statique et pitot', description: 'Vérifier que les prises statique et pitot ne sont pas obstruées.', is_required: true, sort_order: 9 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Train d\'atterrissage', description: 'Vérifier l\'état des pneus (usure, pression), amortisseurs et freins.', is_required: true, sort_order: 10 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Volets et ailerons', description: 'Vérifier le débattement libre des volets et ailerons. Pas de jeu excessif.', is_required: true, sort_order: 11 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Gouvernes de profondeur et direction', description: 'Vérifier le débattement et l\'état des gouvernes arrière.', is_required: true, sort_order: 12 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Antennes', description: 'Vérifier l\'état et la fixation des antennes radio et transpondeur.', is_required: false, sort_order: 13 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Feux de navigation et strobe', description: 'Tester les feux de position (rouge, vert, blanc) et le strobe.', is_required: true, sort_order: 14 },
    // ENGINE
    { category: ChecklistCategory.ENGINE, item_name: 'Niveau d\'huile moteur', description: 'Vérifier le niveau d\'huile : entre 5 et 8 quarts. Compléter si nécessaire.', is_required: true, sort_order: 15 },
    { category: ChecklistCategory.ENGINE, item_name: 'Quantité de carburant', description: 'Vérifier visuellement le niveau de carburant dans les deux réservoirs. Comparer avec les jauges.', is_required: true, sort_order: 16 },
    { category: ChecklistCategory.ENGINE, item_name: 'Qualité du carburant', description: 'Purger les drains carburant (sumps). Vérifier l\'absence d\'eau et de contaminants.', is_required: true, sort_order: 17 },
    { category: ChecklistCategory.ENGINE, item_name: 'Capot moteur', description: 'Vérifier l\'état du capot, les fixations et l\'absence de fuites.', is_required: true, sort_order: 18 },
    { category: ChecklistCategory.ENGINE, item_name: 'Pot d\'échappement', description: 'Inspecter le pot d\'échappement pour criques ou fixations desserrées.', is_required: true, sort_order: 19 },
    // COCKPIT
    { category: ChecklistCategory.COCKPIT, item_name: 'Batterie et alternateur', description: 'Vérifier la tension batterie (> 24V). Master ON, vérifier la charge alternateur.', is_required: true, sort_order: 20 },
    { category: ChecklistCategory.COCKPIT, item_name: 'Instruments de vol', description: 'Vérifier le fonctionnement : altimètre (calage QNH), anémomètre, variomètre, compas, horizon artificiel.', is_required: true, sort_order: 21 },
    { category: ChecklistCategory.COCKPIT, item_name: 'Radio et transpondeur', description: 'Tester la radio (COM1/COM2) et le transpondeur (mode A/C/S).', is_required: true, sort_order: 22 },
    { category: ChecklistCategory.COCKPIT, item_name: 'GPS / Navigation', description: 'Vérifier le fonctionnement du GPS. Base de données à jour.', is_required: false, sort_order: 23 },
    { category: ChecklistCategory.COCKPIT, item_name: 'Commandes de vol', description: 'Vérifier le débattement complet et libre des commandes (manche, palonnier, compensateur).', is_required: true, sort_order: 24 },
    { category: ChecklistCategory.COCKPIT, item_name: 'Ceintures et harnais', description: 'Vérifier l\'état et le bon fonctionnement des ceintures et harnais de sécurité.', is_required: true, sort_order: 25 },
    // EMERGENCY
    { category: ChecklistCategory.EMERGENCY, item_name: 'Extincteur', description: 'Vérifier la présence de l\'extincteur et sa date de validité.', is_required: true, sort_order: 26 },
    { category: ChecklistCategory.EMERGENCY, item_name: 'Gilets de sauvetage', description: 'Vérifier la présence des gilets si vol au-dessus de l\'eau.', is_required: false, sort_order: 27 },
    { category: ChecklistCategory.EMERGENCY, item_name: 'Trousse de premiers secours', description: 'Vérifier la présence et le contenu de la trousse de secours.', is_required: true, sort_order: 28 },
    { category: ChecklistCategory.EMERGENCY, item_name: 'ELT (balise de détresse)', description: 'Vérifier que l\'ELT est armée et que la batterie n\'est pas périmée.', is_required: true, sort_order: 29 },
  ];

  for (const itemData of cessnaItems) {
    const item = itemRepo.create({
      ...itemData,
      template: savedCessnaTemplate,
    });
    await itemRepo.save(item);
  }

  // ============================================
  // Template 2: Piper PA-28 Pre-flight
  // ============================================
  const piperTemplate = templateRepo.create({
    aircraft_model: 'Piper PA-28 Cherokee',
    name: 'Visite pré-vol Piper PA-28',
    description: 'Check-list de visite pré-vol pour Piper PA-28 Cherokee.',
    is_active: true,
    created_by: admin,
  });
  const savedPiperTemplate = await templateRepo.save(piperTemplate);

  const piperItems = [
    { category: ChecklistCategory.DOCUMENTS, item_name: 'Documents de bord complets', description: 'CDN, certificat d\'immatriculation, assurance, carnet de route, POH.', is_required: true, sort_order: 1 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Aile gauche - bord d\'attaque', description: 'Inspecter pour impacts, déformations.', is_required: true, sort_order: 2 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Aile gauche - réservoir carburant', description: 'Vérifier bouchon et quantité. Purger sump.', is_required: true, sort_order: 3 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Train principal gauche', description: 'Pneu, pression, frein, amortisseur.', is_required: true, sort_order: 4 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Fuselage et empennage', description: 'État général, rivets, tôles, antennes.', is_required: true, sort_order: 5 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Gouvernes arrière', description: 'Dérive, profondeur - débattement et état.', is_required: true, sort_order: 6 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Aile droite', description: 'Bord d\'attaque, pitot, réservoir, sump.', is_required: true, sort_order: 7 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Train principal droit', description: 'Pneu, pression, frein, amortisseur.', is_required: true, sort_order: 8 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Hélice et cône', description: 'État hélice, pas de nick ni crique.', is_required: true, sort_order: 9 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Train avant', description: 'Amortisseur, pneu, orientation.', is_required: true, sort_order: 10 },
    { category: ChecklistCategory.ENGINE, item_name: 'Huile moteur', description: 'Niveau entre 6 et 8 quarts minimum.', is_required: true, sort_order: 11 },
    { category: ChecklistCategory.ENGINE, item_name: 'Carburant - quantité et qualité', description: 'Purge sumps, vérification visuelle réservoirs.', is_required: true, sort_order: 12 },
    { category: ChecklistCategory.ENGINE, item_name: 'Compartiment moteur', description: 'Fuites, câblage, durites.', is_required: true, sort_order: 13 },
    { category: ChecklistCategory.COCKPIT, item_name: 'Instruments de bord', description: 'Altimètre QNH, gyroscopes, compas.', is_required: true, sort_order: 14 },
    { category: ChecklistCategory.COCKPIT, item_name: 'Radios et avionique', description: 'COM/NAV, transpondeur, GPS.', is_required: true, sort_order: 15 },
    { category: ChecklistCategory.COCKPIT, item_name: 'Commandes de vol', description: 'Débattement complet, compensateur.', is_required: true, sort_order: 16 },
    { category: ChecklistCategory.COCKPIT, item_name: 'Sièges et ceintures', description: 'Réglage, verrouillage, bon état.', is_required: true, sort_order: 17 },
    { category: ChecklistCategory.EMERGENCY, item_name: 'Extincteur et ELT', description: 'Présence et validité.', is_required: true, sort_order: 18 },
  ];

  for (const itemData of piperItems) {
    const item = itemRepo.create({
      ...itemData,
      template: savedPiperTemplate,
    });
    await itemRepo.save(item);
  }

  // ============================================
  // Template 3: Generic pre-flight
  // ============================================
  const genericTemplate = templateRepo.create({
    aircraft_model: 'Robin DR400-140B',
    name: 'Visite pré-vol Robin DR400',
    description: 'Check-list de visite pré-vol pour Robin DR400. Adaptée au modèle 140B Major.',
    is_active: true,
    created_by: instructeur,
  });
  const savedGenericTemplate = await templateRepo.save(genericTemplate);

  const genericItems = [
    { category: ChecklistCategory.DOCUMENTS, item_name: 'Documents de bord', description: 'CDN, certificat d\'immatriculation, assurance, carnet de route, POH.', is_required: true, sort_order: 1 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Verrière et structure', description: 'État de la verrière coulissante, propreté, pas de fissure.', is_required: true, sort_order: 2 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Aile basse - intrados et extrados', description: 'Vérifier l\'état de l\'aile basse caractéristique du DR400.', is_required: true, sort_order: 3 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Train tricycle fixe', description: 'Pneus, amortisseurs, carénages de roue.', is_required: true, sort_order: 4 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Empennage en T', description: 'Gouverne de direction et profondeur, câbles.', is_required: true, sort_order: 5 },
    { category: ChecklistCategory.EXTERIOR, item_name: 'Hélice bipale', description: 'État des pales, serrage, cône.', is_required: true, sort_order: 6 },
    { category: ChecklistCategory.ENGINE, item_name: 'Niveau huile Lycoming', description: 'Minimum 5 quarts pour le vol.', is_required: true, sort_order: 7 },
    { category: ChecklistCategory.ENGINE, item_name: 'Carburant', description: 'Réservoir unique de 110L. Purge et vérification visuelle.', is_required: true, sort_order: 8 },
    { category: ChecklistCategory.COCKPIT, item_name: 'Manche central et palonnier', description: 'Débattement libre et complet.', is_required: true, sort_order: 9 },
    { category: ChecklistCategory.COCKPIT, item_name: 'Instruments et avionique', description: 'Vérification complète du panneau de bord.', is_required: true, sort_order: 10 },
    { category: ChecklistCategory.EMERGENCY, item_name: 'Équipements de sécurité', description: 'Extincteur, ELT, trousse de secours.', is_required: true, sort_order: 11 },
  ];

  for (const itemData of genericItems) {
    const item = itemRepo.create({
      ...itemData,
      template: savedGenericTemplate,
    });
    await itemRepo.save(item);
  }

  // ============================================
  // Submissions (checklists remplies)
  // ============================================
  const now = new Date();

  // Fetch saved items for responses
  const cessnaItemsSaved = await itemRepo.find({ where: { template: { id: savedCessnaTemplate.id } }, order: { sort_order: 'ASC' } });
  const piperItemsSaved = await itemRepo.find({ where: { template: { id: savedPiperTemplate.id } }, order: { sort_order: 'ASC' } });
  const genericItemsSaved = await itemRepo.find({ where: { template: { id: savedGenericTemplate.id } }, order: { sort_order: 'ASC' } });

  // ===== Admin submissions =====
  // Admin - Completed Cessna checklist (past reservation index 0)
  const subAdmin1 = submissionRepo.create({
    template: savedCessnaTemplate,
    pilot: admin,
    reservation: reservations[0],
    status: ChecklistSubmissionStatus.COMPLETED,
    responses: cessnaItemsSaved.map(item => ({
      itemId: item.id,
      checked: true,
      note: item.sort_order === 15 ? 'Huile 7 quarts - OK' : null,
    })),
    started_at: new Date(now.getTime() - 14 * 24 * 3600000),
    completed_at: new Date(now.getTime() - 14 * 24 * 3600000 + 25 * 60000),
  });
  await submissionRepo.save(subAdmin1);

  // Admin - Completed checklist for nav Paris-Lyon (reservation index 1)
  const subAdmin2 = submissionRepo.create({
    template: savedCessnaTemplate,
    pilot: admin,
    reservation: reservations[1],
    status: ChecklistSubmissionStatus.COMPLETED,
    responses: cessnaItemsSaved.map(item => ({
      itemId: item.id,
      checked: true,
      note: item.sort_order === 16 ? 'Pleins complets - 212L' : (item.sort_order === 23 ? 'Base GPS à jour - cycle AIRAC 2603' : null),
    })),
    started_at: new Date(now.getTime() - 6 * 24 * 3600000),
    completed_at: new Date(now.getTime() - 6 * 24 * 3600000 + 22 * 60000),
  });
  await submissionRepo.save(subAdmin2);

  // Admin - Completed checklist for Cirrus (reservation index 2)
  const subAdmin3 = submissionRepo.create({
    template: savedCessnaTemplate,
    pilot: admin,
    reservation: reservations[2],
    status: ChecklistSubmissionStatus.COMPLETED,
    responses: cessnaItemsSaved.map(item => ({
      itemId: item.id,
      checked: true,
      note: null,
    })),
    started_at: new Date(now.getTime() - 1 * 24 * 3600000),
    completed_at: new Date(now.getTime() - 1 * 24 * 3600000 + 18 * 60000),
  });
  await submissionRepo.save(subAdmin3);

  // Admin - In progress for today's reservation (reservation index 3)
  const subAdmin4 = submissionRepo.create({
    template: savedPiperTemplate,
    pilot: admin,
    reservation: reservations[3],
    status: ChecklistSubmissionStatus.IN_PROGRESS,
    responses: piperItemsSaved.slice(0, 8).map(item => ({
      itemId: item.id,
      checked: true,
      note: null,
    })),
    started_at: now,
  });
  await submissionRepo.save(subAdmin4);

  // ===== Other users submissions =====
  // Submission 1: Completed - Jean sur Cessna (reservation index 6)
  const sub1 = submissionRepo.create({
    template: savedCessnaTemplate,
    pilot: users[1], // Jean
    reservation: reservations[6],
    status: ChecklistSubmissionStatus.COMPLETED,
    responses: cessnaItemsSaved.map(item => ({
      itemId: item.id,
      checked: true,
      note: null,
    })),
    started_at: new Date(now.getTime() - 7 * 24 * 3600000),
    completed_at: new Date(now.getTime() - 7 * 24 * 3600000 + 20 * 60000),
  });
  await submissionRepo.save(sub1);

  // Submission 2: Completed - Lucas sur Piper (reservation index 7)
  const sub2 = submissionRepo.create({
    template: savedPiperTemplate,
    pilot: users[5], // Lucas
    reservation: reservations[7],
    status: ChecklistSubmissionStatus.COMPLETED,
    responses: piperItemsSaved.map(item => ({
      itemId: item.id,
      checked: true,
      note: item.sort_order === 12 ? 'Niveau carburant 3/4 - suffisant pour la nav' : null,
    })),
    started_at: new Date(now.getTime() - 5 * 24 * 3600000),
    completed_at: new Date(now.getTime() - 5 * 24 * 3600000 + 15 * 60000),
  });
  await submissionRepo.save(sub2);

  // Submission 3: Completed - Emma sur Robin DR400 (reservation index 8)
  const sub3 = submissionRepo.create({
    template: savedGenericTemplate,
    pilot: users[8], // Emma
    reservation: reservations[8],
    status: ChecklistSubmissionStatus.COMPLETED,
    responses: genericItemsSaved.map(item => ({
      itemId: item.id,
      checked: true,
      note: item.sort_order === 8 ? 'Réservoir plein - 110L' : null,
    })),
    started_at: new Date(now.getTime() - 3 * 24 * 3600000),
    completed_at: new Date(now.getTime() - 3 * 24 * 3600000 + 12 * 60000),
  });
  await submissionRepo.save(sub3);

  // Submission 4: Completed - Antoine sur Diamond DA40 (reservation index 9)
  const sub4 = submissionRepo.create({
    template: savedCessnaTemplate,
    pilot: users[9], // Antoine
    reservation: reservations[9],
    status: ChecklistSubmissionStatus.COMPLETED,
    responses: cessnaItemsSaved.map(item => ({
      itemId: item.id,
      checked: true,
      note: null,
    })),
    started_at: new Date(now.getTime() - 2 * 24 * 3600000),
    completed_at: new Date(now.getTime() - 2 * 24 * 3600000 + 18 * 60000),
  });
  await submissionRepo.save(sub4);

  console.log('3 checklist templates with items and 8 submissions created');
};
