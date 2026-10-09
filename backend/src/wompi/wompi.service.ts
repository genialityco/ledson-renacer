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

  // Busca la transacción de una referencia (ej. "booking-<id>") sin saber su
  // id: así el backend detecta un pago aprobado aunque el cliente nunca
  // vuelva del widget. Si hay varios intentos, prefiere el aprobado; si no,
  // devuelve el más reciente. null si todavía no hay ninguno.
  async findTransactionByReference(
    reference: string,
  ): Promise<WompiTxn['data'] | null> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(
        `${this.base}/transactions?reference=${encodeURIComponent(reference)}`,
        { headers: { Authorization: this.authHeader }, signal: ctrl.signal },
      );
      const body = (await res.json().catch(() => ({}))) as {
        data?: (WompiTxn['data'] & { created_at?: string })[];
      };
      if (!res.ok) throw new Error(`Wompi: HTTP ${res.status}`);
      const txns = (body.data ?? []).filter((x) => x.reference === reference);
      if (!txns.length) return null;
      return (
        txns.find((x) => x.status === 'APPROVED') ??
        txns.sort((a, b) =>
          String(b.created_at).localeCompare(String(a.created_at)),
        )[0]
      );
    } finally {
      clearTimeout(t);
    }
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
