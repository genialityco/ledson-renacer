import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('api/email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

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
