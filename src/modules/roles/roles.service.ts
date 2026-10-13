import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entity/roles.entity';
import { CreateRoleInput } from './dto/create-role.input';
import { UpdateRoleInput } from './dto/update-role.input';
import { BUILT_IN_ROLES } from '../../common/auth/access';
import { localized } from '../../common/i18n/localized-exception';
import { User } from '../users/entity/users.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}

  // A usable name that no other role carries, whatever the case.
  private async freeName(wanted: string, exceptId?: number): Promise<string> {
    const name = (wanted ?? '').trim();
    if (!name) {
      throw localized(BadRequestException, 'error.role.nameRequired');
    }

    const roles = await this.rolesRepository.find();
    const taken = roles.some(
      (role) =>
        role.id !== exceptId &&
        role.role_name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (taken) {
      throw localized(ConflictException, 'error.role.nameAlreadyUsed');
    }
    return name;
  }

  // The application looks these roles up by name: see BUILT_IN_ROLES.
  private assertNotBuiltIn(role: Role): void {
    if (BUILT_IN_ROLES.includes(role.role_name)) {
      throw localized(ForbiddenException, 'error.role.builtIn', {
        name: role.role_name,
      });
    }
  }

  async createRole(createRoleInput: CreateRoleInput): Promise<Role> {
    const role = this.rolesRepository.create({
      role_name: await this.freeName(createRoleInput.role_name),
    });
    return this.rolesRepository.save(role);
  }

  async findAll(): Promise<Role[]> {
    return this.rolesRepository.find();
  }

  async findOne(id: number): Promise<Role> {
    const role = await this.rolesRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }

  async updateRole(updateRoleInput: UpdateRoleInput): Promise<Role> {
    const role = await this.findOne(updateRoleInput.id);
    if (
      updateRoleInput.role_name == null ||
      updateRoleInput.role_name === role.role_name
    ) {
      return role;
    }

    this.assertNotBuiltIn(role);
    role.role_name = await this.freeName(updateRoleInput.role_name, role.id);
    return this.rolesRepository.save(role);
  }

  async deleteRole(id: number): Promise<boolean> {
    const role = await this.findOne(id);
    this.assertNotBuiltIn(role);

    const members = await this.rolesRepository.manager
      .getRepository(User)
      .count({ where: { role: { id } } });
    if (members > 0) {
      throw localized(ConflictException, 'error.role.inUse', {
        count: members,
      });
    }

    await this.rolesRepository.delete(id);
    return true;
  }
}
