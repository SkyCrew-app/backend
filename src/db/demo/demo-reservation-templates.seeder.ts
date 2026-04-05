import { DataSource } from 'typeorm';
import { ReservationTemplate } from '../../modules/reservations/entity/reservation-template.entity';
import { FlightCategory } from '../../modules/reservations/entity/reservations.entity';
import { User } from '../../modules/users/entity/users.entity';
import { Aircraft } from '../../modules/aircraft/entity/aircraft.entity';

export const seedDemoReservationTemplates = async (
  dataSource: DataSource,
  users: User[],
  aircraft: Aircraft[],
): Promise<void> => {
  const templateRepo = dataSource.getRepository(ReservationTemplate);

  const pilotes = [users[1], users[4], users[5], users[8], users[9]];

  const templates = [
    {
      name: 'Entraînement hebdo Cessna',
      user: pilotes[0], // Jean
      aircraft: aircraft[0], // Cessna 172
      day_of_week: 6, // Samedi
      preferred_start_time: '09:00',
      preferred_end_time: '11:00',
      flight_category: FlightCategory.TRAINING,
      purpose: 'Entraînement hebdomadaire - tours de piste et zone',
      notes: 'Réservation récurrente chaque samedi matin',
      estimated_flight_hours: 2.0,
    },
    {
      name: 'Cours pilotage Emma',
      user: pilotes[3], // Emma
      aircraft: aircraft[2], // Robin DR400
      day_of_week: 3, // Mercredi
      preferred_start_time: '14:00',
      preferred_end_time: '16:00',
      flight_category: FlightCategory.INSTRUCTION,
      purpose: 'Cours de pilotage PPL avec instructeur',
      notes: 'Leçon hebdomadaire avec Marie Laurent',
      estimated_flight_hours: 2.0,
    },
    {
      name: 'Nav weekend Lucas',
      user: pilotes[2], // Lucas
      aircraft: aircraft[3], // Diamond DA40
      day_of_week: 0, // Dimanche
      preferred_start_time: '08:00',
      preferred_end_time: '12:00',
      flight_category: FlightCategory.CROSS_COUNTRY,
      purpose: 'Navigation de perfectionnement le dimanche',
      notes: 'Vol de navigation longue distance',
      estimated_flight_hours: 4.0,
    },
    {
      name: 'Vol découverte Sophie',
      user: pilotes[1], // Sophie
      aircraft: aircraft[1], // Piper PA-28
      day_of_week: 5, // Vendredi
      preferred_start_time: '17:00',
      preferred_end_time: '19:00',
      flight_category: FlightCategory.TOURISM,
      purpose: 'Vol touristique en fin de journée',
      estimated_flight_hours: 2.0,
    },
    {
      name: 'Perfectionnement IFR Antoine',
      user: pilotes[4], // Antoine
      aircraft: aircraft[4], // Cirrus SR22
      day_of_week: 2, // Mardi
      preferred_start_time: '10:00',
      preferred_end_time: '13:00',
      flight_category: FlightCategory.TRAINING,
      purpose: 'Entraînement IFR avec instructeur',
      notes: 'Maintien de compétences qualification IR',
      estimated_flight_hours: 3.0,
    },
  ];

  for (const data of templates) {
    const template = templateRepo.create(data);
    await templateRepo.save(template);
  }

  console.log(`${templates.length} demo reservation templates created`);
};
