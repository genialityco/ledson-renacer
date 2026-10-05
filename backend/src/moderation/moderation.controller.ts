import { Controller, Post, Body } from '@nestjs/common';
import { ModerationService } from './moderation.service';

@Controller('api/moderation')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  // Chequeo previo desde el formulario: el cliente ve el rechazo ANTES de
  // pagar, en vez de enterarse después.
  @Post('check')
  async check(@Body('imageBase64') imageBase64: string) {
    const match = /^data:([\w/+.-]+);base64,/.exec(imageBase64 || '');
    if (!match || !match[1].startsWith('image/')) {
      return { blocked: false, reasons: [], checked: false };
    }
    const buffer = Buffer.from(
      imageBase64.replace(/^data:[\w/+.-]+;base64,/, ''),
      'base64',
    );
    return this.moderation.checkImage(buffer, match[1]);
  }

  // Chequeo previo del video elegido (antes de pagar), igual que /check para
  // fotos: analiza el tramo que el cliente ya recortó (trimStart/trimEnd) y
  // puede tardar varios segundos (recorte con ffmpeg + llamada a Sightengine),
  // así que el frontend debe mostrar un loading mientras espera la respuesta.
  @Post('check-video')
  async checkVideo(
    @Body('videoBase64') videoBase64: string,
    @Body('trimStart') trimStart?: number,
    @Body('trimEnd') trimEnd?: number,
  ) {
    const match = /^data:([\w/+.-]+);base64,/.exec(videoBase64 || '');
    if (!match || !match[1].startsWith('video/')) {
      return { blocked: false, reasons: [], checked: false };
    }
    const buffer = Buffer.from(
      videoBase64.replace(/^data:[\w/+.-]+;base64,/, ''),
      'base64',
    );
    return this.moderation.checkVideo(buffer, trimStart ?? 0, trimEnd);
  }
}
