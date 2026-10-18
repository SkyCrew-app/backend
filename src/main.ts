import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { graphqlUploadExpress } from 'graphql-upload-ts';
import * as express from 'express';
import helmet from 'helmet';
import { join } from 'path';
import {
  protectUploads,
  setUploadHeaders,
} from './common/middleware/protect-uploads.middleware';
import { validationPipeOptions } from './config/validation.config';
import { allowedOrigins } from './config/cors.config';
import { trustProxySetting } from './config/trust-proxy.config';
import { DataSource } from 'typeorm';
import { ensureBaseData } from './db/ensure-base-data';
import { User } from './modules/users/entity/users.entity';
import { UPLOAD_MAX_FILE_SIZE } from './common/uploads/save-upload';
import { License } from './modules/licenses/entity/licenses.entity';
import { holdersOfLicenceDocument } from './modules/licenses/licenses.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Kept for the payment webhook, whose signature covers the raw body.
    rawBody: true,
  });

  // Behind the reverse proxies (nginx, then Caddy), the client address comes
  // from X-Forwarded-For, believed only from proxies on the loopback or a
  // private network: see config/trust-proxy.config.ts.
  app.set('trust proxy', trustProxySetting());
  const port = process.env.PORT || 3000;
  const enableSwagger =
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_SWAGGER === 'true';

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    graphqlUploadExpress({ maxFileSize: UPLOAD_MAX_FILE_SIZE, maxFiles: 10 }),
  );

  app.use(cookieParser());

  app.enableCors({
    origin: allowedOrigins(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('SkyCrew API')
      .setDescription('SkyCrew Aeroclub Management API')
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  app.use(
    '/uploads',
    protectUploads(
      (email) =>
        app
          .get(DataSource)
          .getRepository(User)
          .findOne({
            where: { email },
            relations: ['role'],
          }),
      (documentUrl) =>
        holdersOfLicenceDocument(
          app.get(DataSource).getRepository(License),
          documentUrl,
        ),
    ),
    express.static(join(__dirname, 'uploads'), {
      setHeaders: setUploadHeaders,
    }),
  );

  app.useGlobalPipes(new ValidationPipe(validationPipeOptions));

  // A new installation creates its roles, first administrator and settings.
  if (process.env.SEED_ON_START === 'true') {
    await ensureBaseData(app.get(DataSource));
  }

  await app.listen(port, () => {
    console.log(`🚀 Application is running on: http://localhost:${port}`);
  });
}
bootstrap();
