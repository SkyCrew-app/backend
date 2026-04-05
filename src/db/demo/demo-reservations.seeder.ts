import { DataSource } from 'typeorm';
import { Reservation, ReservationStatus, FlightCategory } from '../../modules/reservations/entity/reservations.entity';
import { User } from '../../modules/users/entity/users.entity';
import { Aircraft } from '../../modules/aircraft/entity/aircraft.entity';

export const seedDemoReservations = async (
  dataSource: DataSource,
  users: User[],
  aircraft: Aircraft[],
): Promise<Reservation[]> => {
  const reservationRepository = dataSource.getRepository(Reservation);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const makeDate = (daysOffset: number, hours: number, minutes = 0) => {
    const d = new Date(today);
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  // users: [admin, jean, marie(instr), pierre(tech), sophie, lucas, camille(instr), thomas(tech), emma, antoine]
  const pilotes = [users[1], users[4], users[5], users[8], users[9]]; // jean, sophie, lucas, emma, antoine
  const instructeurs = [users[2], users[6]]; // marie, camille

  const admin = users[0]; // Demo admin

  const demoReservations = [
    // ===== Reservations du compte DEMO ADMIN =====
    {
      aircraft: aircraft[0], // Cessna 172
      user: admin,
      reservation_date: makeDate(-14, 0),
      start_time: makeDate(-14, 8, 0),
      end_time: makeDate(-14, 11, 0),
      estimated_flight_hours: 3.0,
      purpose: 'Vol de contrôle flotte - Cessna 172',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.LOCAL,
      notes: 'Vérification état général après maintenance',
      number_of_passengers: 0,
    },
    {
      aircraft: aircraft[3], // Diamond DA40
      user: admin,
      reservation_date: makeDate(-6, 0),
      start_time: makeDate(-6, 9, 0),
      end_time: makeDate(-6, 13, 0),
      estimated_flight_hours: 4.0,
      purpose: 'Navigation Paris - Lyon',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.CROSS_COUNTRY,
      notes: 'Réunion aéroclub partenaire LFLL',
      number_of_passengers: 1,
    },
    {
      aircraft: aircraft[4], // Cirrus SR22
      user: admin,
      reservation_date: makeDate(-1, 0),
      start_time: makeDate(-1, 14, 0),
      end_time: makeDate(-1, 16, 30),
      estimated_flight_hours: 2.5,
      purpose: 'Vol touristique côte normande',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.TOURISM,
      notes: 'Survol Étretat et Honfleur',
      number_of_passengers: 2,
    },
    {
      aircraft: aircraft[1], // Piper Cherokee
      user: admin,
      reservation_date: makeDate(0, 0),
      start_time: makeDate(0, 10, 0),
      end_time: makeDate(0, 12, 0),
      estimated_flight_hours: 2.0,
      purpose: 'Entraînement local',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.TRAINING,
      number_of_passengers: 0,
    },
    {
      aircraft: aircraft[0], // Cessna 172
      user: admin,
      reservation_date: makeDate(2, 0),
      start_time: makeDate(2, 8, 0),
      end_time: makeDate(2, 10, 30),
      estimated_flight_hours: 2.5,
      purpose: 'Vol d\'évaluation nouvel élève',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.INSTRUCTION,
      notes: 'Évaluation initiale avec Emma Girard',
    },
    {
      aircraft: aircraft[3], // Diamond DA40
      user: admin,
      reservation_date: makeDate(5, 0),
      start_time: makeDate(5, 7, 0),
      end_time: makeDate(5, 14, 0),
      estimated_flight_hours: 7.0,
      purpose: 'Navigation longue Paris - Marseille AR',
      status: ReservationStatus.PENDING,
      flight_category: FlightCategory.PRIVATE,
      notes: 'Escale prévue à LFML',
      number_of_passengers: 1,
    },
    // ===== Reservations des autres pilotes =====
    // Reservations passees
    {
      aircraft: aircraft[0], // Cessna 172
      user: pilotes[0], // Jean
      reservation_date: makeDate(-7, 0),
      start_time: makeDate(-7, 9, 0),
      end_time: makeDate(-7, 11, 30),
      estimated_flight_hours: 2.5,
      purpose: 'Vol local de maintien de compétences',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.LOCAL,
      notes: 'Tour de piste et zone sud',
      number_of_passengers: 1,
    },
    {
      aircraft: aircraft[1], // Piper Cherokee
      user: pilotes[2], // Lucas
      reservation_date: makeDate(-5, 0),
      start_time: makeDate(-5, 14, 0),
      end_time: makeDate(-5, 17, 0),
      estimated_flight_hours: 3.0,
      purpose: 'Navigation vers Bordeaux-Mérignac',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.CROSS_COUNTRY,
      notes: 'Vol aller-retour LFBD-LFBO',
      number_of_passengers: 2,
    },
    {
      aircraft: aircraft[2], // Robin DR400
      user: pilotes[3], // Emma
      reservation_date: makeDate(-3, 0),
      start_time: makeDate(-3, 8, 0),
      end_time: makeDate(-3, 10, 0),
      estimated_flight_hours: 2.0,
      purpose: 'Cours de pilotage avec instructeur',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.INSTRUCTION,
      notes: 'Leçon 12 : atterrissages vent de travers',
    },
    {
      aircraft: aircraft[3], // Diamond DA40
      user: pilotes[4], // Antoine
      reservation_date: makeDate(-2, 0),
      start_time: makeDate(-2, 10, 0),
      end_time: makeDate(-2, 13, 0),
      estimated_flight_hours: 3.0,
      purpose: 'Vol touristique côte atlantique',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.TOURISM,
      notes: 'Survol côte basque avec 2 passagers',
      number_of_passengers: 2,
    },
    {
      aircraft: aircraft[0], // Cessna 172
      user: pilotes[1], // Sophie
      reservation_date: makeDate(-1, 0),
      start_time: makeDate(-1, 15, 0),
      end_time: makeDate(-1, 17, 0),
      estimated_flight_hours: 2.0,
      purpose: 'Entraînement au vol sans visibilité',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.TRAINING,
    },
    // Reservation annulee
    {
      aircraft: aircraft[4], // Cirrus SR22
      user: pilotes[0], // Jean
      reservation_date: makeDate(-1, 0),
      start_time: makeDate(-1, 8, 0),
      end_time: makeDate(-1, 12, 0),
      estimated_flight_hours: 4.0,
      purpose: 'Navigation long courrier annulée - météo',
      status: ReservationStatus.CANCELLED,
      flight_category: FlightCategory.CROSS_COUNTRY,
      notes: 'Annulé : SIGMET orage violent sur la route',
    },
    // Reservations futures
    {
      aircraft: aircraft[0], // Cessna 172
      user: pilotes[0], // Jean
      reservation_date: makeDate(1, 0),
      start_time: makeDate(1, 9, 0),
      end_time: makeDate(1, 11, 0),
      estimated_flight_hours: 2.0,
      purpose: 'Vol local entraînement',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.LOCAL,
      number_of_passengers: 0,
    },
    {
      aircraft: aircraft[3], // Diamond DA40
      user: pilotes[2], // Lucas
      reservation_date: makeDate(2, 0),
      start_time: makeDate(2, 7, 30),
      end_time: makeDate(2, 12, 0),
      estimated_flight_hours: 4.5,
      purpose: 'Navigation LFBD - LFML (Marseille)',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.CROSS_COUNTRY,
      notes: 'Escale technique prévue à LFMT',
      number_of_passengers: 1,
    },
    {
      aircraft: aircraft[2], // Robin DR400
      user: pilotes[3], // Emma
      reservation_date: makeDate(3, 0),
      start_time: makeDate(3, 14, 0),
      end_time: makeDate(3, 16, 0),
      estimated_flight_hours: 2.0,
      purpose: 'Cours de pilotage - leçon 13',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.INSTRUCTION,
      notes: 'Leçon 13 : navigation à vue',
    },
    {
      aircraft: aircraft[4], // Cirrus SR22
      user: pilotes[4], // Antoine
      reservation_date: makeDate(4, 0),
      start_time: makeDate(4, 8, 0),
      end_time: makeDate(4, 14, 0),
      estimated_flight_hours: 6.0,
      purpose: 'Vol Paris-Nice aller-retour',
      status: ReservationStatus.PENDING,
      flight_category: FlightCategory.PRIVATE,
      notes: 'Déplacement professionnel',
      number_of_passengers: 1,
    },
    {
      aircraft: aircraft[1], // Piper Cherokee
      user: pilotes[1], // Sophie
      reservation_date: makeDate(5, 0),
      start_time: makeDate(5, 10, 0),
      end_time: makeDate(5, 12, 30),
      estimated_flight_hours: 2.5,
      purpose: 'Vol découverte avec ami',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.TOURISM,
      number_of_passengers: 1,
    },
    {
      aircraft: aircraft[0], // Cessna 172
      user: instructeurs[0], // Marie
      reservation_date: makeDate(6, 0),
      start_time: makeDate(6, 8, 0),
      end_time: makeDate(6, 12, 0),
      estimated_flight_hours: 4.0,
      purpose: 'Formation instructeur - séance évaluation',
      status: ReservationStatus.CONFIRMED,
      flight_category: FlightCategory.INSTRUCTION,
      notes: 'Évaluation finale pilote Sophie Bernard',
    },
  ];

  const savedReservations: Reservation[] = [];

  for (const data of demoReservations) {
    const reservation = reservationRepository.create(data);
    const saved = await reservationRepository.save(reservation);
    savedReservations.push(saved);
  }

  console.log(`${savedReservations.length} demo reservations created`);
  return savedReservations;
};
