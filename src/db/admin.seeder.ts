import { DataSource } from 'typeorm';
import { Administration } from '../modules/administration/entity/admin.entity';

export const seedAdministration = async (
  dataSource: DataSource,
): Promise<void> => {
  const administrationRepository = dataSource.getRepository(Administration);

  const existingAdmin = await administrationRepository.findOne({
    where: { id: 1 },
  });

  if (existingAdmin) {
    console.log('Administration configuration already exists');
    return;
  }

  const administration = administrationRepository.create({
    clubName: 'SkyCrew Aviation Club',
    contactEmail: 'contact@skycrew.com',
    contactPhone: '+33123456789',
    address: '123 Airport Road, 75000 Paris, France',
    closureDays: ['Sunday'],
    timeSlotDuration: 30,
    reservationStartTime: '08:00',
    reservationEndTime: '20:00',
    maintenanceDay: 'Monday',
    maintenanceDuration: 4,
    pilotLicenses: ['PPL', 'CPL', 'ATPL', 'ULM'],
    membershipFee: 250.0,
    flightHourRate: 180.0,
    clubRules:
      'All pilots must adhere to club safety protocols. Reservations must be made at least 24 hours in advance.',
    allowGuestPilots: true,
    guestPilotFee: 50.0,
    fuelManagement: 'self-service',
    isMaintenanceActive: false,
    maintenanceMessage: null,
    maintenanceTime: null,
    taxonomies: null,
    fuelPrice: 2.45,
  });

  await administrationRepository.save(administration);
  console.log('Administration configuration created successfully');
};
