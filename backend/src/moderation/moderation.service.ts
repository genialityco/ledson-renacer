import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

export interface ModerationResult {
  /** true si el archivo NO debe usarse (contenido sexual, armas o drogas). */
  blocked: boolean;
  /** Categorías que dispararon el bloqueo: 'sexual' | 'weapon' | 'drugs'. */
  reasons: string[];
  /** false si no se pudo consultar (sin llaves, sin red, error de la API). */
  checked: boolean;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

// Moderación de fotos y videos con Sightengine (https://sightengine.com). Las
// credenciales van en SIGHTENGINE_API_USER / SIGHTENGINE_API_SECRET; sin ellas
// la moderación queda desactivada (no bloquea nada). Si la API falla, no hay
// internet, o la respuesta no tiene la forma esperada, NO se bloquea al
// cliente ("fail-open"): se registra en el log y se deja pasar.
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  private readonly apiUser = process.env.SIGHTENGINE_API_USER;
  private readonly apiSecret = process.env.SIGHTENGINE_API_SECRET;
  private readonly models =
    process.env.SIGHTENGINE_MODELS ||
    'nudity-2.1,weapon,alcohol,recreational_drug,medical';
  // Desactiva solo la moderación de video (ej. mientras se confirma el costo
  // por minuto en el panel de Sightengine) sin tocar la de fotos.
  private readonly videoEnabled =
    process.env.SIGHTENGINE_VIDEO_ENABLED !== 'false';
  // Cada cuántos segundos se analiza un fotograma del video. Con el tramo
  // acotado a 15s (ver checkVideo), un valor de 1 son ~15 fotogramas por clip.
  private readonly videoFrameInterval =
    Number(process.env.SIGHTENGINE_VIDEO_FRAME_INTERVAL) || 1;
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

  // Solo para loguear — nunca imprime el secreto completo.
  private get maskedCreds(): string {
    const user = this.apiUser || '(vacío)';
    const secret = this.apiSecret
      ? `${this.apiSecret.slice(0, 4)}***(${this.apiSecret.length} chars)`
      : '(vacío)';
    return `api_user=${user} api_secret=${secret}`;
  }

  async checkImage(
    buffer: Buffer,
    contentType = 'image/jpeg',
  ): Promise<ModerationResult> {
    if (!this.enabled) {
      this.logger.warn(
        `Moderación de imagen OMITIDA: faltan SIGHTENGINE_API_USER/SIGHTENGINE_API_SECRET en .env (${this.maskedCreds})`,
      );
      return { blocked: false, reasons: [], checked: false };
    }
    try {
      const form = new FormData();
      form.append('media', buffer, {
        filename: 'upload.jpg',
        contentType,
      });
      form.append('models', this.models);
      form.append('api_user', this.apiUser);
      form.append('api_secret', this.apiSecret);

      this.logger.log(
        `Enviando foto a Sightengine (check.json) — ${buffer.length} bytes, models=${this.models}, ${this.maskedCreds}`,
      );
      const res = await axios.post(
        'https://api.sightengine.com/1.0/check.json',
        form,
        { headers: form.getHeaders(), timeout: 15000, maxBodyLength: Infinity },
      );
      const data = res.data;
      this.logger.log(
        `Respuesta de Sightengine (foto): ${JSON.stringify(data)}`,
      );
      if (data?.status !== 'success') {
        this.logger.warn(
          `Sightengine respondió algo inesperado: ${JSON.stringify(data)}`,
        );
        return { blocked: false, reasons: [], checked: false };
      }
      return this.evaluate(data);
    } catch (e: any) {
      this.logger.error(
        `Fallo la petición a Sightengine (foto) — status=${e?.response?.status} ${
          e?.response?.data ? JSON.stringify(e.response.data) : e?.message
        }`,
      );
      return { blocked: false, reasons: [], checked: false };
    }
  }

