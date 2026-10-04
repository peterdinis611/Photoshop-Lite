import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import * as dotenv from 'dotenv';
import { GlobalExceptionFilter } from './common/global-exception.filter';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Large cloud project / asset payloads (multi‑MP images as base64)
  app.use(express.json({ limit: '120mb' }));
  app.use(express.urlencoded({ limit: '120mb', extended: true }));

  const PORT = process.env.PORT || 3001;
  await app.listen(PORT);
  console.log(`Photoshop-Lite API running at http://localhost:${PORT}/api`);
}

bootstrap().catch((err) => {
  console.error('Failed to start API', err);
  process.exit(1);
});
