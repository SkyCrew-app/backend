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
    const filePath = path.join(
      __dirname,
      '../../uploads',
      aircraftId,
      filename,
    );

    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: 'File not found' });
    }
  }
}
