import { DataSource } from 'typeorm';
import { User } from '../modules/users/entity/users.entity';
import { Role } from '../modules/roles/entity/roles.entity';
import * as bcrypt from 'bcrypt';

export const seedAdminUser = async (dataSource: DataSource): Promise<void> => {
  const userRepository = dataSource.getRepository(User);
  const roleRepository = dataSource.getRepository(Role);

  const existingAdmin = await userRepository.findOne({
    where: { email: 'admin@example.com' },
  });

  if (existingAdmin) {
    console.log('Admin user already exists');
    return;
  }

  const adminRole = await roleRepository.findOne({
    where: { role_name: 'Administrateur' },
  });

  if (!adminRole) {
    throw new Error('Admin role not found. Please seed roles first.');
  }

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(
    'uAsLYpaZSV3guAj-e-biupo',
    saltRounds,
  );

  const adminUser = userRepository.create({
    first_name: 'Admin',
    last_name: 'User',
    email: 'admin@example.com',
    password: hashedPassword,
    is2FAEnabled: false,
    isEmailConfirmed: true,
    date_of_birth: new Date('1980-01-01'),
    user_account_balance: 0,
    email_notifications_enabled: true,
    sms_notifications_enabled: false,
    newsletter_subscribed: true,
    role: adminRole,
  });

  await userRepository.save(adminUser);
  console.log('Admin user created successfully');
};
