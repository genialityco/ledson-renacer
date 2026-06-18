import { Injectable, Logger } from '@nestjs/common';

type WompiTxn = {
  data: {
    id: string;
    status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING';
    amount_in_cents: number;
    reference: string;
    payment_method_type?: string;
  };
};

@Injectable()
export class WompiService {
  private readonly logger = new Logger(WompiService.name);

  private readonly isProd = process.env.WOMPI_ENV === 'production';

  private readonly base = this.isProd
    ? 'https://production.wompi.co/v1'
    : 'https://api-sandbox.wompi.co/v1';

  private readonly privateKey = this.isProd
    ? process.env.WOMPI_PRIVATE_KEY_PROD
    : process.env.WOMPI_PRIVATE_KEY_TEST;

  private get authHeader() {
    if (!this.privateKey) return '';
    return `Bearer ${this.privateKey}`;
  }

  async getTransaction(id: string): Promise<WompiTxn> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);

    try {
      const res = await fetch(
        `${this.base}/transactions/${encodeURIComponent(id)}`,
        {
          headers: { Authorization: this.authHeader },
          signal: ctrl.signal,
        },
      );

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          (body?.error?.reason as string) ||
          body?.error?.messages?.join?.(', ') ||
          `HTTP ${res.status}`;
        throw new Error(`Wompi: ${msg}`);
      }

      return body as WompiTxn;
    } catch (err: any) {
      this.logger.warn(`Error en getTransaction(${id}): ${err.message}`);
      throw err;
    } finally {
      clearTimeout(t);
    }
  }
}
