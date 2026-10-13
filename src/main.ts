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
import { DataSource } from 'typeorm';
import { ensureBaseData } from './db/ensure-base-data';
import { User } from './modules/users/entity/users.entity';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://staging.skycrew.fr',
  'https://skycrew.fr',
  'https://anthonydenin.dev',
  'http://localhost:5173',
  'http://localhost:3000',
];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Kept for the payment webhook, whose signature covers the raw body.
    rawBody: true,
  });

  // Behind a reverse proxy, the client address comes from X-Forwarded-For.
  // TRUST_PROXY is the number of proxies in front of the application; leave
  // it unset when the application is reached directly.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY));
  }
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

  app.use(graphqlUploadExpress({ maxFileSize: 1000000, maxFiles: 10 }));

  app.use(cookieParser());

  const allowedOrigins = Array.from(
    new Set([
      ...DEFAULT_ALLOWED_ORIGINS,
      ...(process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ]),
  );

  app.enableCors({
    origin: allowedOrigins,
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
    protectUploads((email) =>
      app
        .get(DataSource)
        .getRepository(User)
        .findOne({
          where: { email },
          relations: ['role'],
        }),
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
