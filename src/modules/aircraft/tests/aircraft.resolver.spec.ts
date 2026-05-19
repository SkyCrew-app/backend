/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { AircraftResolver } from '../aircraft.resolver';
import { AircraftService } from '../aircraft.service';
import { Aircraft } from '../entity/aircraft.entity';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { FileUpload, ReadStream, WriteStream } from 'graphql-upload-ts';
import { Readable } from 'stream';

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
    expect(service.create).toHaveBeenCalledWith(
      {} as any,
      expect.any(Array),
      expect.any(String),
    );
    expect(res).toEqual(sample);
  });

  it('updateAircraft devrait gérer upload et appeler service.update', async () => {
    const res = await resolver.updateAircraft(1, {} as any, fakeFile, fakeFile);
    expect(service.update).toHaveBeenCalledWith(
      1,
      {} as any,
      expect.any(Array),
      expect.any(String),
    );
    expect(res).toEqual(sample);
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
});
