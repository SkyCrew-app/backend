import { DataSource } from 'typeorm';
import { Role } from '../modules/roles/entity/roles.entity';

export const seedRoles = async (dataSource: DataSource): Promise<void> => {
  const roleRepository = dataSource.getRepository(Role);

  const rolesToCreate = [
    { role_name: 'Administrateur' },
    { role_name: 'Pilote' },
    { role_name: 'Instructeur' },
    { role_name: 'Technicien' },
    { role_name: 'Student' },
  ];

  for (const roleData of rolesToCreate) {
    const existingRole = await roleRepository.findOne({
      where: { role_name: roleData.role_name },
    });

    if (!existingRole) {
      const role = roleRepository.create(roleData);
      await roleRepository.save(role);
      console.log(`Role "${roleData.role_name}" created successfully`);
    } else {
      console.log(`Role "${roleData.role_name}" already exists`);
    }
  }

  console.log('Roles seeding completed');
};
