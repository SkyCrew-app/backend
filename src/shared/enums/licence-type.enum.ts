import { registerEnumType } from '@nestjs/graphql';

export enum LicenseType {
  PPL = 'PPL',
  ATPL = 'ATPL',
  CPL = 'CPL',
}

registerEnumType(LicenseType, {
  name: 'LicenseType',
  description: 'The type of pilot license required for a course',
});
