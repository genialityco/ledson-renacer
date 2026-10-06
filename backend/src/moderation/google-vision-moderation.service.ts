import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as admin from 'firebase-admin';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { ModerationResult } from './moderation.types';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';
// Máximo de imágenes por petición a images:annotate. También es el tope de
// fotogramas por video, para que el costo por clip quede acotado.
const MAX_BATCH = 16;

const LIKELIHOODS = [
  'UNKNOWN',
  'VERY_UNLIKELY',
  'UNLIKELY',
  'POSSIBLE',
  'LIKELY',
  'VERY_LIKELY',
];
const likelihoodRank = (v: unknown): number =>
  typeof v === 'string' ? Math.max(0, LIKELIHOODS.indexOf(v.toUpperCase())) : 0;

const labelList = (v: string | undefined, fallback: string): Set<string> =>
  new Set(
    (v || fallback)
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

const fail = (): ModerationResult => ({
  blocked: false,
  reasons: [],
  checked: false,
});

// Moderación con Google Cloud Vision (SafeSearch + Label Detection), usando la
// misma cuenta de servicio de Firebase Admin — no necesita llaves propias, pero
// sí que la "Cloud Vision API" esté habilitada en el proyecto de Google Cloud.
// Se piden ambos features porque con Label Detection el SafeSearch sale gratis
// (mismo precio que pedir solo SafeSearch) y las etiquetas sirven para armas y
// drogas, que SafeSearch no cubre. Igual que con Sightengine, ante cualquier
// fallo NO se bloquea ("fail-open").
@Injectable()
export class GoogleVisionModerationService {
  private readonly logger = new Logger(GoogleVisionModerationService.name);

  // SafeSearch no da probabilidades sino niveles: se bloquea desde este nivel
  // de "adult" en adelante (POSSIBLE, LIKELY o VERY_LIKELY).
  private readonly sexualLikelihood = likelihoodRank(
    process.env.VISION_SEXUAL_LIKELIHOOD || 'LIKELY',
  );
  // Las armas y drogas se detectan por etiquetas (comparación exacta, sin
  // distinguir mayúsculas) con un puntaje mínimo de 0 a 1.
  private readonly weaponLabels = labelList(
    process.env.VISION_WEAPON_LABELS,
    'Gun,Firearm,Handgun,Rifle,Revolver,Shotgun,Machine gun,Assault rifle,Submachine gun,Weapon,Trigger,Gun barrel,Ammunition',
  );
  private readonly drugLabels = labelList(
    process.env.VISION_DRUG_LABELS,
    'Cannabis,Hemp,Hemp family,Recreational drug,Cocaine,Narcotic',
  );
  private readonly weaponThreshold =
    Number(process.env.MODERATION_WEAPON_THRESHOLD) || 0.6;
  private readonly drugThreshold =
    Number(process.env.MODERATION_DRUG_THRESHOLD) || 0.6;

  get enabled(): boolean {
    return admin.apps.length > 0;
  }

  async checkImage(buffer: Buffer): Promise<ModerationResult> {
    if (!this.enabled) {
      this.logger.warn(
        'Moderación de imagen OMITIDA: Firebase Admin no está inicializado (sin cuenta de servicio)',
      );
      return fail();
    }
    // Se reduce a máx. 1024px: Vision no necesita más para moderar y así la
    // petición (base64 en el JSON) queda bien por debajo del límite de 10MB.
    let image = buffer;
    try {
      image = await sharp(buffer)
        .rotate()
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch (e: any) {
      this.logger.warn(
        `No se pudo reducir la imagen con sharp, se envía la original: ${e?.message}`,
      );
    }
    this.logger.log(`Enviando foto a Google Vision — ${image.length} bytes`);
    const results = await this.annotate([image], 15000);
    if (!results) return fail();
    return this.evaluate(results[0]);
  }

  // Extrae fotogramas del tramo [start, start + clipDuration] (cada
  // frameInterval segundos, máx. MAX_BATCH) y los modera en una sola petición.
  async checkVideo(
    buffer: Buffer,
    start: number,
    clipDuration: number,
    opts: { frameInterval: number; budgetMs: number },
  ): Promise<ModerationResult> {
    if (!this.enabled) {
      this.logger.warn(
        'Moderación de video OMITIDA: Firebase Admin no está inicializado (sin cuenta de servicio)',
      );
      return fail();
    }
    const workDir = path.join(
      os.tmpdir(),
      `moderation-frames-${Date.now()}-${uuidv4()}`,
    );
    const inputPath = path.join(workDir, 'input.mp4');
    const startedAt = Date.now();
    try {
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(inputPath, buffer);
      this.logger.log(
        `Extrayendo fotogramas del tramo ${start}s-${start + clipDuration}s (entrada: ${buffer.length} bytes) para moderar`,
      );
      const fps = (1 / Math.max(0.1, opts.frameInterval)).toFixed(3);
      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg(inputPath)
          .setStartTime(start)
          .duration(clipDuration)
          .noAudio()
          .videoFilters([
            `fps=${fps}`,
            "scale=w='min(640,iw)':h='min(640,ih)':force_original_aspect_ratio=decrease",
          ])
          .outputOptions(['-frames:v', String(MAX_BATCH), '-q:v', '4'])
          .output(path.join(workDir, 'frame-%03d.jpg'))
          .on('end', () => {
            clearTimeout(timer);
            resolve();
          })
          .on('error', (err: Error) => {
            clearTimeout(timer);
            reject(err);
          });
        const timer = setTimeout(() => {
          command.kill('SIGKILL');
          reject(
            new Error(`ffmpeg superó el tiempo máximo (${opts.budgetMs}ms)`),
          );
        }, opts.budgetMs);
        command.run();
      });

      const frames = fs
        .readdirSync(workDir)
        .filter((f) => f.startsWith('frame-'))
        .sort()
        .map((f) => fs.readFileSync(path.join(workDir, f)));
      const remainingMs = opts.budgetMs - (Date.now() - startedAt);
      this.logger.log(
        `${frames.length} fotogramas extraídos en ${Date.now() - startedAt}ms`,
      );
      if (!frames.length) {
        this.logger.warn(
          'Moderación de video OMITIDA: no se extrajo ningún fotograma',
        );
        return fail();
      }
      if (remainingMs < 5000) {
        this.logger.warn(
          'Moderación de video OMITIDA: la extracción consumió casi todo el tiempo disponible',
        );
        return fail();
      }

      const results = await this.annotate(frames, remainingMs);
      if (!results) return fail();
      const reasons = new Set<string>();
      for (const r of results) {
        this.evaluate(r, { silent: true }).reasons.forEach((x) =>
          reasons.add(x),
        );
      }
      if (reasons.size) {
        this.logger.warn(
          `Video bloqueado por moderación (Google Vision): ${[...reasons].join(', ')}`,
        );
      }
      return {
        blocked: reasons.size > 0,
        reasons: [...reasons],
        checked: true,
      };
    } catch (e: any) {
      this.logger.error(
        `No se pudieron extraer fotogramas con ffmpeg (se permite, no se llegó a llamar a Google Vision): ${e?.message}`,
      );
      return fail();
    } finally {
      fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // Devuelve una respuesta por imagen, o null si la petición falló o alguna
  // imagen vino con error (en ese caso no se puede afirmar que esté limpia).
  private async annotate(
    images: Buffer[],
    timeoutMs: number,
  ): Promise<any[] | null> {
    try {
      const { access_token } = await admin
        .app()
        .options.credential!.getAccessToken();
      const res = await axios.post(
        VISION_URL,
        {
          requests: images.map((img) => ({
            image: { content: img.toString('base64') },
            features: [
              { type: 'SAFE_SEARCH_DETECTION' },
              { type: 'LABEL_DETECTION', maxResults: 30 },
            ],
          })),
        },
        {
          headers: { Authorization: `Bearer ${access_token}` },
          timeout: timeoutMs,
          maxBodyLength: Infinity,
        },
      );
      const responses = res.data?.responses;
      this.logger.log(
        `Respuesta de Google Vision: ${JSON.stringify(
          (responses || []).map((r: any) => ({
            safeSearch: r.safeSearchAnnotation,
            labels: (r.labelAnnotations || []).map(
              (l: any) => `${l.description}:${Number(l.score).toFixed(2)}`,
            ),
            error: r.error,
          })),
        )}`,
      );
      if (!Array.isArray(responses) || responses.length !== images.length) {
        this.logger.warn(
          `Google Vision respondió algo inesperado: ${JSON.stringify(res.data)}`,
        );
        return null;
      }
      if (responses.some((r: any) => r.error)) {
        this.logger.warn('Google Vision devolvió error en al menos una imagen');
        return null;
      }
      return responses;
    } catch (e: any) {
      this.logger.error(
        `Fallo la petición a Google Vision — status=${e?.response?.status} ${
          e?.response?.data ? JSON.stringify(e.response.data) : e?.message
        }`,
      );
      return null;
    }
  }

  private evaluate(r: any, opts: { silent?: boolean } = {}): ModerationResult {
    const reasons: string[] = [];

    const adult = likelihoodRank(r.safeSearchAnnotation?.adult);
    if (adult >= this.sexualLikelihood) reasons.push('sexual');

    const labels: { description: string; score: number }[] =
      r.labelAnnotations || [];
    const maxScore = (set: Set<string>) =>
      Math.max(
        0,
        ...labels
          .filter((l) => set.has(String(l.description).toLowerCase()))
          .map((l) => Number(l.score) || 0),
      );
    const weapon = maxScore(this.weaponLabels);
    if (weapon >= this.weaponThreshold) reasons.push('weapon');
    const drugs = maxScore(this.drugLabels);
    if (drugs >= this.drugThreshold) reasons.push('drugs');

    if (reasons.length && !opts.silent) {
      this.logger.warn(
        `Imagen bloqueada por moderación (Google Vision): ${reasons.join(', ')} ` +
          `(adult=${LIKELIHOODS[adult]} weapon=${weapon.toFixed(2)} drugs=${drugs.toFixed(2)})`,
      );
    }
    return { blocked: reasons.length > 0, reasons, checked: true };
  }
}
