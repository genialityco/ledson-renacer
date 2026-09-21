import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

export interface ModerationResult {
  /** true si la imagen NO debe usarse (contenido sexual, armas o drogas). */
  blocked: boolean;
  /** Categorías que dispararon el bloqueo: 'sexual' | 'weapon' | 'drugs'. */
  reasons: string[];
  /** false si no se pudo consultar (sin llaves, sin red, error de la API). */
  checked: boolean;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

// Moderación de imágenes con Sightengine (https://sightengine.com). Las
// credenciales van en SIGHTENGINE_API_USER / SIGHTENGINE_API_SECRET; sin ellas
// la moderación queda desactivada (no bloquea nada). Si la API falla o no hay
// internet NO se bloquea al cliente ("fail-open"): se registra en el log.
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  private readonly apiUser = process.env.SIGHTENGINE_API_USER;
  private readonly apiSecret = process.env.SIGHTENGINE_API_SECRET;
  private readonly models =
    process.env.SIGHTENGINE_MODELS ||
    'nudity-2.1,weapon,alcohol,recreational_drug,medical';
  // Umbrales (0 a 1): a partir de esta probabilidad se bloquea.
  private readonly sexualThreshold =
    Number(process.env.MODERATION_SEXUAL_THRESHOLD) || 0.5;
  private readonly weaponThreshold =
    Number(process.env.MODERATION_WEAPON_THRESHOLD) || 0.6;
  private readonly drugThreshold =
    Number(process.env.MODERATION_DRUG_THRESHOLD) || 0.6;

  get enabled(): boolean {
    return !!(this.apiUser && this.apiSecret);
  }

  async checkImage(
    buffer: Buffer,
    contentType = 'image/jpeg',
  ): Promise<ModerationResult> {
    if (!this.enabled) return { blocked: false, reasons: [], checked: false };
    try {
      const form = new FormData();
      form.append('media', buffer, {
        filename: 'upload.jpg',
        contentType,
      });
      form.append('models', this.models);
      form.append('api_user', this.apiUser);
      form.append('api_secret', this.apiSecret);

      const res = await axios.post(
        'https://api.sightengine.com/1.0/check.json',
        form,
        { headers: form.getHeaders(), timeout: 15000, maxBodyLength: Infinity },
      );
      const data = res.data;
      if (data?.status !== 'success') {
        this.logger.warn(`Sightengine respondió: ${JSON.stringify(data)}`);
        return { blocked: false, reasons: [], checked: false };
      }
      return this.evaluate(data);
    } catch (e: any) {
      this.logger.warn(
        `No se pudo moderar la imagen (se permite): ${
          e?.response?.data ? JSON.stringify(e.response.data) : e?.message
        }`,
      );
      return { blocked: false, reasons: [], checked: false };
    }
  }

  private evaluate(d: any): ModerationResult {
    const reasons: string[] = [];

    const n = d.nudity || {};
    const sexual = Math.max(
      num(n.sexual_activity),
      num(n.sexual_display),
      num(n.erotica),
    );
    if (sexual >= this.sexualThreshold) reasons.push('sexual');

    const classes = d.weapon?.classes || {};
    const weapon = Math.max(0, ...Object.values(classes).map(num));
    if (weapon >= this.weaponThreshold) reasons.push('weapon');

    const drugs = num(d.recreational_drug?.prob);
    if (drugs >= this.drugThreshold) reasons.push('drugs');

    if (reasons.length) {
      this.logger.warn(
        `Imagen bloqueada por moderación: ${reasons.join(', ')} ` +
          `(sexual=${sexual.toFixed(2)} weapon=${weapon.toFixed(2)} drugs=${drugs.toFixed(2)})`,
      );
    }
    return { blocked: reasons.length > 0, reasons, checked: true };
  }
}
