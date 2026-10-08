import { DataSource } from 'typeorm';
import { Incident } from '../../modules/incidents/entity/incidents.entity';
import { User } from '../../modules/users/entity/users.entity';
import { Aircraft } from '../../modules/aircraft/entity/aircraft.entity';

export const seedDemoIncidents = async (
  dataSource: DataSource,
  users: User[],
  aircraft: Aircraft[],
): Promise<void> => {
  const incidentRepository = dataSource.getRepository(Incident);

  const now = new Date();

  const demoIncidents = [
    {
      aircraft: aircraft[1], // Piper Cherokee
      user: users[1], // Jean
      incident_date: new Date(now.getTime() - 22 * 24 * 3600000),
      description: 'Atterrissage dur sur piste 24 suite à une rafale de vent au toucher. Impact train avant plus fort que la normale.',
      damage_report: 'Amortisseur train avant comprimé au-delà des limites normales. Pas de dommage structurel visible.',
      corrective_actions: 'Inspection du train avant effectuée. Remplacement amortisseur et axe de pivotement. Avion remis en service après vérification.',
      severity_level: 'Modéré',
      status: 'Résolu',
      priority: 'Haute',
      category: 'Atterrissage',
    },
    {
      aircraft: aircraft[0], // Cessna 172
      user: users[5], // Lucas
      incident_date: new Date(now.getTime() - 50 * 24 * 3600000),
      description: 'Panne de communication radio en vol. Perte de contact ATC pendant 8 minutes en zone contrôlée.',
      damage_report: 'Aucun dommage matériel. Problème identifié : connecteur micro desserré sur le panneau audio.',
      corrective_actions: 'Connecteur resserré et sécurisé. Test radio au sol OK. Procédure panne radio rappelée au pilote.',
      severity_level: 'Faible',
      status: 'Résolu',
      priority: 'Moyenne',
      category: 'Avionique',
    },
    {
      aircraft: aircraft[2], // Robin DR400
      user: users[8], // Emma
      incident_date: new Date(now.getTime() - 5 * 24 * 3600000),
      description: 'Bird strike en approche finale piste 09. Impact sur bord d\'attaque aile droite à environ 200ft AGL.',
      damage_report: 'Légère déformation du bord d\'attaque aile droite. Pas de dommage structural selon inspection visuelle.',
      corrective_actions: 'Inspection détaillée en cours par le technicien. Avion au sol en attente de clearance maintenance.',
      severity_level: 'Modéré',
      status: 'En cours',
      priority: 'Haute',
      category: 'Collision aviaire',
    },
  ];

  for (const data of demoIncidents) {
    const incident = incidentRepository.create(data);
    await incidentRepository.save(incident);
  }

  console.log(`${demoIncidents.length} demo incidents created`);
};
