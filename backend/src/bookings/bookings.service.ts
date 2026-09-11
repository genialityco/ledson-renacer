import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FirebaseService } from '../firebase/firebase.service';
import { EmailService } from '../email/email.service';
import {
  Lang,
  renderBookingConfirmationEmail,
  renderResultEmail,
  renderAbandonedCartEmail,
  renderButton,
} from '../email/email.templates';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

@Injectable()
export class BookingsService {
  constructor(
    private firebase: FirebaseService,
    private emailService: EmailService,
  ) {}

  // Acepta "HH:MM" o "HH:MM:SS" (slotDuration puede ser fraccionario, ej. 0.5
  // = 30s, así que el minuto asignado puede caer en un segundo exacto).
  private toMins(t: string): number {
    const [h, m, s] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0) + (s || 0) / 60;
  }

  // Redondea al segundo para evitar arrastre de error de punto flotante al
  // acumular slotDuration fraccionario. Devuelve "HH:MM" cuando el resultado
  // cae en un minuto exacto (compatibilidad con todos los datos/UI
  // existentes) y solo agrega ":SS" cuando slotDuration deja sobrante.
  private toTimeStr(totalMins: number): string {
    const totalSeconds = Math.round(totalMins * 60);
    const h = Math.floor(totalSeconds / 3600) % 24;
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return s > 0 ? `${base}:${String(s).padStart(2, '0')}` : base;
  }

  // Código corto de reserva (ej: "A3-F9-K2"). Evita caracteres ambiguos
  // (0/O, 1/I) porque el cliente puede necesitar transcribirlo a mano.
  private generateBookingCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let raw = '';
    for (let i = 0; i < 6; i++) {
      raw += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(4, 6)}`;
  }

  // Correo de agradecimiento enviado al confirmar la foto (antes de que la
  // proyección ocurra). Es adicional al correo con la imagen ya estilizada
  // que se envía en completeProjection() cuando termina la proyección.
  private async sendBookingCodeEmail(
    booking: any,
    opts: {
      code: string;
      timeSlot?: string;
      exactTime?: string;
      franjaFull?: boolean;
    },
  ) {
    if (!booking.email || !opts.code) return;
    const db = this.firebase.getFirestore();
    const generalDoc = await db.collection('lr_settings').doc('general').get();
    const lang: Lang = generalDoc.exists
      ? generalDoc.data()?.language || 'es'
      : 'es';
    const frontendUrl = this.getFrontendUrl();
    const statusLink = `${frontendUrl}/my-bookings?code=${opts.code}`;
    const hasExactTime =
      opts.exactTime &&
      opts.exactTime !== 'Sin asignar' &&
      opts.exactTime !== 'Agotado/Lleno';

    let scheduleLines: string[];
    if (opts.franjaFull) {
      scheduleLines = [
        lang === 'en'
          ? 'Your photo is confirmed. The slot you picked filled up right before confirming — use the link below to choose another one.'
          : 'Tu foto ya quedó confirmada. El horario que habías elegido se llenó justo antes de confirmar — entra al enlace de abajo para elegir otro.',
      ];
    } else {
      scheduleLines = [];
      if (opts.timeSlot) {
        scheduleLines.push(
          lang === 'en'
            ? `Your reserved time slot is <strong>${opts.timeSlot.replace('-', ' - ')}</strong>`
            : `Tu horario reservado es <strong>${opts.timeSlot.replace('-', ' - ')}</strong>`,
        );
      }
      if (hasExactTime) {
        scheduleLines.push(
          lang === 'en'
            ? `You'll live your experience on screen at ~<strong>${opts.exactTime}</strong>`
            : `Vivirás tu experiencia en pantalla a las ~<strong>${opts.exactTime}</strong>`,
        );
      }
    }

    const { html, subject } = renderBookingConfirmationEmail({
      lang,
      frontendUrl,
      name: booking.name,
      code: opts.code,
      statusLink,
      scheduleLines,
    });

    try {
      await this.emailService.sendEmail(booking.email, subject, html);
    } catch (e: any) {
      console.error(
        'Error enviando correo de confirmación de foto:',
        e.message,
      );
    }
  }

  private getFrontendUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:5173';
  }

  private async findBookingByCode(
    code: string,
  ): Promise<{ id: string; data: any } | null> {
    const db = this.firebase.getFirestore();
    const snapshot = await db
      .collection('lr_bookings')
      .where('code', '==', code.trim().toUpperCase())
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, data: doc.data() };
  }

  // Resuelve la URL fuente para la descarga forzada del recuerdo (foto o
  // video). Prioriza la versión con marco (emailFramedImageUrl/VideoUrl) sobre
  // el archivo generado sin marco, porque esa es la versión que el usuario ve
  // efectivamente embebida/enlazada en el correo — descargar la versión sin
  // marco cuando sí hay una con marco sería inconsistente.
  async getMediaForDownload(code: string): Promise<{
    sourceUrl: string;
    fallbackExtension: string;
    fallbackContentType: string;
  }> {
    const found = await this.findBookingByCode(code);
    if (!found) throw new NotFoundException('Reserva no encontrada');
    const b = found.data;
    const isVideo = b.mediaType === 'video';
    const sourceUrl = isVideo
      ? b.emailFramedVideoUrl || b.generatedImageUrl || b.imageUrl
      : b.emailFramedImageUrl || b.generatedImageUrl || b.imageUrl;
    if (!sourceUrl)
      throw new NotFoundException(
        'Aún no hay un recuerdo generado para esta reserva',
      );
    return {
      sourceUrl,
      fallbackExtension: isVideo ? 'mp4' : 'jpg',
      fallbackContentType: isVideo ? 'video/mp4' : 'image/jpeg',
    };
  }

  private todayStr(now = new Date()): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Sube una foto o video en base64 a Storage. El tipo se detecta del propio
  // prefijo "data:<mime>;base64,..." que genera FileReader en el navegador —
  // el frontend no tiene que declararlo aparte, el mismo campo (imageBase64)
  // sirve para ambos. El video no se procesa ni recomprime, se sube tal cual.
  private async uploadMediaBase64(
    mediaBase64: string,
    folder = 'bookings',
  ): Promise<{
    url: string;
    mediaType: 'image' | 'video';
    contentType: string;
  }> {
    const match = mediaBase64.match(/^data:([\w/+.-]+);base64,/);
    const contentType = match?.[1] || 'image/jpeg';
    const mediaType: 'image' | 'video' = contentType.startsWith('video/')
      ? 'video'
      : 'image';

    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'video/ogg': 'ogv',
    };
    const extension =
      extensionByType[contentType] || (mediaType === 'video' ? 'mp4' : 'jpg');

    const base64Data = mediaBase64.replace(/^data:[\w/+.-]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const storage = this.firebase.getStorage();
    const bucket = storage.bucket();
    const fileName = `${folder}/${uuidv4()}.${extension}`;
    const file = bucket.file(fileName);

    await file.save(buffer, { metadata: { contentType } });

    let url = '';
    try {
      await file.makePublic();
      url = file.publicUrl();
    } catch (e) {
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: '01-01-2100',
      });
      url = signedUrl;
    }

    return { url, mediaType, contentType };
  }

  // Franja actual alineada al reloj (ej: 10:07 con franjas de 15 min -> "10:00-10:15")
  private currentFranjaSlot(franjaDuration: number, now = new Date()): string {
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const start = nowMins - (nowMins % franjaDuration);
    return `${this.toTimeStr(start)}-${this.toTimeStr(start + franjaDuration)}`;
  }

  private async getTakenTimes(
    date: string,
    timeSlot: string,
  ): Promise<string[]> {
    const db = this.firebase.getFirestore();
    const snapshot = await db
      .collection('lr_bookings')
      .where('bookingDate', '==', date)
      .where('timeSlot', '==', timeSlot)
      .get();
    return snapshot.docs
      .map((d) => d.data().exactTime)
      .filter((t) => t && t !== 'Sin asignar' && t !== 'Agotado/Lleno');
  }

  // Primer minuto libre dentro de la franja; si se pasa fromMins solo considera minutos >= fromMins
  private async findFreeMinuteInFranja(
    date: string,
    timeSlot: string,
    slotDuration: number,
    fromMins?: number,
  ): Promise<string | null> {
    const [startStr, endStr] = timeSlot.split('-');
    if (!startStr || !endStr) return null;

    const taken = await this.getTakenTimes(date, timeSlot);
    const startMins = this.toMins(startStr);
    let endMins = this.toMins(endStr);
    if (endMins <= startMins) endMins += 24 * 60; // franja que termina en 00:00

    // Solo turnos que caben completos dentro de la franja (m + slotDuration <= fin)
    for (let m = startMins; m + slotDuration <= endMins; m += slotDuration) {
      if (fromMins !== undefined && m < fromMins) continue;
      const tStr = this.toTimeStr(m);
      if (!taken.includes(tStr)) return tStr;
    }
    return null;
  }

  // Disponibilidad de todas las franjas del día (desde la franja actual si es hoy)
  async getFranjasAvailability(dateStr?: string) {
    const db = this.firebase.getFirestore();
    const settingsDoc = await db
      .collection('lr_settings')
      .doc('schedules')
      .get();
    const settings = (settingsDoc.exists ? settingsDoc.data() : {}) || {};
    const slotDuration = Number(settings.slotDuration) || 1;
    const franjaDuration = Number(settings.franjaDuration) || 15;
    const capacity = Math.max(1, Math.floor(franjaDuration / slotDuration));

    const now = new Date();
    const date = dateStr || this.todayStr(now);
    const isToday = date === this.todayStr(now);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const currentStart = nowMins - (nowMins % franjaDuration);

    // Una sola consulta por día; agrupamos los minutos ocupados por franja en memoria
    const snapshot = await db
      .collection('lr_bookings')
      .where('bookingDate', '==', date)
      .get();
    const takenBySlot: Record<string, string[]> = {};
    snapshot.docs.forEach((doc) => {
      const d = doc.data();
      if (
        d.timeSlot &&
        d.exactTime &&
        d.exactTime !== 'Sin asignar' &&
        d.exactTime !== 'Agotado/Lleno'
      ) {
        (takenBySlot[d.timeSlot] = takenBySlot[d.timeSlot] || []).push(
          d.exactTime,
        );
      }
    });

    const franjas: any[] = [];
    const firstStart = isToday ? currentStart : 0;
    for (let start = firstStart; start < 24 * 60; start += franjaDuration) {
      const timeSlot = `${this.toTimeStr(start)}-${this.toTimeStr(start + franjaDuration)}`;
      const taken = takenBySlot[timeSlot] || [];

      let spotsLeft = 0;
      for (
        let m = start;
        m + slotDuration <= start + franjaDuration &&
        m + slotDuration <= 24 * 60;
        m += slotDuration
      ) {
        // En la franja actual solo cuentan los minutos que aún no han pasado
        if (isToday && m < nowMins) continue;
        if (!taken.includes(this.toTimeStr(m))) spotsLeft++;
      }

      franjas.push({
        timeSlot,
        occupied: taken.length,
        capacity,
        spotsLeft,
        available: spotsLeft > 0,
        isCurrent: isToday && start === currentStart,
      });
    }

    return { date, franjaDuration, slotDuration, capacity, franjas };
  }

  // Asigna manualmente una franja (cuando la actual estaba llena al confirmar el pago)
  async assignFranja(id: string, timeSlot: string) {
    const db = this.firebase.getFirestore();
    const bookingRef = db.collection('lr_bookings').doc(id);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists)
      throw new NotFoundException('Booking no encontrado');
    const booking = bookingDoc.data();
    if (!booking) throw new NotFoundException('Booking sin datos');

    const settingsDoc = await db
      .collection('lr_settings')
      .doc('schedules')
      .get();
    const settings = (settingsDoc.exists ? settingsDoc.data() : {}) || {};
    const slotDuration = Number(settings.slotDuration) || 1;

    const now = new Date();
    const date = booking.bookingDate || this.todayStr(now);
    const isToday = date === this.todayStr(now);
    const nowMins = now.getHours() * 60 + now.getMinutes();

    const exactTime = await this.findFreeMinuteInFranja(
      date,
      timeSlot,
      slotDuration,
      isToday ? nowMins : undefined,
    );

    if (!exactTime) {
      return {
        success: false,
        franjaFull: true,
        availableFranjas: await this.getFranjasAvailability(date),
      };
    }

    await bookingRef.update({ timeSlot, exactTime });
    return { success: true, exactTime, timeSlot };
  }

  async initBooking(data: any) {
    const {
      name,
      docId,
      email,
      whatsapp,
      country,
      city,
      selectedFilter,
      timeSlot,
      bookingDate,
      imageBase64,
    } = data;

    let imageUrl = '';
    let mediaType: 'image' | 'video' = 'image';

    // Si se envía una foto o video en base64, se sube a Firebase Storage
    if (imageBase64) {
      const uploaded = await this.uploadMediaBase64(imageBase64, 'bookings');
      imageUrl = uploaded.url;
      mediaType = uploaded.mediaType;
    }

    const db = this.firebase.getFirestore();
    const scheduleSettingsDoc = await db
      .collection('lr_settings')
      .doc('schedules')
      .get();
    const scheduleSettings =
      (scheduleSettingsDoc.exists ? scheduleSettingsDoc.data() : {}) || {};
    const sysType = scheduleSettings.bookingSystemType || 'slots';

    let finalBookingDate = bookingDate;
    const finalTimeSlot = timeSlot || '';

    if (sysType === 'queue' || sysType === 'franjas') {
      // Publicación inmediata: la reserva siempre es para hoy
      finalBookingDate = this.todayStr();
    } else if (!finalBookingDate) {
      finalBookingDate = this.todayStr();
    }

    const bookingRef = db.collection('lr_bookings').doc();

    const booking = {
      name,
      docId,
      email,
      whatsapp: whatsapp || '',
      country,
      city,
      selectedFilter,
      code: this.generateBookingCode(),
      timeSlot: finalTimeSlot,
      exactTime: 'Sin asignar', // Se asignará al confirmar el pago
      bookingDate: finalBookingDate,
      imageUrl,
      mediaType,
      status: 'PENDING', // Queda como pendiente de pago
      paymentMethod: data.paymentMethod || 'Wompi',
      requiresInvoice: data.requiresInvoice || false,
      createdAt: new Date(),
      abandonmentEmailSent: false,
    };

    await bookingRef.set(booking);

    return { id: bookingRef.id, ...booking };
  }

  // Guarda la foto/video (y la franja elegida, si aplica) en una reserva que
  // sigue PENDING, sin marcarla como pagada ni asignarle hora. Se usa cuando
  // la pasarela de pago redirige a una página externa (dLocal Go): hay que
  // persistir el archivo ANTES de salir de la página, porque al volver se
  // pierde el estado del navegador.
  async attachMedia(
    id: string,
    data: {
      imageBase64?: string;
      timeSlot?: string;
      trimStart?: number;
      trimEnd?: number;
      frameX?: number;
      frameY?: number;
      frameZoom?: number;
    },
  ) {
    const db = this.firebase.getFirestore();
    const bookingRef = db.collection('lr_bookings').doc(id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists)
      throw new NotFoundException('Booking no encontrado');
    const booking = bookingDoc.data();
    if (!booking) throw new NotFoundException('Booking sin datos');

    if (booking.status !== 'PENDING') {
      return { success: true, message: 'La reserva ya fue procesada' };
    }

    const update: Record<string, any> = {};

    if (data.imageBase64) {
      const uploaded = await this.uploadMediaBase64(
        data.imageBase64,
        'bookings',
      );
      update.imageUrl = uploaded.url;
      update.mediaType = uploaded.mediaType;
      update.trimStart = data.trimStart ?? null;
      update.trimEnd = data.trimEnd ?? null;
      update.frameX = data.frameX ?? null;
      update.frameY = data.frameY ?? null;
      update.frameZoom = data.frameZoom ?? null;
    }

    if (data.timeSlot) {
      update.timeSlot = data.timeSlot;
    }

    if (Object.keys(update).length > 0) {
      await bookingRef.update(update);
    }

    return { success: true };
  }

  async confirmPayment(
    id: string,
    data?: {
      imageBase64?: string;
      timeSlot?: string;
      trimStart?: number;
      trimEnd?: number;
      frameX?: number;
      frameY?: number;
      frameZoom?: number;
    },
  ) {
    const db = this.firebase.getFirestore();
    const bookingRef = db.collection('lr_bookings').doc(id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists)
      throw new NotFoundException('Booking no encontrado');
    const booking = bookingDoc.data();
    if (!booking) throw new NotFoundException('Booking sin datos');

    if (booking.status !== 'PENDING') {
      return { success: true, message: 'La reserva ya fue procesada' };
    }

    let imageUrl = booking.imageUrl;
    let mediaType: 'image' | 'video' = booking.mediaType || 'image';
    // Tramo elegido por el usuario para el video (selector estilo Stories en
    // el frontend) — no se recorta el archivo, solo se guarda dónde arrancar
    // y dónde cortar la reproducción.
    let trimStart: number | null = booking.trimStart ?? null;
    let trimEnd: number | null = booking.trimEnd ?? null;
    // Encuadre elegido por el usuario para el video (arrastrar/zoom en el
    // frontend) — posición relativa (%) y zoom, aplicados en pantalla con el
    // mismo transform CSS que usó el selector, sin volver a recortar a ciegas.
    let frameX: number | null = booking.frameX ?? null;
    let frameY: number | null = booking.frameY ?? null;
    let frameZoom: number | null = booking.frameZoom ?? null;

    // Si se envía la foto o video después del pago, se sube ahora
    if (data?.imageBase64) {
      const uploaded = await this.uploadMediaBase64(
        data.imageBase64,
        'bookings',
      );
      imageUrl = uploaded.url;
      mediaType = uploaded.mediaType;
      trimStart = data.trimStart ?? null;
      trimEnd = data.trimEnd ?? null;
      frameX = data.frameX ?? null;
      frameY = data.frameY ?? null;
      frameZoom = data.frameZoom ?? null;
    }

    // Calcular slot exacto de proyección
    let exactTime = 'Sin asignar';
    let slotDuration = 1;
    let queuePosition = 0;

    const scheduleSettingsDoc = await db
      .collection('lr_settings')
      .doc('schedules')
      .get();
    const screenSettingsDoc = await db
      .collection('lr_settings')
      .doc('screen')
      .get();

    let bookingSystemType = 'slots';
    let franjaDuration = 15;
    if (scheduleSettingsDoc.exists) {
      const data = scheduleSettingsDoc.data() || {};
      slotDuration = Number(data.slotDuration) || 1;
      bookingSystemType = data.bookingSystemType || 'slots';
      franjaDuration = Number(data.franjaDuration) || 15;
    }

    if (bookingSystemType === 'franjas') {
      // Franja inmediata con cupo: se respeta la franja que el usuario eligió
      // antes de pagar (booking.timeSlot); si no eligió ninguna, se usa la franja
      // actual alineada al reloj. findFreeMinuteInFranja con fromMins=nowMins
      // descarta automáticamente franjas ya vencidas (se tratan como "llenas").
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      // La franja puede venir recién elegida en el paso de la foto (data.timeSlot);
      // si no, se respeta la que ya traía la reserva o se usa la franja actual.
      const chosenSlot =
        data?.timeSlot ||
        booking.timeSlot ||
        this.currentFranjaSlot(franjaDuration, now);
      const franjaTime = await this.findFreeMinuteInFranja(
        booking.bookingDate,
        chosenSlot,
        slotDuration,
        nowMins,
      );

      if (franjaTime) {
        await bookingRef.update({
          status: 'APPROVED',
          exactTime: franjaTime,
          timeSlot: chosenSlot,
          imageUrl,
          mediaType,
          trimStart,
          trimEnd,
          frameX,
          frameY,
          frameZoom,
        });

        // Generar la imagen automáticamente en segundo plano
        this.generateImage(id).catch((err) =>
          console.error(`Error auto-generando imagen para ${id}:`, err),
        );
        // Correo de agradecimiento con el código de reserva (no bloquea la respuesta)
        this.sendBookingCodeEmail(booking, {
          code: booking.code,
          timeSlot: chosenSlot,
          exactTime: franjaTime,
        }).catch((err) =>
          console.error(`Error enviando correo de código para ${id}:`, err),
        );

        return {
          success: true,
          exactTime: franjaTime,
          timeSlot: chosenSlot,
          franjaFull: false,
          code: booking.code,
        };
      }

      // Franja elegida llena o vencida: el pago ya ocurrió, la reserva queda
      // aprobada pero sin hora hasta que el usuario elija otra franja (assignFranja).
      await bookingRef.update({
        status: 'APPROVED',
        exactTime: 'Sin asignar',
        timeSlot: '',
        imageUrl,
        mediaType,
        trimStart,
        trimEnd,
        frameX,
        frameY,
        frameZoom,
      });

      this.generateImage(id).catch((err) =>
        console.error(`Error auto-generando imagen para ${id}:`, err),
      );
      this.sendBookingCodeEmail(booking, {
        code: booking.code,
        franjaFull: true,
      }).catch((err) =>
        console.error(`Error enviando correo de código para ${id}:`, err),
      );

      return {
        success: true,
        franjaFull: true,
        currentFranja: chosenSlot,
        availableFranjas: await this.getFranjasAvailability(
          booking.bookingDate,
        ),
        code: booking.code,
      };
    }

    if (bookingSystemType === 'queue') {
      // Logic for automatic queue system
      // Find the latest exactTime for today
      const todayStr = booking.bookingDate;
      const existingQueue = await db
        .collection('lr_bookings')
        .where('bookingDate', '==', todayStr)
        .where('status', 'in', ['APPROVED', 'GENERATED', 'SHOWN'])
        .get();

      queuePosition = existingQueue.size + 1;

      const now = new Date();
      // Se incluyen los segundos de "now" para que la alineación a
      // slotDuration tenga sentido cuando este es fraccionario (ej. 0.5 =
      // 30s); truncar a minuto entero perdía hasta 59s de precisión.
      let baseTimeMins =
        now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

      // Alinear los minutos base para que sean múltiplos exactos del slotDuration (ej: si es 2 min, horas como 1:30, 1:32)
      const remainder = baseTimeMins % slotDuration;
      if (remainder > 1e-9) {
        baseTimeMins += slotDuration - remainder;
      }

      // If there are existing bookings, find the latest assigned time
      if (!existingQueue.empty) {
        let maxMins = 0;
        existingQueue.docs.forEach((doc) => {
          const d = doc.data();
          if (
            d.exactTime &&
            d.exactTime !== 'Sin asignar' &&
            d.exactTime !== 'Agotado/Lleno'
          ) {
            const mins = this.toMins(d.exactTime);
            if (mins > maxMins) maxMins = mins;
          }
        });

        // Next projection is slotDuration minutes after the latest one
        // or current time, whichever is later
        if (maxMins >= baseTimeMins) {
          baseTimeMins = maxMins + slotDuration;
        }
      }

      exactTime = this.toTimeStr(baseTimeMins);
    } else if (booking.timeSlot) {
      // Existing logic for slots
      let deadTimes = [];
      const scheduleDoc = await db
        .collection('lr_daily_schedules')
        .doc(booking.bookingDate)
        .get();

      if (scheduleDoc.exists) {
        deadTimes = scheduleDoc.data()?.deadTimes || [];
      } else {
        deadTimes = screenSettingsDoc.exists
          ? screenSettingsDoc.data()?.deadTimes || []
          : [];
      }

      const [startStr, endStr] = booking.timeSlot.split('-');

      if (startStr && endStr) {
        const startMins = this.toMins(startStr);
        const endMins = this.toMins(endStr);

        const existing = await db
          .collection('lr_bookings')
          .where('timeSlot', '==', booking.timeSlot)
          .where('bookingDate', '==', booking.bookingDate)
          .get();

        const taken = existing.docs
          .map((d) => d.data().exactTime)
          .filter(Boolean);

        for (let m = startMins; m < endMins; m += slotDuration) {
          const tStr = this.toTimeStr(m);
          // Comparación numérica (no de string) para que la franja muerta
          // se evalúe bien incluso cuando tStr trae segundos y los
          // deadTimes solo manejan "HH:MM".
          const isDead = deadTimes.some(
            (dt: any) =>
              m >= this.toMins(dt.startTime) && m < this.toMins(dt.endTime),
          );
          if (!isDead && !taken.includes(tStr)) {
            exactTime = tStr;
            break;
          }
        }
        if (exactTime === 'Sin asignar') exactTime = 'Agotado/Lleno';
      }
    }

    await bookingRef.update({
      status: 'APPROVED',
      exactTime,
      imageUrl,
      mediaType,
      trimStart,
      trimEnd,
      frameX,
      frameY,
      frameZoom,
      ...(bookingSystemType === 'queue' ? { queuePosition } : {}),
    });

    // Generar la imagen automáticamente en segundo plano
    this.generateImage(id).catch((err) =>
      console.error(`Error auto-generando imagen para ${id}:`, err),
    );
    this.sendBookingCodeEmail(booking, {
      code: booking.code,
      timeSlot: booking.timeSlot,
      exactTime,
    }).catch((err) =>
      console.error(`Error enviando correo de código para ${id}:`, err),
    );

    return { success: true, exactTime, queuePosition, code: booking.code };
  }

  async createBooking(data: any) {
    const {
      name,
      docId,
      email,
      whatsapp,
      country,
      city,
      selectedFilter,
      timeSlot,
      bookingDate,
      imageBase64,
      sellerId,
      benefitId,
      paidAmount,
      trimStart,
      trimEnd,
      frameX,
      frameY,
      frameZoom,
    } = data;

    let imageUrl = '';
    let mediaType: 'image' | 'video' = 'image';

    // Si se envía una foto o video en base64, se sube a Firebase Storage
    if (imageBase64) {
      const uploaded = await this.uploadMediaBase64(imageBase64, 'bookings');
      imageUrl = uploaded.url;
      mediaType = uploaded.mediaType;
    }

    // Guardar los datos en Firestore
    const db = this.firebase.getFirestore();

    // Calcular slot exacto (por defecto 1 minuto)
    let exactTime = 'Sin asignar';
    let slotDuration = 1;
    let queuePosition = 0;
    const finalBookingDate = bookingDate || this.todayStr();

    const scheduleSettingsDoc = await db
      .collection('lr_settings')
      .doc('schedules')
      .get();
    const screenSettingsDoc = await db
      .collection('lr_settings')
      .doc('screen')
      .get();

    let bookingSystemType = 'slots';
    let franjaDuration = 15;
    let assignedFranjaSlot = '';
    if (scheduleSettingsDoc.exists) {
      const data = scheduleSettingsDoc.data() || {};
      slotDuration = Number(data.slotDuration) || 1;
      bookingSystemType = data.bookingSystemType || 'slots';
      franjaDuration = Number(data.franjaDuration) || 15;
    }

    if (bookingSystemType === 'franjas') {
      // Flujo asistido: se asigna automáticamente la primera franja con cupo
      // empezando por la actual (sin pedirle selección al admin).
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const currentStart = nowMins - (nowMins % franjaDuration);

      for (let start = currentStart; start < 24 * 60; start += franjaDuration) {
        const slot = `${this.toTimeStr(start)}-${this.toTimeStr(start + franjaDuration)}`;
        const free = await this.findFreeMinuteInFranja(
          finalBookingDate,
          slot,
          slotDuration,
          nowMins,
        );
        if (free) {
          exactTime = free;
          assignedFranjaSlot = slot;
          break;
        }
      }

      if (exactTime === 'Sin asignar') exactTime = 'Agotado/Lleno';
    } else if (bookingSystemType === 'queue') {
      const existingQueue = await db
        .collection('lr_bookings')
        .where('bookingDate', '==', finalBookingDate)
        .where('status', 'in', ['APPROVED', 'GENERATED', 'SHOWN'])
        .get();

      queuePosition = existingQueue.size + 1;
      const now = new Date();
      // Se incluyen los segundos de "now" para que la alineación a
      // slotDuration tenga sentido cuando este es fraccionario (ej. 0.5 =
      // 30s); truncar a minuto entero perdía hasta 59s de precisión.
      let baseTimeMins =
        now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

      // Alinear los minutos base para que sean múltiplos exactos del slotDuration (ej: si es 2 min, horas como 1:30, 1:32)
      const remainder = baseTimeMins % slotDuration;
      if (remainder > 1e-9) {
        baseTimeMins += slotDuration - remainder;
      }

      if (!existingQueue.empty) {
        let maxMins = 0;
        existingQueue.docs.forEach((doc) => {
          const d = doc.data();
          if (
            d.exactTime &&
            d.exactTime !== 'Sin asignar' &&
            d.exactTime !== 'Agotado/Lleno'
          ) {
            const mins = this.toMins(d.exactTime);
            if (mins > maxMins) maxMins = mins;
          }
        });

        if (maxMins >= baseTimeMins) {
          baseTimeMins = maxMins + slotDuration;
        }
      }

      exactTime = this.toTimeStr(baseTimeMins);
    } else if (timeSlot) {
      let deadTimes = [];
      const scheduleDoc = await db
        .collection('lr_daily_schedules')
        .doc(finalBookingDate)
        .get();

      if (scheduleDoc.exists) {
        deadTimes = scheduleDoc.data()?.deadTimes || [];
      } else {
        deadTimes = screenSettingsDoc.exists
          ? screenSettingsDoc.data()?.deadTimes || []
          : [];
      }

      const [startStr, endStr] = timeSlot.split('-');

      if (startStr && endStr) {
        const startMins = this.toMins(startStr);
        const endMins = this.toMins(endStr);

        const existing = await db
          .collection('lr_bookings')
          .where('timeSlot', '==', timeSlot)
          .where('bookingDate', '==', finalBookingDate)
          .get();

        const taken = existing.docs
          .map((d) => d.data().exactTime)
          .filter(Boolean);

        for (let m = startMins; m < endMins; m += slotDuration) {
          const tStr = this.toTimeStr(m);
          // Comparación numérica (no de string) para que la franja muerta
          // se evalúe bien incluso cuando tStr trae segundos y los
          // deadTimes solo manejan "HH:MM".
          const isDead = deadTimes.some(
            (dt: any) =>
              m >= this.toMins(dt.startTime) && m < this.toMins(dt.endTime),
          );
          if (!isDead && !taken.includes(tStr)) {
            exactTime = tStr;
            break;
          }
        }
        if (exactTime === 'Sin asignar') exactTime = 'Agotado/Lleno';
      }
    }

    const bookingRef = db.collection('lr_bookings').doc();

    const booking = {
      name,
      docId,
      email,
      whatsapp: whatsapp || '',
      country,
      city,
      selectedFilter,
      code: this.generateBookingCode(),
      timeSlot:
        bookingSystemType === 'queue'
          ? ''
          : bookingSystemType === 'franjas'
            ? assignedFranjaSlot
            : timeSlot,
      exactTime,
      bookingDate: finalBookingDate,
      imageUrl,
      mediaType,
      trimStart: trimStart ?? null,
      trimEnd: trimEnd ?? null,
      frameX: frameX ?? null,
      frameY: frameY ?? null,
      frameZoom: frameZoom ?? null,
      status: 'APPROVED', // Lo marcamos como APPROVED
      paymentMethod: data.paymentMethod || 'Wompi', // 'Wompi' (auto-reserva) o el nombre de un método de lr_payment_methods (reserva asistida)
      requiresInvoice: data.requiresInvoice || false, // boolean
      sellerId: sellerId || null,
      benefitId: benefitId || null,
      // Monto realmente cobrado en la reserva asistida (lo escribe el vendedor
      // a mano, puede ser 0 para cortesía) — independiente del precio general
      // vigente, que puede cambiar después.
      paidAmount: paidAmount != null ? Number(paidAmount) : null,
      createdAt: new Date(),
      ...(bookingSystemType === 'queue' ? { queuePosition } : {}),
    };

    await bookingRef.set(booking);

    // Generar la imagen automáticamente en segundo plano
    this.generateImage(bookingRef.id).catch((err) =>
      console.error(`Error auto-generando imagen para ${bookingRef.id}:`, err),
    );
    this.sendBookingCodeEmail(booking, {
      code: booking.code,
      timeSlot: booking.timeSlot,
      exactTime,
    }).catch((err) =>
      console.error(
        `Error enviando correo de código para ${bookingRef.id}:`,
        err,
      ),
    );

    return { id: bookingRef.id, ...booking };
  }

  async getBookings() {
    const db = this.firebase.getFirestore();
    const snapshot = await db
      .collection('lr_bookings')
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async searchBookings(query: string) {
    const db = this.firebase.getFirestore();
    const trimmed = (query || '').trim();

    // Primero buscamos por docId (cédula) — lo que usa el staff en punto de venta
    let snapshot = await db
      .collection('lr_bookings')
      .where('docId', '==', trimmed)
      .get();

    // Si no hay por docId, buscamos por email
    if (snapshot.empty) {
      snapshot = await db
        .collection('lr_bookings')
        .where('email', '==', trimmed)
        .get();
    }

    // Si tampoco hay por email, buscamos por código de reserva (ej: "A3-F9-K2").
    // Normalizamos mayúsculas/espacios y, si viene sin guiones, los insertamos.
    if (snapshot.empty) {
      let normalizedCode = trimmed.toUpperCase().replace(/\s+/g, '');
      if (/^[A-Z0-9]{6}$/.test(normalizedCode)) {
        normalizedCode = `${normalizedCode.slice(0, 2)}-${normalizedCode.slice(2, 4)}-${normalizedCode.slice(4, 6)}`;
      }
      snapshot = await db
        .collection('lr_bookings')
        .where('code', '==', normalizedCode)
        .get();
    }

    const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Ordenar de la más próxima a la más antigua (basado en bookingDate y exactTime)
    // Para ello concatenamos las fechas y horas y ordenamos descendente o ascendente según se necesite.
    // Proyección más próxima = la que está más en el futuro, luego las antiguas.
    const now = new Date();

    docs.sort((a: any, b: any) => {
      const dateA = new Date(
        `${a.bookingDate}T${a.exactTime !== 'Sin asignar' && a.exactTime !== 'Agotado/Lleno' ? a.exactTime : a.timeSlot ? a.timeSlot.split('-')[0] : '00:00'}`,
      );
      const dateB = new Date(
        `${b.bookingDate}T${b.exactTime !== 'Sin asignar' && b.exactTime !== 'Agotado/Lleno' ? b.exactTime : b.timeSlot ? b.timeSlot.split('-')[0] : '00:00'}`,
      );

      return dateB.getTime() - dateA.getTime(); // Ordenar de más reciente a más antigua
    });

    return docs;
  }

  async updateBookingStatus(id: string, status: string) {
    const db = this.firebase.getFirestore();
    await db.collection('lr_bookings').doc(id).update({ status });
    return { success: true, status };
  }

  async generateImage(id: string) {
    const db = this.firebase.getFirestore();
    const bookingRef = db.collection('lr_bookings').doc(id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists)
      throw new NotFoundException('Booking no encontrado');
    const booking = bookingDoc.data();
    if (!booking) throw new NotFoundException('Booking sin datos');

    // Sin filtro seleccionado (política de filtros desactivada, o el cliente
    // reservó cuando estaba desactivada), o el archivo subido es un video (no
    // se edita ni se le aplica generación de IA, solo se proyecta tal cual):
    // no hay nada que generar, se respeta el horario agendado (igual que
    // cualquier booking GENERATED, vía el cron de autoProjectBookings).
    if (!booking.selectedFilter || booking.mediaType === 'video') {
      await bookingRef.update({
        generatedImageUrl: booking.imageUrl,
        status: 'GENERATED',
      });
      return {
        success: true,
        generatedImageUrl: booking.imageUrl,
        skippedAi: true,
      };
    }

    // Obtener el filtro
    const filterDoc = await db
      .collection('lr_filters')
      .doc(booking.selectedFilter)
      .get();
    if (!filterDoc.exists)
      throw new NotFoundException('Filtro no encontrado en la base de datos');
    const filter = filterDoc.data();

    if (!filter) throw new NotFoundException('Filtro sin datos');

    // Descargar la imagen original de Firebase Storage (o URL pública)
    const imageRes = await axios.get(booking.imageUrl, {
      responseType: 'arraybuffer',
    });
    const imageBuffer = Buffer.from(imageRes.data);

    // Preparar form-data
    const form = new FormData();
    form.append('lora', filter.lora || filter.value);
    form.append('prompt', filter.prompt || '');
    form.append('lora_strength', String(filter.lora_strength || 1.0));
    form.append('denoise', String(filter.denoise || 0.7));
    form.append('image', imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg',
    });

    // Llamar a la API externa de generación (principal)
    let generatedBuffer: Buffer | null = null;
    try {
      const aiApiUrl =
        process.env.AI_GENERATION_API_URL || 'http://localhost:8000';
      const generateRes = await axios.post(`${aiApiUrl}/generate`, form, {
        headers: form.getHeaders(),
        responseType: 'arraybuffer',
      });

      const contentType = generateRes.headers['content-type'];
      if (
        typeof contentType === 'string' &&
        contentType.includes('application/json')
      ) {
        const json = JSON.parse(generateRes.data.toString());
        // Extrae la imagen en base64 de la respuesta JSON (depende de cómo responda tu API)
        generatedBuffer = Buffer.from(
          json.image || json.base64 || json.imageUrl || '',
          'base64',
        );
      } else {
        // Si la API devuelve directamente la imagen binaria
        generatedBuffer = Buffer.from(generateRes.data);
      }
    } catch (apiError: any) {
      if (apiError.response && apiError.response.data) {
        const errorString = Buffer.from(apiError.response.data).toString(
          'utf-8',
        );
        console.error('Error de la API de imágenes:', errorString);
      } else {
        console.error('Error llamando a la API de imágenes:', apiError.message);
      }
      console.log(
        'API de generación no disponible. Intentando generar la imagen con Gemini como alternativa...',
      );
    }

    // Si la API principal falló, intentar con Gemini usando las imágenes de referencia del filtro
    if (!generatedBuffer) {
      generatedBuffer = await this.generateImageWithGemini(filter, imageBuffer);
    }

    // Si tampoco Gemini pudo generar la imagen, proyectar la foto original
    if (!generatedBuffer) {
      console.log(
        'Gemini no disponible o sin resultado. Se proyectará la imagen original inmediatamente.',
      );

      await this.projectBooking(id);

      return {
        success: true,
        message:
          'Falló la generación (API principal y Gemini), se proyectó la imagen original',
        generatedImageUrl: booking.imageUrl,
      };
    }

    // Subir imagen final a Firebase Storage
    const storage = this.firebase.getStorage();
    const bucket = storage.bucket();
    const fileName = `generated/${id}_${Date.now()}.jpg`;
    const file = bucket.file(fileName);

    await file.save(generatedBuffer, {
      metadata: { contentType: 'image/jpeg' },
    });

    let generatedImageUrl = '';
    try {
      await file.makePublic();
      generatedImageUrl = file.publicUrl();
    } catch (e) {
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '01-01-2100',
      });
      generatedImageUrl = url;
    }

    // Actualizar documento con la URL final y el estado
    await bookingRef.update({ generatedImageUrl, status: 'GENERATED' });

    return { success: true, generatedImageUrl };
  }

  // Alternativa a la API de generación principal: usa Gemini con las dos imágenes
  // de referencia del filtro (el arte a imitar) más la foto de la persona para
  // generar una imagen de la persona siguiendo ese estilo de arte.
  private async generateImageWithGemini(
    filter: any,
    personImageBuffer: Buffer,
  ): Promise<Buffer | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image';
    const referenceUrls = [
      filter.referenceImageUrl1,
      filter.referenceImageUrl2,
    ].filter(Boolean);

    try {
      const parts: any[] = [];

      for (const url of referenceUrls) {
        const refRes = await axios.get(url, { responseType: 'arraybuffer' });
        parts.push({
          inlineData: {
            mimeType: refRes.headers['content-type'] || 'image/jpeg',
            data: Buffer.from(refRes.data).toString('base64'),
          },
        });
      }

      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: personImageBuffer.toString('base64'),
        },
      });

      const instructions = [
        'Las primeras imágenes son referencias de un estilo artístico.',
        'La última imagen es la foto de una persona.',
        'Genera una nueva imagen de esa persona aplicando el estilo artístico, colores y técnica de las imágenes de referencia.',
        'Es prioritario que se mantenga fielmente el estilo de arte de las referencias, incluso si eso implica sacrificar el parecido exacto o la identidad reconocible de la persona.',
        filter.prompt || '',
      ]
        .filter(Boolean)
        .join(' ');

      parts.push({ text: instructions });

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { contents: [{ parts }] },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
        },
      );

      const candidateParts =
        response.data?.candidates?.[0]?.content?.parts || [];
      const imagePart = candidateParts.find((p: any) => p.inlineData?.data);

      return imagePart
        ? Buffer.from(imagePart.inlineData.data, 'base64')
        : null;
    } catch (geminiError: any) {
      console.error(
        'Error llamando a Gemini:',
        geminiError.response?.data || geminiError.message,
      );
      return null;
    }
  }

  async getScreenSettings() {
    const db = this.firebase.getFirestore();
    const doc = await db.collection('lr_settings').doc('screen').get();
    const data = doc.exists
      ? doc.data()
      : {
          backgroundUrl: '',
          headerUrl: '',
          footerUrl: '',
          carouselImages: [],
          carouselDuration: 5,
          projectionDuration: 15,
          videoProjectionDuration: 15,
          carouselTransitionDirection: 'right',
          cropWidth: 576,
          cropHeight: 1152,
          contentGrid: [],
          deadTimes: [], // Tiempos muertos (descansos)
          restScreenIdleMinutes: 5,
          restScreenItems: [],
          revealEffect: 'spray',
          revealOverlayVideoUrl: '',
          revealOverlayFadeSeconds: 2,
          containerTransition: 'fade',
          emailFrameUrl: '',
          currentProjection: null,
        };

    // La pantalla de reposo no debe interrumpir a un cliente que ya pagó y
    // está esperando su turno de proyección (aunque `currentProjection` esté
    // vacío en este instante) — se lo indicamos al frontend con este flag.
    const hasPendingQueue = await this.hasPendingQueueToday();

    return { ...data, hasPendingQueue };
  }

  private async hasPendingQueueToday(): Promise<boolean> {
    const db = this.firebase.getFirestore();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const targetDateStr = `${year}-${month}-${day}`;

    const snapshot = await db
      .collection('lr_bookings')
      .where('bookingDate', '==', targetDateStr)
      .where('status', 'in', ['APPROVED', 'GENERATED'])
      .limit(1)
      .get();

    return !snapshot.empty;
  }

  async updateScreenSettings(data: any) {
    const db = this.firebase.getFirestore();
    await db.collection('lr_settings').doc('screen').set(data, { merge: true });
    return { success: true };
  }

  async recordGridItemAppearance(itemId: string) {
    const db = this.firebase.getFirestore();
    const settingsRef = db.collection('lr_settings').doc('screen');
    const doc = await settingsRef.get();
    if (!doc.exists) return { success: false };
    const data = doc.data();
    if (data && data.contentGrid) {
      const grid = data.contentGrid.map((item: any) => {
        if (item.id === itemId) {
          return {
            ...item,
            currentAppearances: (item.currentAppearances || 0) + 1,
            lastShown: Date.now(),
          };
        }
        return item;
      });
      await settingsRef.update({ contentGrid: grid });
      return { success: true };
    }
    return { success: false };
  }

  async clearProjection() {
    const db = this.firebase.getFirestore();
    await db
      .collection('lr_settings')
      .doc('screen')
      .set({ currentProjection: null }, { merge: true });
    return { success: true };
  }

  async projectBooking(bookingId: string) {
    const db = this.firebase.getFirestore();
    const bookingDoc = await db.collection('lr_bookings').doc(bookingId).get();
    if (!bookingDoc.exists)
      throw new NotFoundException('Booking no encontrado');
    const b = bookingDoc.data();

    if (!b) throw new NotFoundException('Booking sin datos');

    let frameUrl = '';

    if (b.selectedFilter) {
      const filterDoc = await db
        .collection('lr_filters')
        .doc(b.selectedFilter)
        .get();
      if (filterDoc.exists) {
        const filterData = filterDoc.data();
        if (filterData) {
          frameUrl = filterData.frameUrl || '';
        }
      }
    }

    // El efecto de revelado y la transición de entrada/salida ya NO dependen
    // del filtro (con filtros desactivados no habría de dónde sacarlos) — son
    // una configuración global en lr_settings/screen, válida con o sin filtro.
    const screenSettingsDoc = await db
      .collection('lr_settings')
      .doc('screen')
      .get();
    const screenSettings = screenSettingsDoc.exists
      ? screenSettingsDoc.data() || {}
      : {};

    // Si ya hay una proyección activa de OTRA reserva, no la pisamos: el
    // cliente que ya está en pantalla perdería su turno sin llegar nunca a
    // completarse (su timer de /complete en el frontend se cancela al
    // cambiar currentProjection, así que ni siquiera le llegaría el correo).
    // Hay que esperar a que termine o despejar la pantalla manualmente.
    if (
      screenSettings.currentProjection &&
      screenSettings.currentProjection.id !== bookingId
    ) {
      throw new ConflictException(
        'Ya hay una proyección activa. Espera a que termine o despeja la pantalla.',
      );
    }

    const revealEffect = screenSettings.revealEffect || 'spray';
    const transitionEffect = screenSettings.containerTransition || 'fade';

    const projectionData = {
      id: bookingId,
      name: b.name || '',
      code: b.code || '',
      imageUrl: b.generatedImageUrl || b.imageUrl || '',
      mediaType: b.mediaType || 'image',
      timestamp: Date.now(),
      transitionEffect,
      revealEffect,
      revealOverlayVideoUrl:
        revealEffect === 'video-overlay'
          ? screenSettings.revealOverlayVideoUrl || ''
          : '',
      revealOverlayFadeSeconds: screenSettings.revealOverlayFadeSeconds || 2,
      frameUrl,
      trimStart: b.trimStart ?? null,
      trimEnd: b.trimEnd ?? null,
      frameX: b.frameX ?? null,
      frameY: b.frameY ?? null,
      frameZoom: b.frameZoom ?? null,
    };

    await db
      .collection('lr_settings')
      .doc('screen')
      .set({ currentProjection: projectionData }, { merge: true });
    await db
      .collection('lr_bookings')
      .doc(bookingId)
      .update({ status: 'SHOWN' });
    return { success: true };
  }

  // Compone el marco (PNG con transparencia, configurado globalmente en
  // lr_settings/screen) sobre la foto ya generada, SOLO para el correo — la
  // proyección en pantalla no se toca. Tanto la foto como el marco se ajustan
  // con "cover" a la Proporción de Recorte configurada (cropWidth/cropHeight)
  // — la misma que usa el resto del sistema (pantalla y filtros incluidos) —
  // así ambos llenan siempre el mismo lienzo sin dejar huecos, aunque eso
  // implique recortar un poco el borde exterior del marco si su PNG no tiene
  // exactamente esa proporción.
  // Devuelve null si algo falla, para que el llamador pueda seguir usando la
  // foto sin marco como respaldo.
  private async compositeEmailFrame(
    imageUrl: string,
    frameUrl: string,
    cropWidth: number,
    cropHeight: number,
  ): Promise<string | null> {
    try {
      const [imageRes, frameRes] = await Promise.all([
        axios.get(imageUrl, { responseType: 'arraybuffer' }),
        axios.get(frameUrl, { responseType: 'arraybuffer' }),
      ]);
      const imageBuffer = Buffer.from(imageRes.data);
      const frameBuffer = Buffer.from(frameRes.data);

      const resizedImage = await sharp(imageBuffer)
        .resize(cropWidth, cropHeight, { fit: 'cover' })
        .toBuffer();
      const resizedFrame = await sharp(frameBuffer)
        .resize(cropWidth, cropHeight, { fit: 'cover' })
        .toBuffer();

      const composited = await sharp(resizedImage)
        .composite([{ input: resizedFrame }])
        .jpeg({ quality: 90 })
        .toBuffer();

      const storage = this.firebase.getStorage();
      const bucket = storage.bucket();
      const fileName = `generated/email-framed-${Date.now()}-${uuidv4()}.jpg`;
      const file = bucket.file(fileName);
      await file.save(composited, { metadata: { contentType: 'image/jpeg' } });

      try {
        await file.makePublic();
        return file.publicUrl();
      } catch {
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: '01-01-2100',
        });
        return url;
      }
    } catch (e: any) {
      console.error('Error componiendo marco para el correo:', e.message);
      return null;
    }
  }

  // Igual que compositeEmailFrame pero para video: compone el marco sobre
  // CADA fotograma durante toda la duración (filtro overlay de ffmpeg), no
  // solo una miniatura. Recodifica el video completo — es lento (segundos a
  // decenas de segundos) por eso se corre desacoplado del request que lo
  // dispara (ver sendFramedVideoResultEmail). El audio original se conserva
  // sin recodificar.
  //
  // El video original NUNCA se recorta al subirlo (solo se guarda
  // frameX/frameY/frameZoom como metadatos para el CSS de la pantalla), así
  // que aquí se lleva a la Proporción de Recorte configurada (cropWidth x
  // cropHeight) con un recorte tipo "cover" (igual que object-fit: cover en
  // pantalla) antes de superponer el marco, también recortado a "cover" sobre
  // ese mismo tamaño para no dejar huecos.
  private async compositeEmailFrameVideo(
    videoUrl: string,
    frameUrl: string,
    cropWidth: number,
    cropHeight: number,
  ): Promise<string | null> {
    const outputPath = path.join(
      os.tmpdir(),
      `email-framed-${Date.now()}-${uuidv4()}.mp4`,
    );
    const w = Math.round(cropWidth);
    const h = Math.round(cropHeight);
    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(videoUrl)
          .input(frameUrl)
          .complexFilter([
            `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}[base]`,
            `[1:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},format=rgba[ovr]`,
            '[base][ovr]overlay=0:0:format=auto[outv]',
          ])
          .outputOptions(['-map', '[outv]', '-map', '0:a?', '-c:a', 'copy'])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      const buffer = fs.readFileSync(outputPath);
      const storage = this.firebase.getStorage();
      const bucket = storage.bucket();
      const fileName = `generated/email-framed-${Date.now()}-${uuidv4()}.mp4`;
      const file = bucket.file(fileName);
      await file.save(buffer, { metadata: { contentType: 'video/mp4' } });

      try {
        await file.makePublic();
        return file.publicUrl();
      } catch {
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: '01-01-2100',
        });
        return url;
      }
    } catch (e: any) {
      console.error(
        'Error componiendo marco en video para el correo:',
        e.message,
      );
      return null;
    } finally {
      fs.promises.unlink(outputPath).catch(() => {});
    }
  }

  private buildResultEmail(
    name: string,
    mediaBlockEs: string,
    mediaBlockEn: string,
    isVideo: boolean,
    lang: Lang,
  ): { html: string; subject: string } {
    const frontendUrl = this.getFrontendUrl();
    return renderResultEmail({
      lang,
      frontendUrl,
      name,
      mediaBlockHtml: lang === 'en' ? mediaBlockEn : mediaBlockEs,
      isVideo,
    });
  }

  private getDownloadUrl(code: string): string {
    return `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/bookings/download/${code}`;
  }

  // Camino pesado: compone el marco sobre el video completo antes de mandar
  // el correo. Se invoca sin `await` desde completeProjection (fire-and-forget)
  // para no bloquear esa respuesta ni el envío de WhatsApp que sigue después.
  private async sendFramedVideoResultEmail(
    b: any,
    bookingRef: FirebaseFirestore.DocumentReference,
    originalVideoUrl: string,
    emailFrameUrl: string,
    lang: string,
    cropWidth: number,
    cropHeight: number,
  ) {
    const framedUrl = await this.compositeEmailFrameVideo(
      originalVideoUrl,
      emailFrameUrl,
      cropWidth,
      cropHeight,
    );
    // El botón de descarga apunta siempre al endpoint de descarga (que resuelve
    // la versión con marco vía emailFramedVideoUrl si la composición tuvo éxito).
    const downloadUrl = this.getDownloadUrl(b.code);
    const mediaBlockEs = renderButton('Descarga tu recuerdo', downloadUrl);
    const mediaBlockEn = renderButton('Download your memory', downloadUrl);
    const { html, subject } = this.buildResultEmail(
      b.name,
      mediaBlockEs,
      mediaBlockEn,
      true,
      lang as Lang,
    );

    await this.emailService.sendEmail(b.email, subject, html);
    const update: Record<string, any> = { emailSent: true };
    if (framedUrl) update.emailFramedVideoUrl = framedUrl;
    await bookingRef.update(update);
  }

  async completeProjection(bookingId: string) {
    const db = this.firebase.getFirestore();
    // 1. Limpiar pantalla
    await db
      .collection('lr_settings')
      .doc('screen')
      .set({ currentProjection: null }, { merge: true });

    // 2. Obtener reserva
    const bookingRef = db.collection('lr_bookings').doc(bookingId);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists)
      throw new NotFoundException('Booking no encontrado');

    const b = bookingDoc.data();
    if (!b) return { success: true };

    // 3. Evitar doble envío
    if (b.waSend)
      return { success: true, message: 'Notificación de WhatsApp ya enviada' };

    // 4. Enviar el correo electrónico
    if (b.email && !b.emailSent) {
      const generalDoc = await db
        .collection('lr_settings')
        .doc('general')
        .get();
      const lang = generalDoc.exists
        ? generalDoc.data()?.language || 'es'
        : 'es';

      const imageUrl = b.generatedImageUrl || b.imageUrl;
      const isVideo = b.mediaType === 'video';

      // El marco (emailFrameUrl) es global y solo se compone para el correo —
      // la proyección en pantalla no lleva marco. Se usa la misma Proporción
      // de Recorte (cropWidth/cropHeight) que el resto del sistema, para que
      // foto/video y marco queden siempre con la misma dimensión esperada.
      const screenDoc = await db.collection('lr_settings').doc('screen').get();
      const screenData = screenDoc.exists ? screenDoc.data() : undefined;
      const emailFrameUrl = screenData?.emailFrameUrl || '';
      const cropWidth = screenData?.cropWidth || 576;
      const cropHeight = screenData?.cropHeight || 1152;

      if (isVideo && emailFrameUrl) {
        // Recodificar el video completo es lento — se dispara sin `await`
        // para no bloquear ni esta respuesta ni el envío de WhatsApp de abajo.
        // El correo sale en cuanto termine de componerse en segundo plano.
        this.sendFramedVideoResultEmail(
          b,
          bookingRef,
          imageUrl,
          emailFrameUrl,
          lang,
          cropWidth,
          cropHeight,
        ).catch((e: any) =>
          console.error(
            'Error componiendo/enviando video con marco:',
            e.message,
          ),
        );
      } else {
        let emailImageUrl = imageUrl;
        let emailFramedImageUrl: string | undefined;
        if (!isVideo && emailFrameUrl) {
          const composed = await this.compositeEmailFrame(
            imageUrl,
            emailFrameUrl,
            cropWidth,
            cropHeight,
          );
          if (composed) {
            emailImageUrl = composed;
            emailFramedImageUrl = composed;
          }
        }

        const downloadUrl = this.getDownloadUrl(b.code);
        // Los clientes de correo en general no reproducen <video> embebido,
        // así que para video el botón de descarga es el único CTA. Para foto
        // se mantiene la imagen embebida y se agrega el botón debajo.
        const mediaBlockEs = isVideo
          ? renderButton('Descarga tu recuerdo', downloadUrl)
          : `<img src="${emailImageUrl}" alt="Tu foto" style="max-width: 100%; border-radius: 12px; margin: 0 0 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />${renderButton('Descarga tu recuerdo', downloadUrl)}`;
        const mediaBlockEn = isVideo
          ? renderButton('Download your memory', downloadUrl)
          : `<img src="${emailImageUrl}" alt="Your photo" style="max-width: 100%; border-radius: 12px; margin: 0 0 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />${renderButton('Download your memory', downloadUrl)}`;

        const { html, subject } = this.buildResultEmail(
          b.name,
          mediaBlockEs,
          mediaBlockEn,
          isVideo,
          lang as Lang,
        );

        try {
          await this.emailService.sendEmail(b.email, subject, html);
          const update: Record<string, any> = { emailSent: true };
          if (emailFramedImageUrl)
            update.emailFramedImageUrl = emailFramedImageUrl;
          await bookingRef.update(update);
        } catch (e: any) {
          console.error('Error enviando correo al cliente:', e.message);
        }
      }
    }

    // Enviar WhatsApp de resultado (Después de la proyección en completeProjection)
    let waSend = b.waSend || false;

    console.log(`[Diagnostic] Preparando envío WA para: ${b.name}`);
    console.log(
      `[Diagnostic] Whatsapp num: ${b.whatsapp}, waSend state: ${waSend}`,
    );
    console.log(
      `[Diagnostic] ENV.WHATSAPP_API_URL: ${process.env.WHATSAPP_API_URL}, ENV.WHATSAPP_ACCOUNT_ID: ${process.env.WHATSAPP_ACCOUNT_ID}`,
    );

    if (
      b.whatsapp &&
      process.env.WHATSAPP_API_URL &&
      !waSend &&
      b.mediaType !== 'video'
    ) {
      try {
        const imageUrl = b.generatedImageUrl || b.imageUrl;
        console.log(
          `[Diagnostic] Enviando payload a ${process.env.WHATSAPP_API_URL}/api/send-image-result con imageUrl: ${imageUrl}`,
        );

        const waResponse = await axios.post(
          `${process.env.WHATSAPP_API_URL}/api/send-image-result`,
          {
            accountId: process.env.WHATSAPP_ACCOUNT_ID,
            to: b.whatsapp,
            imageUrl,
            userName: b.name,
            experienceName: "Led's on Renacer",
            organizationName: 'Galería Renacer',
          },
        );

        console.log(
          `[Diagnostic] Respuesta de WA API: ${waResponse.status} - ${JSON.stringify(waResponse.data)}`,
        );
        waSend = true;
      } catch (err: any) {
        console.error(
          '[Diagnostic] Error crítico enviando WhatsApp de resultado:',
          err.message,
        );
        if (err.response) {
          console.error(
            '[Diagnostic] Detalles del error WA:',
            err.response.data,
          );
        }
      }
    } else {
      console.log(
        `[Diagnostic] Omitiendo envío WA. Motivo: Faltan variables de entorno, whatsapp del usuario está vacío, o waSend ya era true.`,
      );
    }

    // 5. Marcar como finalizado (para el panel admin)
    await bookingRef.update({ status: 'COMPLETED', waSend });

    return { success: true };
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkAbandonedBookings() {
    const db = this.firebase.getFirestore();
    const now = new Date();
    // Considerar abandonado si lleva más de 15 minutos pendiente
    const abandonedTime = new Date(now.getTime() - 15 * 60000);

    try {
      const snapshot = await db
        .collection('lr_bookings')
        .where('status', '==', 'PENDING')
        .where('abandonmentEmailSent', '==', false)
        .where('createdAt', '<', abandonedTime)
        .get();

      if (snapshot.empty) return;

      const generalDoc = await db
        .collection('lr_settings')
        .doc('general')
        .get();
      const lang = generalDoc.exists
        ? generalDoc.data()?.language || 'es'
        : 'es';

      for (const doc of snapshot.docs) {
        const b = doc.data();
        if (b.email) {
          // El horario puede no estar elegido todavía (en modo franjas se elige
          // recién en el paso de la foto, después del pago).
          const savedLineEs = b.timeSlot
            ? `Tu foto y tu horario <strong>${b.timeSlot}</strong> del <strong>${b.bookingDate}</strong> aún están guardados.`
            : `Tu foto para el <strong>${b.bookingDate}</strong> aún está guardada.`;
          const savedLineEn = b.timeSlot
            ? `Your photo and your time slot <strong>${b.timeSlot}</strong> on <strong>${b.bookingDate}</strong> are still saved.`
            : `Your photo for <strong>${b.bookingDate}</strong> is still saved.`;

          const frontendUrl = this.getFrontendUrl();
          const { html, subject } = renderAbandonedCartEmail({
            lang: lang as Lang,
            frontendUrl,
            name: b.name,
            savedLine: lang === 'en' ? savedLineEn : savedLineEs,
          });

          try {
            await this.emailService.sendEmail(b.email, subject, html);
            await doc.ref.update({ abandonmentEmailSent: true });
          } catch (e: any) {
            console.error(
              `Error enviando correo de abandono para ${doc.id}:`,
              e.message,
            );
          }
        }
      }
    } catch (e: any) {
      console.error('Error verificando carritos abandonados:', e.message);
    }
  }

  // Resolución de 10s (no 1min): slotDuration puede ser fraccionario (ej.
  // 0.5min = 30s) y exactTime puede caer en un segundo exacto — con
  // EVERY_MINUTE la proyección se disparaba hasta 59s tarde.
  @Cron(CronExpression.EVERY_10_SECONDS)
  async autoProjectBookings() {
    const db = this.firebase.getFirestore();
    const now = new Date();

    // Convertir la fecha actual al formato YYYY-MM-DD local
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const targetDateStr = `${year}-${month}-${day}`;

    const nowMins =
      now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

    try {
      // Si ya hay una proyección activa, no se busca la siguiente todavía —
      // se espera a que termine (BigScreenView llama a /complete y limpia
      // currentProjection) para no pisarla a mitad de su tiempo en pantalla.
      const screenSettingsDoc = await db
        .collection('lr_settings')
        .doc('screen')
        .get();
      if (screenSettingsDoc.exists && screenSettingsDoc.data()?.currentProjection) {
        return;
      }

      const snapshot = await db
        .collection('lr_bookings')
        .where('bookingDate', '==', targetDateStr)
        .where('status', '==', 'GENERATED')
        .get();

      if (snapshot.empty) return;

      for (const doc of snapshot.docs) {
        const b = doc.data();
        if (
          b.exactTime &&
          b.exactTime !== 'Sin asignar' &&
          b.exactTime !== 'Agotado/Lleno'
        ) {
          const exactMins = this.toMins(b.exactTime);

          // Si ya es la hora programada para la proyección y no han pasado más de 5 minutos (margen de tolerancia)
          if (nowMins >= exactMins && nowMins < exactMins + 5) {
            console.log(
              `[Diagnostic] Auto-proyectando reserva ${doc.id} (Hora programada: ${b.exactTime}, Minuto actual: ${now.getHours()}:${now.getMinutes()})`,
            );
            await this.projectBooking(doc.id);
            // Solo una por tick: si hubiera varias vencidas a la vez, las
            // demás esperan al siguiente tick (una vez esta termine) en vez
            // de pisarse entre sí sin llegar a completarse.
            break;
          }
        }
      }
    } catch (e: any) {
      console.error('[Diagnostic] Error en autoProjectBookings:', e.message);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkUpcomingProjections() {
    console.log('[Diagnostic] Ejecutando Cronjob: checkUpcomingProjections');

    const db = this.firebase.getFirestore();
    const now = new Date();

    const targetDateStr = this.todayStr(now);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const maxMins = nowMins + 10;

    try {
      const snapshot = await db
        .collection('lr_bookings')
        .where('bookingDate', '==', targetDateStr)
        .get();

      if (snapshot.empty) {
        console.log(
          '[Diagnostic] No hay bookings para el día de hoy:',
          targetDateStr,
        );
        return;
      }

      const apiUrl = process.env.WHATSAPP_API_URL;
      const accountId = process.env.WHATSAPP_ACCOUNT_ID;

      if (!apiUrl) {
        console.log(
          '[Diagnostic] Omite notificaciones de proyección: FALTA WHATSAPP_API_URL en el entorno.',
        );
        return;
      }

      let notifsSent = 0;
      console.log(
        `[Diagnostic] Revisando ${snapshot.size} bookings para proyecciones próximas...`,
      );
      for (const doc of snapshot.docs) {
        const b = doc.data();

        const validStatus = b.status === 'APPROVED' || b.status === 'GENERATED';

        if (
          validStatus &&
          b.whatsapp &&
          !b.projectionNotificationSent &&
          b.exactTime &&
          b.exactTime !== 'Sin asignar' &&
          b.exactTime !== 'Agotado/Lleno'
        ) {
          const exactMins = this.toMins(b.exactTime);
          console.log(
            `[Diagnostic] Booking ${doc.id} - exactTime: ${b.exactTime}, exactMins: ${exactMins}, nowMins: ${nowMins}, maxMins: ${maxMins}`,
          );
          if (exactMins >= nowMins && exactMins <= maxMins) {
            const shortName = b.name
              ? b.name.trim().split(' ')[0].substring(0, 20)
              : 'Amigo';

            console.log(
              `[Diagnostic] Enviando Notificación Previa a: ${shortName} (${b.whatsapp}) para la proyección de las ${b.exactTime}`,
            );
            try {
              await axios.post(`${apiUrl}/api/send-projection-notification`, {
                accountId,
                to: b.whatsapp,
                experienceName: 'Renacer',
                userName: shortName,
              });
              await doc.ref.update({ projectionNotificationSent: true });
              notifsSent++;
            } catch (err: any) {
              console.error(
                `[Diagnostic] Error enviando WhatsApp previo para ${doc.id}:`,
                err.message,
              );
              if (err.response) {
                console.error(
                  '[Diagnostic] Detalles del error WA:',
                  err.response.data,
                );
              }
            }
          }
        }
      }

      console.log(
        `[Diagnostic] Cronjob finalizado. Notificaciones enviadas en este ciclo: ${notifsSent}`,
      );
    } catch (e: any) {
      console.error(
        '[Diagnostic] Error verificando proyecciones próximas:',
        e.message,
      );
    }
  }
}
