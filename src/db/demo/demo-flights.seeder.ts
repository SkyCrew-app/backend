import { DataSource } from 'typeorm';
import { Flight } from '../../modules/flights/entity/flights.entity';
import { User } from '../../modules/users/entity/users.entity';
import { Reservation } from '../../modules/reservations/entity/reservations.entity';

export const seedDemoFlights = async (
  dataSource: DataSource,
  users: User[],
  reservations: Reservation[],
): Promise<Flight[]> => {
  const flightRepository = dataSource.getRepository(Flight);

  // Admin reservations are indices 0-5, other user reservations start at 6
  const admin = users[0];
  const pilotes = [users[1], users[4], users[5], users[8], users[9]];
  const adminReservations = reservations.slice(0, 3); // 3 past admin reservations
  const otherPastReservations = reservations.slice(6, 11); // past reservations for other users

  const demoFlights = [
    // ===== Vols du compte DEMO ADMIN =====
    {
      reservation: adminReservations[0], // Vol contrôle flotte
      user: admin,
      flight_hours: 2.8,
      flight_type: 'VFR',
      origin_icao: 'LFPG',
      destination_icao: 'LFPG',
      weather_conditions: 'CAVOK, vent 05kt 180°',
      number_of_passengers: 0,
      distance_km: 95,
      estimated_flight_time: 3.0,
      departure_time: adminReservations[0].start_time,
      arrival_time: new Date(adminReservations[0].start_time.getTime() + 2.8 * 3600000),
      remarks: 'Vol de contrôle Cessna 172 post-maintenance. Tous systèmes nominaux. RAS.',
      estimated_fuel_liters: 90,
      performance_profile: 'standard',
    },
    {
      reservation: adminReservations[1], // Nav Paris-Lyon
      user: admin,
      flight_hours: 3.5,
      flight_type: 'VFR',
      origin_icao: 'LFPG',
      destination_icao: 'LFLL',
      weather_conditions: 'SCT035, visibilité >10km, vent 12kt 270°',
      number_of_passengers: 1,
      distance_km: 395,
      estimated_flight_time: 4.0,
      departure_time: adminReservations[1].start_time,
      arrival_time: new Date(adminReservations[1].start_time.getTime() + 3.5 * 3600000),
      remarks: 'Navigation Paris-Lyon pour réunion aéroclub partenaire. Vol nominal, arrivée avec 15min d\'avance grâce au vent favorable.',
      estimated_fuel_liters: 88,
      performance_profile: 'economy',
    },
    {
      reservation: adminReservations[2], // Vol touristique côte normande
      user: admin,
      flight_hours: 2.2,
      flight_type: 'VFR',
      origin_icao: 'LFPG',
      destination_icao: 'LFPG',
      weather_conditions: 'FEW040, visibilité >10km, vent calme',
      number_of_passengers: 2,
      distance_km: 320,
      estimated_flight_time: 2.5,
      departure_time: adminReservations[2].start_time,
      arrival_time: new Date(adminReservations[2].start_time.getTime() + 2.2 * 3600000),
      remarks: 'Survol côte normande : Étretat, Honfleur, Deauville. Conditions météo parfaites. Passagers ravis.',
      estimated_fuel_liters: 110,
      performance_profile: 'standard',
    },
    // Vols historiques admin sans reservation
    {
      user: admin,
      flight_hours: 1.5,
      flight_type: 'VFR',
      origin_icao: 'LFPG',
      destination_icao: 'LFPG',
      weather_conditions: 'CAVOK',
      number_of_passengers: 0,
      distance_km: 50,
      estimated_flight_time: 1.5,
      departure_time: new Date(Date.now() - 25 * 24 * 3600000),
      arrival_time: new Date(Date.now() - 25 * 24 * 3600000 + 1.5 * 3600000),
      remarks: 'Tours de piste - maintien de compétences.',
      estimated_fuel_liters: 48,
      performance_profile: 'standard',
    },
    {
      user: admin,
      flight_hours: 5.2,
      flight_type: 'VFR',
      origin_icao: 'LFPG',
      destination_icao: 'LFBO',
      weather_conditions: 'FEW030, vent 08kt 220°',
      number_of_passengers: 1,
      distance_km: 590,
      estimated_flight_time: 5.0,
      departure_time: new Date(Date.now() - 35 * 24 * 3600000),
      arrival_time: new Date(Date.now() - 35 * 24 * 3600000 + 5.2 * 3600000),
      remarks: 'Navigation Paris-Toulouse. Escale technique à Limoges (LFBL). Vol agréable.',
      estimated_fuel_liters: 130,
      performance_profile: 'standard',
    },
    {
      user: admin,
      flight_hours: 2.0,
      flight_type: 'IFR',
      origin_icao: 'LFPG',
      destination_icao: 'LFPG',
      weather_conditions: 'OVC012, visibilité 4km brume',
      number_of_passengers: 0,
      distance_km: 70,
      estimated_flight_time: 2.0,
      departure_time: new Date(Date.now() - 45 * 24 * 3600000),
      arrival_time: new Date(Date.now() - 45 * 24 * 3600000 + 2.0 * 3600000),
      remarks: 'Entraînement IFR conditions réelles. 2 approches ILS piste 26L.',
      estimated_fuel_liters: 64,
      performance_profile: 'standard',
    },
    // ===== Vols des autres pilotes =====
    {
      reservation: otherPastReservations[0],
      user: pilotes[0], // Jean
      flight_hours: 2.3,
      flight_type: 'VFR',
      origin_icao: 'LFPO',
      destination_icao: 'LFPO',
      weather_conditions: 'CAVOK, vent 08kt 240°',
      number_of_passengers: 1,
      distance_km: 85,
      estimated_flight_time: 2.5,
      departure_time: otherPastReservations[0].start_time,
      arrival_time: new Date(otherPastReservations[0].start_time.getTime() + 2.3 * 3600000),
      remarks: 'Vol local sans incident. 6 tours de piste + zone sud.',
      estimated_fuel_liters: 74,
      performance_profile: 'standard',
    },
    {
      reservation: otherPastReservations[1],
      user: pilotes[2], // Lucas
      flight_hours: 2.8,
      flight_type: 'VFR',
      origin_icao: 'LFBD',
      destination_icao: 'LFBO',
      weather_conditions: 'SCT025, visibilité 8km, vent variable 5kt',
      number_of_passengers: 2,
      distance_km: 210,
      estimated_flight_time: 3.0,
      departure_time: otherPastReservations[1].start_time,
      arrival_time: new Date(otherPastReservations[1].start_time.getTime() + 2.8 * 3600000),
      remarks: 'Navigation nominale. Léger retard au départ (attente clairance).',
      estimated_fuel_liters: 84,
      performance_profile: 'standard',
    },
    {
      reservation: otherPastReservations[2],
      user: pilotes[3], // Emma
      flight_hours: 1.8,
      flight_type: 'VFR',
      origin_icao: 'LFRS',
      destination_icao: 'LFRS',
      weather_conditions: 'FEW030, vent 15kt 310° rafales 22kt',
      number_of_passengers: 0,
      distance_km: 45,
      estimated_flight_time: 2.0,
      departure_time: otherPastReservations[2].start_time,
      arrival_time: new Date(otherPastReservations[2].start_time.getTime() + 1.8 * 3600000),
      remarks: 'Leçon vent de travers réussie. 8 atterrissages avec vent 310/15G22.',
      estimated_fuel_liters: 50,
      performance_profile: 'training',
    },
    {
      reservation: otherPastReservations[3],
      user: pilotes[4], // Antoine
      flight_hours: 2.9,
      flight_type: 'VFR',
      origin_icao: 'LFST',
      destination_icao: 'LFBZ',
      weather_conditions: 'CAVOK, visibilité >10km',
      number_of_passengers: 2,
      distance_km: 680,
      estimated_flight_time: 3.0,
      departure_time: otherPastReservations[3].start_time,
      arrival_time: new Date(otherPastReservations[3].start_time.getTime() + 2.9 * 3600000),
      remarks: 'Vol touristique côte basque magnifique. Conditions météo idéales.',
      estimated_fuel_liters: 73,
      performance_profile: 'economy',
    },
    {
      reservation: otherPastReservations[4],
      user: pilotes[1], // Sophie
      flight_hours: 1.7,
      flight_type: 'IFR',
      origin_icao: 'LFLL',
      destination_icao: 'LFLL',
      weather_conditions: 'OVC015, visibilité 5km brume',
      number_of_passengers: 0,
      distance_km: 60,
      estimated_flight_time: 2.0,
      departure_time: otherPastReservations[4].start_time,
      arrival_time: new Date(otherPastReservations[4].start_time.getTime() + 1.7 * 3600000),
      remarks: 'Entraînement VSV sous capote. Approche ILS piste 36L.',
      estimated_fuel_liters: 54,
      performance_profile: 'standard',
    },
    // Vols supplementaires sans reservation (historique)
    {
      user: pilotes[0], // Jean
      flight_hours: 1.5,
      flight_type: 'VFR',
      origin_icao: 'LFPO',
      destination_icao: 'LFPO',
      weather_conditions: 'CAVOK',
      number_of_passengers: 0,
      distance_km: 40,
      estimated_flight_time: 1.5,
      departure_time: new Date(Date.now() - 14 * 24 * 3600000),
      arrival_time: new Date(Date.now() - 14 * 24 * 3600000 + 1.5 * 3600000),
      remarks: 'Tours de piste entrainement solo.',
      estimated_fuel_liters: 48,
      performance_profile: 'standard',
    },
    {
      user: pilotes[4], // Antoine
      flight_hours: 4.2,
      flight_type: 'VFR',
      origin_icao: 'LFST',
      destination_icao: 'LFPG',
      weather_conditions: 'FEW040, vent 10kt 180°',
      number_of_passengers: 1,
      distance_km: 400,
      estimated_flight_time: 4.0,
      departure_time: new Date(Date.now() - 21 * 24 * 3600000),
      arrival_time: new Date(Date.now() - 21 * 24 * 3600000 + 4.2 * 3600000),
      remarks: 'Navigation Strasbourg-Paris. Passage en transit zone P23.',
      estimated_fuel_liters: 210,
      performance_profile: 'standard',
    },
    {
      user: pilotes[2], // Lucas
      flight_hours: 3.5,
      flight_type: 'VFR',
      origin_icao: 'LFBD',
      destination_icao: 'LFBP',
      weather_conditions: 'SCT030, vent calme',
      number_of_passengers: 3,
      distance_km: 195,
      estimated_flight_time: 3.5,
      departure_time: new Date(Date.now() - 10 * 24 * 3600000),
      arrival_time: new Date(Date.now() - 10 * 24 * 3600000 + 3.5 * 3600000),
      remarks: 'Vol vers Pau avec passagers. Vue sur les Pyrénées.',
      estimated_fuel_liters: 105,
      performance_profile: 'standard',
    },
  ];

  const savedFlights: Flight[] = [];

  for (const data of demoFlights) {
    const flight = flightRepository.create(data);
    const saved = await flightRepository.save(flight);
    savedFlights.push(saved);
  }

  console.log(`${savedFlights.length} demo flights created`);
  return savedFlights;
};
