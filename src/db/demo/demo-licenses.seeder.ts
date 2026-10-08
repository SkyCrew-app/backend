import { DataSource } from 'typeorm';
import { License } from '../../modules/licenses/entity/licenses.entity';
import { User } from '../../modules/users/entity/users.entity';

export const seedDemoLicenses = async (
  dataSource: DataSource,
  users: User[],
): Promise<void> => {
  const licenseRepository = dataSource.getRepository(License);

  const now = new Date();
  const pilotes = [users[1], users[4], users[5], users[8], users[9]];
  const instructeurs = [users[2], users[6]];

  const demoLicenses = [
    // Jean - PPL valide
    {
      user: pilotes[0],
      license_type: 'PPL',
      license_number: 'PPL-FR-2019-4521',
      issue_date: new Date('2019-06-15'),
      expiration_date: new Date(now.getTime() + 180 * 24 * 3600000),
      certification_authority: 'DGAC',
      is_valid: true,
      status: 'active' as const,
    },
    // Jean - Qualification SEP
    {
      user: pilotes[0],
      license_type: 'SEP',
      license_number: 'SEP-FR-2019-4521',
      issue_date: new Date('2023-06-15'),
      expiration_date: new Date(now.getTime() + 90 * 24 * 3600000),
      certification_authority: 'DGAC',
      is_valid: true,
      status: 'active' as const,
    },
    // Sophie - PPL valide mais bientôt expiré
    {
      user: pilotes[1],
      license_type: 'PPL',
      license_number: 'PPL-FR-2023-8912',
      issue_date: new Date('2023-11-20'),
      expiration_date: new Date(now.getTime() + 30 * 24 * 3600000),
      certification_authority: 'DGAC',
      is_valid: true,
      status: 'active' as const,
    },
    // Lucas - PPL + CPL
    {
      user: pilotes[2],
      license_type: 'PPL',
      license_number: 'PPL-FR-2016-2234',
      issue_date: new Date('2016-03-10'),
      expiration_date: new Date(now.getTime() + 300 * 24 * 3600000),
      certification_authority: 'DGAC',
      is_valid: true,
      status: 'active' as const,
    },
    {
      user: pilotes[2],
      license_type: 'CPL',
      license_number: 'CPL-FR-2020-1187',
      issue_date: new Date('2020-09-01'),
      expiration_date: new Date(now.getTime() + 250 * 24 * 3600000),
      certification_authority: 'DGAC',
      is_valid: true,
      status: 'active' as const,
    },
    // Emma - PPL en cours (élève pilote)
    {
      user: pilotes[3],
      license_type: 'PPL',
      license_number: 'PPL-FR-2025-PEND',
      issue_date: null,
      expiration_date: null,
      certification_authority: 'DGAC',
      is_valid: false,
      status: 'pending' as const,
    },
    // Antoine - PPL + IR
    {
      user: pilotes[4],
      license_type: 'PPL',
      license_number: 'PPL-FR-2014-0567',
      issue_date: new Date('2014-05-22'),
      expiration_date: new Date(now.getTime() + 400 * 24 * 3600000),
      certification_authority: 'DGAC',
      is_valid: true,
      status: 'active' as const,
    },
    {
      user: pilotes[4],
      license_type: 'IR',
      license_number: 'IR-FR-2018-0567',
      issue_date: new Date('2018-11-10'),
      expiration_date: new Date(now.getTime() + 60 * 24 * 3600000),
      certification_authority: 'DGAC',
      is_valid: true,
      status: 'active' as const,
    },
    // Marie - ATPL + FI (instructeur)
    {
      user: instructeurs[0],
      license_type: 'ATPL',
      license_number: 'ATPL-FR-2010-0198',
      issue_date: new Date('2010-02-14'),
      expiration_date: new Date(now.getTime() + 500 * 24 * 3600000),
      certification_authority: 'DGAC',
      is_valid: true,
      status: 'active' as const,
    },
    {
      user: instructeurs[0],
      license_type: 'FI',
      license_number: 'FI-FR-2012-0198',
      issue_date: new Date('2012-07-01'),
      expiration_date: new Date(now.getTime() + 365 * 24 * 3600000),
      certification_authority: 'DGAC',
      is_valid: true,
      status: 'active' as const,
    },
    // Camille - CPL + FI
    {
      user: instructeurs[1],
      license_type: 'CPL',
      license_number: 'CPL-FR-2015-3344',
      issue_date: new Date('2015-04-18'),
      expiration_date: new Date(now.getTime() + 350 * 24 * 3600000),
      certification_authority: 'DGAC',
      is_valid: true,
      status: 'active' as const,
    },
    {
      user: instructeurs[1],
      license_type: 'FI',
      license_number: 'FI-FR-2018-3344',
      issue_date: new Date('2018-01-15'),
      expiration_date: new Date(now.getTime() + 200 * 24 * 3600000),
      certification_authority: 'DGAC',
      is_valid: true,
      status: 'active' as const,
    },
  ];

  for (const data of demoLicenses) {
    const license = licenseRepository.create(data);
    await licenseRepository.save(license);
  }

  console.log(`${demoLicenses.length} demo licenses created`);
};
