import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import axios from 'axios';
import { BookingsService } from './bookings.service';

@Controller('api/bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('screen-settings')
  async getScreenSettings() {
    return this.bookingsService.getScreenSettings();
  }

  @Get('search/:query')
  async searchBookings(@Param('query') query: string) {
    return this.bookingsService.searchBookings(query);
  }

  // Descarga forzada (Content-Disposition: attachment) del recuerdo (foto o
  // video) de una reserva, usada por el botón "Descarga tu recuerdo" del
  // correo de resultado. Usa el código público de la reserva (no el id
  // interno de Firestore) para no filtrarlo en un link de correo.
  @Get('download/:code')
  async downloadMedia(@Param('code') code: string, @Res() res: Response) {
    let media: Awaited<
      ReturnType<typeof this.bookingsService.getMediaForDownload>
    >;
    try {
      media = await this.bookingsService.getMediaForDownload(code);
    } catch (e: any) {
      res.status(404).json({ message: e.message || 'No encontrado' });
      return;
    }

    try {
      const upstream = await axios.get(media.sourceUrl, {
        responseType: 'stream',
      });
      const contentType = String(
        upstream.headers['content-type'] || media.fallbackContentType,
      );
      const contentLength = upstream.headers['content-length'];
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="LedsOn-${code}.${media.fallbackExtension}"`,
      );
      if (contentLength) res.setHeader('Content-Length', String(contentLength));
      upstream.data.on('error', (err: any) => {
        console.error('Error en stream de descarga:', err.message);
        res.destroy();
      });
      upstream.data.pipe(res);
    } catch (e: any) {
      console.error('Error descargando media:', e.message);
      res.status(502).json({ message: 'No se pudo descargar el archivo' });
    }
  }

  @Put('screen-settings')
  async updateScreenSettings(@Body() data: any) {
    return this.bookingsService.updateScreenSettings(data);
  }

  @Post('screen-settings/clear')
  async clearProjection() {
    return this.bookingsService.clearProjection();
  }
  @Post('screen-settings/grid-item-shown/:id')
  async recordGridItemAppearance(@Param('id') id: string) {
    return this.bookingsService.recordGridItemAppearance(id);
  }
  @Get()
  async getAll() {
    return this.bookingsService.getBookings();
  }

  @Post('init')
  async initBooking(@Body() data: any) {
    return this.bookingsService.initBooking(data);
  }

  @Post(':id/attach-media')
  async attachMedia(
    @Param('id') id: string,
    @Body()
    data: {
      imageBase64?: string;
      timeSlot?: string;
      trimStart?: number;
      trimEnd?: number;
      frameX?: number;
      frameY?: number;
      frameZoom?: number;
    },
  ) {
    return this.bookingsService.attachMedia(id, data);
  }

  @Post(':id/confirm-payment')
  async confirmPayment(
    @Param('id') id: string,
    @Body()
    data?: {
      imageBase64?: string;
      timeSlot?: string;
      trimStart?: number;
      trimEnd?: number;
      frameX?: number;
      frameY?: number;
      frameZoom?: number;
    },
  ) {
    return this.bookingsService.confirmPayment(id, data);
  }

  @Get('franjas')
  async getFranjas(@Query('date') date?: string) {
    return this.bookingsService.getFranjasAvailability(date);
  }

  @Post(':id/assign-franja')
  async assignFranja(
    @Param('id') id: string,
    @Body('timeSlot') timeSlot: string,
  ) {
    return this.bookingsService.assignFranja(id, timeSlot);
  }

  @Post()
  async createBooking(@Body() data: any) {
    return this.bookingsService.createBooking(data);
  }

  @Post(':id/generate')
  async generateImage(@Param('id') id: string) {
    return this.bookingsService.generateImage(id);
  }

  @Post(':id/project')
  async projectBooking(@Param('id') id: string) {
    return this.bookingsService.projectBooking(id);
  }

  @Post(':id/complete')
  async completeProjection(@Param('id') id: string) {
    return this.bookingsService.completeProjection(id);
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.bookingsService.updateBookingStatus(id, status);
  }
}
