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
}