  // Modera un video a partir de su contenido ya en memoria (sin depender de
  // una URL pública — así se puede llamar ANTES de subir el archivo a
  // Storage, igual que checkImage). Solo analiza el TRAMO que el cliente
  // eligió mostrar en pantalla (trimStart/trimEnd, tope real 15s — ver
  // VideoTrimModal), no el archivo completo: así el costo por minuto en
  // Sightengine queda acotado al contenido que de verdad se va a proyectar.
  //
  // OJO: la API de video de Sightengine (endpoint, nombre de parámetros y
  // forma exacta de la respuesta por fotograma) la integré de memoria, sin
  // poder probarla contra su servicio real en este entorno — antes de confiar
  // en esto en producción, mandar un video de prueba y revisar los logs del
  // backend (si la forma de la respuesta no es la esperada, se loguea tal
  // cual y NO se bloquea nada, así que no rompe nada, pero tampoco modera).
  async checkVideo(
    buffer: Buffer,
    trimStart = 0,
    trimEnd?: number,
  ): Promise<ModerationResult> {
    if (!this.enabled) {
      this.logger.warn(
        `Moderación de video OMITIDA: faltan SIGHTENGINE_API_USER/SIGHTENGINE_API_SECRET en .env (${this.maskedCreds})`,
      );
      return { blocked: false, reasons: [], checked: false };
    }
    if (!this.videoEnabled) {
      this.logger.log(
        'Moderación de video OMITIDA: SIGHTENGINE_VIDEO_ENABLED=false',
      );
      return { blocked: false, reasons: [], checked: false };
    }
    const start = Math.max(0, trimStart);
    const clipDuration = Math.min((trimEnd ?? start + 15) - start, 15);
    if (clipDuration <= 0) {
      this.logger.warn(
        `Moderación de video OMITIDA: tramo inválido (trimStart=${trimStart}, trimEnd=${trimEnd})`,
      );
      return { blocked: false, reasons: [], checked: false };
    }

    const inputPath = path.join(
      os.tmpdir(),
      `moderation-in-${Date.now()}-${uuidv4()}.mp4`,
    );
    const clipPath = path.join(
      os.tmpdir(),
      `moderation-clip-${Date.now()}-${uuidv4()}.mp4`,
    );
    try {
      fs.writeFileSync(inputPath, buffer);
      this.logger.log(
        `Recortando tramo ${start}s-${start + clipDuration}s (entrada: ${buffer.length} bytes) para moderar`,
      );
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(start)
          .duration(clipDuration)
          .noAudio()
          .output(clipPath)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });
      const clipBuffer = fs.readFileSync(clipPath);
      this.logger.log(`Clip recortado: ${clipBuffer.length} bytes`);
      return await this.checkVideoBuffer(clipBuffer);
    } catch (e: any) {
      this.logger.error(
        `No se pudo recortar el video con ffmpeg (se permite, no se llegó a llamar a Sightengine): ${e?.message}`,
      );
      return { blocked: false, reasons: [], checked: false };
    } finally {
      fs.promises.unlink(inputPath).catch(() => {});
      fs.promises.unlink(clipPath).catch(() => {});
    }
  }

  private async checkVideoBuffer(buffer: Buffer): Promise<ModerationResult> {
    try {
      const form = new FormData();
      form.append('media', buffer, {
        filename: 'clip.mp4',
        contentType: 'video/mp4',
      });
      form.append('models', this.models);
      form.append('api_user', this.apiUser);
      form.append('api_secret', this.apiSecret);
      form.append('interval', String(this.videoFrameInterval));

      this.logger.log(
        `Enviando video a Sightengine (video/check-sync.json) — ${buffer.length} bytes, models=${this.models}, interval=${this.videoFrameInterval}, ${this.maskedCreds}`,
      );
      const res = await axios.post(
        'https://api.sightengine.com/1.0/video/check-sync.json',
        form,
        { headers: form.getHeaders(), timeout: 60000, maxBodyLength: Infinity },
      );
      const data = res.data;
      this.logger.log(
        `Respuesta de Sightengine (video): ${JSON.stringify(data)}`,
      );
      const frames = data?.data?.frames;
      if (data?.status !== 'success' || !Array.isArray(frames)) {
        this.logger.warn(
          `Sightengine (video) respondió algo inesperado — revisar integración: ${JSON.stringify(data)}`,
        );
        return { blocked: false, reasons: [], checked: false };
      }

      const reasons = new Set<string>();
      for (const frame of frames) {
        this.evaluate(frame, { silent: true }).reasons.forEach((r) =>
          reasons.add(r),
        );
      }
      if (reasons.size) {
        this.logger.warn(
          `Video bloqueado por moderación: ${[...reasons].join(', ')}`,
        );
      }
      return {
        blocked: reasons.size > 0,
        reasons: [...reasons],
        checked: true,
      };
    } catch (e: any) {
      this.logger.error(
        `Fallo la petición a Sightengine (video) — status=${e?.response?.status} ${
          e?.response?.data ? JSON.stringify(e.response.data) : e?.message
        }`,
      );
      return { blocked: false, reasons: [], checked: false };
    }
  }

  private evaluate(d: any, opts: { silent?: boolean } = {}): ModerationResult {
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

    if (reasons.length && !opts.silent) {
      this.logger.warn(
        `Imagen bloqueada por moderación: ${reasons.join(', ')} ` +
          `(sexual=${sexual.toFixed(2)} weapon=${weapon.toFixed(2)} drugs=${drugs.toFixed(2)})`,
      );
    }
    return { blocked: reasons.length > 0, reasons, checked: true };
  }
}
