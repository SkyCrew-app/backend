import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Controller('files')
export class FileController {
  @Get(':aircraftId/:filename')
  async getFile(
    @Param('aircraftId') aircraftId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const uploadsRoot = path.resolve(__dirname, '../../uploads');
    const filePath = path.resolve(uploadsRoot, aircraftId, filename);

    // Refuse anything that resolves outside the uploads directory.
    if (!filePath.startsWith(uploadsRoot + path.sep)) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: 'File not found' });
    }
  }
}
