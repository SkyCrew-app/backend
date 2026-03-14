import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { graphqlUploadExpress } from 'graphql-upload-ts';
import * as express from 'express';
import helmet from 'helmet';
import { join } from 'path';

const ALLOWED_ORIGINS = [
  'https://staging.skycrew.fr',
  'https://skycrew.fr',
  'http://localhost:5173',
  'http://localhost:3000',
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(graphqlUploadExpress({ maxFileSize: 1000000, maxFiles: 10 }));

  app.use(cookieParser());

  app.enableCors({
    origin: ALLOWED_ORIGINS,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('SkyCrew API')
    .setDescription('SkyCrew Aeroclub Management API')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.use('/uploads', express.static(join(__dirname, 'uploads')));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port, () => {
    console.log(`🚀 Application is running on: http://localhost:${port}`);
  });
}
bootstrap();
