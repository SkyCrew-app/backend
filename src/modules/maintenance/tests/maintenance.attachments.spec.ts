import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MaintenanceService } from '../maintenance.service';

describe('MaintenanceService attachments', () => {
  let service: MaintenanceService;
  let repository: { findOne: jest.Mock; save: jest.Mock };
  let directory: string;

  const temporaryFile = (name: string, content = name) => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-'));
    const file = path.join(folder, name);
    fs.writeFileSync(file, content);
    return file;
  };

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (m) => m),
    };
    service = new MaintenanceService(
      repository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-'));
    jest
      .spyOn(service as any, 'attachmentsDirectory')
      .mockReturnValue(directory);
    jest.spyOn(service as any, 'assignTechnician').mockResolvedValue(undefined);
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('adds new files to the ones already attached', async () => {
    fs.writeFileSync(path.join(directory, 'ancien.pdf'), 'old');
    repository.findOne.mockResolvedValue({
      id: 4,
      documents_url: ['/uploads/maintenance/4/ancien.pdf'],
      images_url: null,
    });

    const result = await service.update(
      { id: 4 } as any,
      [temporaryFile('nouveau.pdf')],
      [temporaryFile('photo.png')],
    );

    expect(result.documents_url).toEqual([
      '/uploads/maintenance/4/ancien.pdf',
      '/uploads/maintenance/4/nouveau.pdf',
    ]);
    expect(result.images_url).toEqual(['/uploads/maintenance/4/photo.png']);
    expect(fs.readdirSync(directory).sort()).toEqual([
      'ancien.pdf',
      'nouveau.pdf',
      'photo.png',
    ]);
  });

  it('keeps both files when a new one has the name of an existing one', async () => {
    fs.writeFileSync(path.join(directory, 'rapport.pdf'), 'first');
    repository.findOne.mockResolvedValue({
      id: 4,
      documents_url: ['/uploads/maintenance/4/rapport.pdf'],
      images_url: [],
    });

    const result = await service.update(
      { id: 4 } as any,
      [temporaryFile('rapport.pdf', 'second')],
      [],
    );

    expect(result.documents_url).toEqual([
      '/uploads/maintenance/4/rapport.pdf',
      '/uploads/maintenance/4/rapport-2.pdf',
    ]);
    expect(fs.readFileSync(path.join(directory, 'rapport.pdf'), 'utf8')).toBe(
      'first',
    );
  });

  it('removes one attachment and leaves the others', async () => {
    fs.writeFileSync(path.join(directory, 'a.pdf'), 'a');
    fs.writeFileSync(path.join(directory, 'b.pdf'), 'b');
    repository.findOne.mockResolvedValue({
      id: 4,
      documents_url: [
        '/uploads/maintenance/4/a.pdf',
        '/uploads/maintenance/4/b.pdf',
      ],
      images_url: ['/uploads/maintenance/4/photo.png'],
    });

    const result = await service.removeAttachment(
      4,
      '/uploads/maintenance/4/a.pdf',
    );

    expect(result.documents_url).toEqual(['/uploads/maintenance/4/b.pdf']);
    expect(result.images_url).toEqual(['/uploads/maintenance/4/photo.png']);
    expect(fs.readdirSync(directory)).toEqual(['b.pdf']);
  });

  it('refuses an address that is not an attachment of the maintenance', async () => {
    const outside = path.join(os.tmpdir(), `outside-${Date.now()}.txt`);
    fs.writeFileSync(outside, 'keep');
    repository.findOne.mockResolvedValue({
      id: 4,
      documents_url: ['/uploads/maintenance/4/a.pdf'],
      images_url: [],
    });

    await expect(
      service.removeAttachment(4, `../../../${path.basename(outside)}`),
    ).rejects.toThrow(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
    expect(fs.existsSync(outside)).toBe(true);
    fs.rmSync(outside, { force: true });
  });

  it('answers not found for an unknown maintenance', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.removeAttachment(404, '/x')).rejects.toThrow(
      NotFoundException,
    );
  });
});
