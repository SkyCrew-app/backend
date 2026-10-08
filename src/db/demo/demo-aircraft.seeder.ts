import { DataSource } from 'typeorm';
import { Aircraft, AvailabilityStatus } from '../../modules/aircraft/entity/aircraft.entity';

export const seedDemoAircraft = async (
  dataSource: DataSource,
): Promise<Aircraft[]> => {
  const aircraftRepository = dataSource.getRepository(Aircraft);

  const demoAircraft = [
    {
      registration_number: 'F-GSKY',
      model: 'Cessna 172 Skyhawk',
      year_of_manufacture: 2018,
      maxAltitude: 14000,
      cruiseSpeed: 122,
      consumption: 32,
      fuel_capacity: 212,
      fuel_type: '100LL',
      empty_weight: 767,
      max_takeoff_weight: 1111,
      hourly_cost: 165.00,
      total_flight_hours: 1245,
      availability_status: AvailabilityStatus.AVAILABLE,
      maintenance_status: 'OK',
      image_url: null,
    },
    {
      registration_number: 'F-HCRE',
      model: 'Piper PA-28 Cherokee',
      year_of_manufacture: 2015,
      maxAltitude: 13000,
      cruiseSpeed: 117,
      consumption: 30,
      fuel_capacity: 189,
      fuel_type: '100LL',
      empty_weight: 635,
      max_takeoff_weight: 1055,
      hourly_cost: 155.00,
      total_flight_hours: 2340,
      availability_status: AvailabilityStatus.AVAILABLE,
      maintenance_status: 'OK',
      image_url: null,
    },
    {
      registration_number: 'F-GAER',
      model: 'Robin DR400-140B',
      year_of_manufacture: 2012,
      maxAltitude: 12000,
      cruiseSpeed: 115,
      consumption: 28,
      fuel_capacity: 110,
      fuel_type: '100LL',
      empty_weight: 580,
      max_takeoff_weight: 1000,
      hourly_cost: 145.00,
      total_flight_hours: 3800,
      availability_status: AvailabilityStatus.AVAILABLE,
      maintenance_status: 'OK',
      image_url: null,
    },
    {
      registration_number: 'F-HTBA',
      model: 'Diamond DA40 NG',
      year_of_manufacture: 2020,
      maxAltitude: 16400,
      cruiseSpeed: 145,
      consumption: 25,
      fuel_capacity: 148,
      fuel_type: 'JET-A1',
      empty_weight: 865,
      max_takeoff_weight: 1280,
      hourly_cost: 210.00,
      total_flight_hours: 620,
      availability_status: AvailabilityStatus.AVAILABLE,
      maintenance_status: 'OK',
      image_url: null,
    },
    {
      registration_number: 'F-GPIL',
      model: 'Cirrus SR22',
      year_of_manufacture: 2019,
      maxAltitude: 17500,
      cruiseSpeed: 176,
      consumption: 50,
      fuel_capacity: 332,
      fuel_type: '100LL',
      empty_weight: 1009,
      max_takeoff_weight: 1542,
      hourly_cost: 280.00,
      total_flight_hours: 890,
      availability_status: AvailabilityStatus.AVAILABLE,
      maintenance_status: 'OK',
      image_url: null,
    },
    {
      registration_number: 'F-HMTX',
      model: 'Tecnam P2002 Sierra',
      year_of_manufacture: 2021,
      maxAltitude: 14000,
      cruiseSpeed: 110,
      consumption: 18,
      fuel_capacity: 100,
      fuel_type: '100LL',
      empty_weight: 375,
      max_takeoff_weight: 600,
      hourly_cost: 120.00,
      total_flight_hours: 310,
      availability_status: AvailabilityStatus.UNAVAILABLE,
      maintenance_status: 'Visite 100h en cours',
      image_url: null,
    },
  ];

  const savedAircraft: Aircraft[] = [];

  for (const data of demoAircraft) {
    const existing = await aircraftRepository.findOne({
      where: { registration_number: data.registration_number },
    });

    if (!existing) {
      const aircraft = aircraftRepository.create(data);
      const saved = await aircraftRepository.save(aircraft);
      savedAircraft.push(saved);
      console.log(`Demo aircraft "${data.registration_number} (${data.model})" created`);
    } else {
      savedAircraft.push(existing);
      console.log(`Demo aircraft "${data.registration_number}" already exists`);
    }
  }

  console.log('Demo aircraft seeding completed');
  return savedAircraft;
};
