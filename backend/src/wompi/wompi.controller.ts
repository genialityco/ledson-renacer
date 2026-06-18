import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { WompiService } from './wompi.service';

@Controller('api/wompi')
export class WompiController {
  private readonly logger = new Logger(WompiController.name);

  constructor(private wompi: WompiService) {}

  @Get('integrity-signature')
  getIntegritySignature(
    @Query('reference') reference: string,
    @Query('amountInCents') amountInCentsRaw: string,
    @Query('currency') currency = 'COP',
    @Query('expirationTime') expirationTime?: string,
  ) {
    const isProd = process.env.WOMPI_ENV === 'production';
    const secret = isProd
      ? process.env.WOMPI_INTEGRITY_SECRET_PROD
      : process.env.WOMPI_INTEGRITY_SECRET_TEST ||
        'test_integrity_secret_12345'; // Default for testing

    if (!secret) {
      throw new Error(
        'WOMPI_INTEGRITY_SECRET no configurado para el entorno actual',
      );
    }
    if (!reference) throw new BadRequestException('reference es requerido');
    if (!amountInCentsRaw)
      throw new BadRequestException('amountInCents es requerido');

    const amountInCents = String(parseInt(String(amountInCentsRaw), 10));
    if (!/^\d+$/.test(amountInCents)) {
      throw new BadRequestException(
        'amountInCents debe ser un entero en centavos',
      );
    }

    const cur = String(currency || 'COP').toUpperCase();
    const base = expirationTime
      ? `${reference}${amountInCents}${cur}${expirationTime}${secret}`
      : `${reference}${amountInCents}${cur}${secret}`;

    const signature = createHash('sha256').update(base).digest('hex');

    this.logger.log(
      `Integrity signature generada para referencia: ${reference}`,
    );

    return { signature };
  }
}
