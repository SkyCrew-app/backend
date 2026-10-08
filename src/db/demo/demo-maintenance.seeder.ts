import { DataSource } from 'typeorm';
import { Maintenance } from '../../modules/maintenance/entity/maintenance.entity';
import { MaintenanceType } from '../../modules/maintenance/entity/maintenance-type.enum';
import { User } from '../../modules/users/entity/users.entity';
import { Aircraft } from '../../modules/aircraft/entity/aircraft.entity';

export const seedDemoMaintenance = async (
  dataSource: DataSource,
  users: User[],
  aircraft: Aircraft[],
): Promise<void> => {
  const maintenanceRepository = dataSource.getRepository(Maintenance);

  const techniciens = [users[3], users[7]]; // Pierre, Thomas
  const now = new Date();

  const demoMaintenance = [
    {
      aircraft: aircraft[0], // Cessna 172
      technician: techniciens[0],
      start_date: new Date(now.getTime() - 30 * 24 * 3600000),
      end_date: new Date(now.getTime() - 29 * 24 * 3600000),
      status: 'Terminé',
      maintenance_type: MaintenanceType.INSPECTION,
      description: 'Visite pré-vol approfondie et inspection annuelle. Tous les points conformes.',
      parts_changed: 'Filtre à huile, bougies (4x)',
      maintenance_cost: 850,
    },
    {
      aircraft: aircraft[1], // Piper Cherokee
      technician: techniciens[1],
      start_date: new Date(now.getTime() - 20 * 24 * 3600000),
      end_date: new Date(now.getTime() - 18 * 24 * 3600000),
      status: 'Terminé',
      maintenance_type: MaintenanceType.REPAIR,
      description: 'Remplacement du train avant suite à un atterrissage dur signalé. Alignement vérifié.',
      parts_changed: 'Amortisseur train avant, joint torique, axe de pivotement',
      maintenance_cost: 2200,
    },
    {
      aircraft: aircraft[2], // Robin DR400
      technician: techniciens[0],
      start_date: new Date(now.getTime() - 15 * 24 * 3600000),
      end_date: new Date(now.getTime() - 15 * 24 * 3600000),
      status: 'Terminé',
      maintenance_type: MaintenanceType.CLEANING,
      description: 'Nettoyage complet intérieur et extérieur. Traitement anti-corrosion ailes.',
      maintenance_cost: 180,
    },
    {
      aircraft: aircraft[3], // Diamond DA40
      technician: techniciens[1],
      start_date: new Date(now.getTime() - 10 * 24 * 3600000),
      end_date: new Date(now.getTime() - 8 * 24 * 3600000),
      status: 'Terminé',
      maintenance_type: MaintenanceType.SOFTWARE_UPDATE,
      description: 'Mise à jour firmware Garmin G1000 NXi vers v21.12. Mise à jour base de données navigation.',
      maintenance_cost: 450,
    },
    {
      aircraft: aircraft[5], // Tecnam P2002
      technician: techniciens[0],
      start_date: new Date(now.getTime() - 2 * 24 * 3600000),
      end_date: new Date(now.getTime() + 3 * 24 * 3600000),
      status: 'En cours',
      maintenance_type: MaintenanceType.OVERHAUL,
      description: 'Visite des 100 heures. Inspection moteur complète, vérification des systèmes.',
      parts_changed: 'Courroie alternateur, filtre à air, huile moteur (6L)',
      maintenance_cost: 1500,
    },
    {
      aircraft: aircraft[4], // Cirrus SR22
      technician: techniciens[1],
      start_date: new Date(now.getTime() - 45 * 24 * 3600000),
      end_date: new Date(now.getTime() - 44 * 24 * 3600000),
      status: 'Terminé',
      maintenance_type: MaintenanceType.INSPECTION,
      description: 'Vérification du système de parachute CAPS. Test de déploiement OK. Prochaine révision dans 10 ans ou après déploiement.',
      maintenance_cost: 3200,
    },
    {
      aircraft: aircraft[0], // Cessna 172
      technician: techniciens[0],
      start_date: new Date(now.getTime() - 60 * 24 * 3600000),
      end_date: new Date(now.getTime() - 58 * 24 * 3600000),
      status: 'Terminé',
      maintenance_type: MaintenanceType.REPAIR,
      description: 'Réparation fuite hydraulique sur le circuit de freinage. Test au sol validé.',
      parts_changed: 'Flexible de frein gauche, liquide hydraulique (1L)',
      maintenance_cost: 680,
    },
  ];

  for (const data of demoMaintenance) {
    const maintenance = maintenanceRepository.create(data);
    await maintenanceRepository.save(maintenance);
  }

  console.log(`${demoMaintenance.length} demo maintenance records created`);
};
