/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { AircraftResolver } from '../aircraft.resolver';
import { AircraftService } from '../aircraft.service';
import { Aircraft, AvailabilityStatus } from '../entity/aircraft.entity';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { FileUpload, ReadStream, WriteStream } from 'graphql-upload-ts';
import { Readable } from 'stream';
import { saveUploadToTmp } from '../../../common/uploads/save-upload';

jest.mock('../../../common/uploads/save-upload', () => ({
  saveUploadToTmp: jest.fn(),
}));

// Bypass guards
jest.mock('@nestjs/common', () => {
  const original = jest.requireActual('@nestjs/common');
  return {
    ...original,
    UseGuards: () => (target: any, key?: any, descriptor?: any) => {},
  };
});

describe('AircraftResolver', () => {
  let resolver: AircraftResolver;
  let service: Partial<AircraftService>;
  const sample: Aircraft = {
    id: 1,
    registration_number: 'RN',
    model: 'M',
    year_of_manufacture: 2020,
    availability_status: undefined,
    maintenance_status: '',
    hourly_cost: 0,
    total_flight_hours: 0,
    reservations: [],
    maintenances: [],
    audits: [],
  } as any;
  const fakeFile: FileUpload = {
    filename: 'test.txt',
    mimetype: 'text/plain',
    encoding: 'utf8',
    createReadStream: () => Readable.from(['data']) as unknown as ReadStream,
    fieldName: '',
    capacitor: new WriteStream(),
  };

  beforeEach(async () => {
    (saveUploadToTmp as jest.Mock).mockReset();
    (saveUploadToTmp as jest.Mock).mockImplementation(
      async (_upload, kind) => `/tmp/${kind}`,
    );
    service = {
      findAll: jest.fn().mockResolvedValue([sample]),
      create: jest.fn().mockResolvedValue(sample),
      update: jest.fn().mockResolvedValue(sample),
      remove: jest.fn().mockResolvedValue(true),
      aircraftHistory: jest.fn().mockResolvedValue([sample]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AircraftResolver,
        { provide: AircraftService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get<AircraftResolver>(AircraftResolver);
  });

  it('getAircrafts devrait appeler service.findAll', async () => {
    const res = await resolver.getAircrafts();
    expect(service.findAll).toHaveBeenCalled();
    expect(res).toEqual([sample]);
  });

  it('createAircraft devrait gérer upload de file et image', async () => {
    const res = await resolver.createAircraft({} as any, fakeFile, fakeFile);
    expect(saveUploadToTmp).toHaveBeenCalledWith(fakeFile, 'document');
    expect(saveUploadToTmp).toHaveBeenCalledWith(fakeFile, 'picture');
    expect(service.create).toHaveBeenCalledWith(
      {} as any,
      ['/tmp/document'],
      '/tmp/picture',
    );
    expect(res).toEqual(sample);
  });

  it('updateAircraft devrait gérer upload et appeler service.update', async () => {
    const res = await resolver.updateAircraft(1, {} as any, fakeFile, fakeFile);
    expect(saveUploadToTmp).toHaveBeenCalledWith(fakeFile, 'document');
    expect(saveUploadToTmp).toHaveBeenCalledWith(fakeFile, 'picture');
    expect(service.update).toHaveBeenCalledWith(
      1,
      {} as any,
      ['/tmp/document'],
      '/tmp/picture',
    );
    expect(res).toEqual(sample);
  });

  it('ne crée ni ne modifie rien quand un fichier est refusé', async () => {
    (saveUploadToTmp as jest.Mock).mockRejectedValue(
      new Error('Type de fichier non autorisé'),
    );

    await expect(
      resolver.createAircraft({} as any, fakeFile, undefined),
    ).rejects.toThrow('Type de fichier non autorisé');
    await expect(
      resolver.updateAircraft(1, {} as any, undefined, fakeFile),
    ).rejects.toThrow('Type de fichier non autorisé');
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('getHistoryAircraft devrait appeler service.aircraftHistory', async () => {
    const res = await resolver.getHistoryAircraft();
    expect(service.aircraftHistory).toHaveBeenCalled();
    expect(res).toEqual([sample]);
  });

  it('deleteAircraft devrait appeler service.remove', async () => {
    const res = await resolver.deleteAircraft(1);
    expect(service.remove).toHaveBeenCalledWith(1);
    expect(res).toBe(true);
  });

  it('setAircraftAvailability is for administrators and technicians', async () => {
    const roles = new Reflector().get<string[]>(
      ROLES_KEY,
      AircraftResolver.prototype.setAircraftAvailability,
    );
    expect(roles).toEqual(['Administrateur', 'Technicien']);

    service.updateStatus = jest.fn().mockResolvedValue(sample);
    await expect(
      resolver.setAircraftAvailability(1, AvailabilityStatus.AVAILABLE),
    ).resolves.toEqual(sample);
    expect(service.updateStatus).toHaveBeenCalledWith(
      1,
      AvailabilityStatus.AVAILABLE,
    );
  });
});
