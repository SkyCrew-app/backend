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
import { AdminActionsService } from '../../../common/admin-actions/admin-actions.service';
import { ADMIN_ACTION } from '../../../common/admin-actions/admin-actions';

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
  let trace: { record: jest.Mock };
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
      storedStatus: jest.fn().mockResolvedValue({
        registration_number: 'RN',
        availability_status: AvailabilityStatus.AVAILABLE,
      }),
    };
    trace = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AircraftResolver,
        { provide: AircraftService, useValue: service },
        { provide: AdminActionsService, useValue: trace },
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

  describe("administrators' action log", () => {
    const admin = { id: 1, role: { role_name: 'Administrateur' } } as any;
    const target = { type: 'aircraft', id: 1, label: 'RN' };
    const stored = (availability_status: AvailabilityStatus) =>
      (service.storedStatus as jest.Mock).mockResolvedValue({
        registration_number: 'RN',
        availability_status,
      });
    const becomes = (availability_status: AvailabilityStatus) => ({
      ...sample,
      availability_status,
    });

    it('records an aircraft grounded by hand', async () => {
      service.updateStatus = jest
        .fn()
        .mockResolvedValue(becomes(AvailabilityStatus.UNAVAILABLE));

      await resolver.setAircraftAvailability(
        1,
        AvailabilityStatus.UNAVAILABLE,
        admin,
      );

      expect(trace.record).toHaveBeenCalledWith(
        admin,
        ADMIN_ACTION.AIRCRAFT_GROUNDED,
        target,
        { from: 'AVAILABLE', to: 'UNAVAILABLE' },
      );
    });

    it('records an aircraft put back in service, also from its form', async () => {
      stored(AvailabilityStatus.UNAVAILABLE);
      service.updateStatus = jest
        .fn()
        .mockResolvedValue(becomes(AvailabilityStatus.AVAILABLE));
      (service.update as jest.Mock).mockResolvedValue(
        becomes(AvailabilityStatus.AVAILABLE),
      );

      await resolver.setAircraftAvailability(
        1,
        AvailabilityStatus.AVAILABLE,
        admin,
      );
      await resolver.updateAircraft(
        1,
        { availability_status: AvailabilityStatus.AVAILABLE } as any,
        undefined,
        undefined,
        admin,
      );

      expect(trace.record).toHaveBeenCalledTimes(2);
      for (const call of trace.record.mock.calls) {
        expect(call).toEqual([
          admin,
          ADMIN_ACTION.AIRCRAFT_RETURNED_TO_SERVICE,
          target,
          { from: 'UNAVAILABLE', to: 'AVAILABLE' },
        ]);
      }
    });

    it('records nothing when the availability did not change', async () => {
      service.updateStatus = jest
        .fn()
        .mockResolvedValue(becomes(AvailabilityStatus.AVAILABLE));

      await resolver.setAircraftAvailability(
        1,
        AvailabilityStatus.AVAILABLE,
        admin,
      );
      await resolver.updateAircraft(1, { model: 'DR400' } as any);

      expect(trace.record).not.toHaveBeenCalled();
    });

    it('tells a deleted aircraft from a retired one', async () => {
      await resolver.deleteAircraft(1, admin);
      (service.remove as jest.Mock).mockResolvedValue(false);
      await resolver.deleteAircraft(1, admin);

      expect(trace.record.mock.calls).toEqual([
        [admin, ADMIN_ACTION.AIRCRAFT_DELETED, target],
        [admin, ADMIN_ACTION.AIRCRAFT_RETIRED, target],
      ]);
    });

    it('records nothing when the deletion is refused, and still acts when the aircraft cannot be read first', async () => {
      (service.remove as jest.Mock).mockRejectedValue(new Error('refusé'));
      await expect(resolver.deleteAircraft(1, admin)).rejects.toThrow('refusé');
      expect(trace.record).not.toHaveBeenCalled();

      (service.storedStatus as jest.Mock).mockRejectedValue(new Error('ko'));
      (service.remove as jest.Mock).mockResolvedValue(true);
      await expect(resolver.deleteAircraft(1, admin)).resolves.toBe(true);
    });
  });
});
