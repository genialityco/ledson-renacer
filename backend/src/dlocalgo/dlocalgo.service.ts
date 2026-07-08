import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DlocalgoService {
  private readonly logger = new Logger(DlocalgoService.name);

  private readonly apiKey = process.env.DLOCALGO_API_KEY;
  private readonly apiSecret = process.env.DLOCALGO_API_SECRET;

  private readonly baseUrl =
    process.env.DLOCALGO_ENV === 'production'
      ? 'https://api.dlocalgo.com/v1'
      : 'https://api-sbx.dlocalgo.com/v1';

  constructor() {
    if (!this.apiKey || !this.apiSecret) {
      this.logger.error(
        'DLOCALGO_API_KEY / DLOCALGO_API_SECRET no configuradas. Los pagos con dLocal Go fallarán.',
      );
    }
  }

  async createPaymentLink(
    amount: number,
    currency: string,
    reference: string,
    successUrl: string,
    backUrl: string,
  ) {
    try {
      const payload = {
        amount: amount,
        currency: currency,
        country: 'CO', // Asumiendo Colombia
        payment_method_flow: 'REDIRECT',
        success_url: successUrl,
        back_url: backUrl,
        description: `Pago reserva ${reference}`,
      };

      // Note: Check DLocal Go exact Auth header requirements. Usually Bearer API_KEY or Bearer token
      const authHeader = `Bearer ${this.apiKey}:${this.apiSecret}`;

      this.logger.debug(
        `DLocalGo API Key length: ${this.apiKey?.length}, Secret length: ${this.apiSecret?.length}`,
      );
      this.logger.debug(`Sending Auth Header: ${authHeader}`);
      this.logger.debug(`Sending payload: ${JSON.stringify(payload)}`);

      const res = await fetch(`${this.baseUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        this.logger.error('Dlocal Go API Error:', data);
        throw new Error(`Dlocal Go error: ${JSON.stringify(data)}`);
      }

      return data; // Retorna data que debería tener un redirect_url
    } catch (err: any) {
      this.logger.error(`Error en createPaymentLink: ${err.message}`);
      throw err;
    }
  }

  async getPaymentStatus(paymentId: string) {
    try {
      const authHeader = `Bearer ${this.apiKey}:${this.apiSecret}`;
      const res = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        headers: {
          Authorization: authHeader,
        },
      });
      const data = await res.json();
      return data;
    } catch (error) {
      this.logger.error('Error fetching DlocalGo payment', error);
      throw error;
    }
  }
}
