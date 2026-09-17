import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';
import {
  renderBookingConfirmationEmail,
  renderResultEmail,
  renderResultMediaImage,
  renderButton,
  Lang,
} from './email.templates';

const SAMPLE_MEMORY_IMAGE =
  'https://images.unsplash.com/photo-1520975916090-3105956dac38?w=800';

@Controller('api/email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  // Botón "Enviar correo de prueba" del panel de Admin (herramienta de QA,
  // no depende de que exista una reserva real). Usa datos de ejemplo fijos
  // para poder revisar el correo de confirmación en una bandeja real.
  @Post('test-booking-confirmation')
  async sendTestBookingConfirmation(@Body() body: { to: string; lang?: Lang }) {
    const lang: Lang = body.lang === 'en' ? 'en' : 'es';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const code = 'AB-CD-EF';
    const { html, subject } = renderBookingConfirmationEmail({
      lang,
      frontendUrl,
      backendUrl,
      recipientEmail: body.to,
      name: 'Juan Fernando',
      code,
      statusLink: `${frontendUrl}/my-bookings?code=${code}`,
      scheduleLines:
        lang === 'en'
          ? [
              'Your reserved time slot is <strong style="white-space: nowrap;">10:45 - 11:00</strong>',
              'You\'ll live your experience on screen at <strong style="white-space: nowrap;">~10:47</strong>',
            ]
          : [
              'Tu horario reservado es <strong style="white-space: nowrap;">10:45 - 11:00</strong>',
              'Vivirás tu experiencia en pantalla a las <strong style="white-space: nowrap;">~10:47</strong>',
            ],
    });
    try {
      const result = await this.emailService.sendEmail(body.to, subject, html);
      return { success: true, message: 'Email enviado correctamente', result };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error enviando email',
        error: error.message,
      };
    }
  }

  // Igual que test-booking-confirmation pero para el correo 2 (recuerdo):
  // usa una foto de ejemplo, no depende de que exista una reserva real.
  @Post('test-result')
  async sendTestResult(
    @Body() body: { to: string; lang?: Lang; isVideo?: boolean },
  ) {
    const lang: Lang = body.lang === 'en' ? 'en' : 'es';
    const isVideo = !!body.isVideo;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const downloadUrl = `${backendUrl}/api/bookings/download/AB-CD-EF`;
    const downloadCta =
      lang === 'en' ? 'Download your memory' : 'Descarga tu recuerdo';
    const mediaBlockHtml = isVideo
      ? renderButton(downloadCta, downloadUrl)
      : `${renderResultMediaImage(SAMPLE_MEMORY_IMAGE, 'foto')}${renderButton(downloadCta, downloadUrl)}`;
    const { html, subject } = renderResultEmail({
      lang,
      frontendUrl,
      backendUrl,
      recipientEmail: body.to,
      name: 'Juan Fernando',
      mediaBlockHtml,
      isVideo,
    });
    try {
      const result = await this.emailService.sendEmail(body.to, subject, html);
      return { success: true, message: 'Email enviado correctamente', result };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error enviando email',
        error: error.message,
      };
    }
  }

  @Post('test')
  async sendTestEmail(
    @Body() body: { to: string; subject: string; html: string },
  ) {
    try {
      const result = await this.emailService.sendEmail(
        body.to,
        body.subject,
        body.html,
      );
      return {
        success: true,
        message: 'Email enviado correctamente',
        result,
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error enviando email',
        error: error.message,
      };
    }
  }

  @Post('custom')
  async sendCustomEmail(
    @Body()
    body: {
      to: string | string[];
      subject: string;
      html: string;
      fromName?: string;
      fromEmail?: string;
      cc?: string | string[];
      bcc?: string | string[];
      emailName?: string;
    },
  ) {
    try {
      if (body.emailName) {
        body.fromName = body.emailName;
      }
      const result = await this.emailService.sendUniversalEmail(body);
      return {
        success: true,
        message: 'Email enviado correctamente',
        result,
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error enviando email',
        error: error.message,
      };
    }
  }
}
