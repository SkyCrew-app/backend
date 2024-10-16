import { registerEnumType } from '@nestjs/graphql';

export enum MaintenanceType {
  INSPECTION = 'INSPECTION',
  REPAIR = 'REPAIR',
  OVERHAUL = 'OVERHAUL',
  SOFTWARE_UPDATE = 'SOFTWARE_UPDATE',
  CLEANING = 'CLEANING',
  OTHER = 'OTHER',
}

registerEnumType(MaintenanceType, {
  name: 'MaintenanceType',
});
