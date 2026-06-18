import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Habilitar CORS para permitir peticiones del frontend
  
  // Aumentar el límite de tamaño de las peticiones (base64 de las imágenes)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  
  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  console.log(`🚀 Backend NestJS corriendo en: http://localhost:${port}`);
}
bootstrap();
