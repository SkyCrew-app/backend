import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { DataSource } from 'typeorm';
import { SessionUser } from '../auth/access';
import { decideUploadAccess } from '../uploads/upload-access';
import { License } from '../../modules/licenses/entity/licenses.entity';
import { holdersOfLicenceDocument } from '../../modules/licenses/licenses.service';

// One name of a file or directory: no separator, no way up.
const isPlainName = (name: string): boolean =>
  !!name &&
  name !== '.' &&
  name !== '..' &&
  !/[/\\\0]/.test(name) &&
  path.basename(name) === name;

// Serves a file of a directory directly under /uploads to a signed-in member,
// with the same rules as /uploads itself (see upload-access).
@Controller('files')
export class FileController {
  // The database is only needed for licence documents: looked up on demand,
  // so that the module registering this controller needs nothing more.
  constructor(private readonly moduleRef: ModuleRef) {}

  @Get(':aircraftId/:filename')
  async getFile(
    @Param('aircraftId') directory: string,
    @Param('filename') filename: string,
    @Res() res: Response,
    @Req() req?: Request & { user?: SessionUser },
  ) {
    const uploadsRoot = path.resolve(__dirname, '../../uploads');
    const filePath = path.resolve(uploadsRoot, directory ?? '', filename ?? '');

    // Refuse anything that is not a file directly in a directory of uploads.
    if (
      !isPlainName(directory) ||
      !isPlainName(filename) ||
      !filePath.startsWith(uploadsRoot + path.sep)
    ) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    const decision = await decideUploadAccess(
      [directory, filename],
      req?.user,
      (documentUrl) =>
        holdersOfLicenceDocument(
          this.moduleRef
            .get(DataSource, { strict: false })
            .getRepository(License),
          documentUrl,
        ),
    );
    if (decision !== 'allowed') {
      const refused = decision === 'unauthenticated';
      res
        .status(refused ? 401 : 403)
        .json({ message: refused ? 'Unauthorized' : 'Forbidden' });
      return;
    }

    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: 'File not found' });
    }
  }
}
