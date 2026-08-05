import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para permitir peticiones del frontend.
  // ALLOWED_ORIGINS (lista separada por comas) restringe los orígenes en producción;
  // sin ella, queda abierto (comportamiento actual para desarrollo local).
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors(allowedOrigins?.length ? { origin: allowedOrigins } : undefined);

  // Aumentar el límite de tamaño de las peticiones (base64 de fotos y videos).
  // Los videos no se recomprimen del lado del cliente (a diferencia de las
  // fotos, que sí se redimensionan a 512x512 antes de enviarse), así que
  // viajan en su tamaño original + ~33% del overhead de base64.
  app.use(json({ limit: '120mb' }));
  app.use(urlencoded({ extended: true, limit: '120mb' }));

  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  console.log(`🚀 Backend NestJS corriendo en: http://localhost:${port}`);
}
bootstrap();
