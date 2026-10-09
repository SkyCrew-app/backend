import { Controller, Get, Res } from '@nestjs/common';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';

// Scraped by Prometheus, which has no session.
@Controller()
export class MetricsController extends PrometheusController {
  @Get()
  @Public()
  async index(@Res({ passthrough: true }) response: Response) {
    return super.index(response);
  }
}
