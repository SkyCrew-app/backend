import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = this.metricsService.startHttpRequest();

    res.on('finish', () => {
      this.metricsService.trackHttpRequest(
        req.method,
        req.path,
        res.statusCode,
      );
      this.metricsService.endHttpRequest(startTime, req.method, req.path);
    });

    next();
  }
}
