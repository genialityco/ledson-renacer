import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FirebaseService } from '../firebase/firebase.service';
import { EmailService } from '../email/email.service';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import FormData from 'form-data';

@Injectable()
export class BookingsService {
  constructor(
    private firebase: FirebaseService,
    private emailService: EmailService,
  ) {}

  private toMins(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  private toTimeStr(m: number): string {
    const h = Math.floor(m / 60) % 24;
    return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  private todayStr(now = new Date()): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

    // Si se envía una imagen en base64, se sube a Firebase Storage
    if (imageBase64) {
      const storage = this.firebase.getStorage();
      const bucket = storage.bucket();
      const fileName = `bookings/${uuidv4()}.jpg`;
      const file = bucket.file(fileName);

      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      await file.save(buffer, {
        metadata: { contentType: 'image/jpeg' },
      });

      try {
        await file.makePublic();
        imageUrl = file.publicUrl();
      } catch (e) {
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: '01-01-2100',
        });
        imageUrl = url;
      }
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
      finalBookingDate = new Date().toISOString().split('T')[0];
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
      timeSlot: finalTimeSlot,
      exactTime: 'Sin asignar', // Se asignará al confirmar el pago
      bookingDate: finalBookingDate,
      imageUrl,
      status: 'PENDING', // Queda como pendiente de pago
      paymentMethod: data.paymentMethod || 'Wompi',
      requiresInvoice: data.requiresInvoice || false,
      createdAt: new Date(),
      abandonmentEmailSent: false,
    };

    await bookingRef.set(booking);

    return { id: bookingRef.id, ...booking };
  }

  async confirmPayment(id: string, data?: { imageBase64?: string }) {
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

    // Si se envía la foto después del pago, se sube ahora
    if (data?.imageBase64) {
      const storage = this.firebase.getStorage();
      const bucket = storage.bucket();
      const fileName = `bookings/${uuidv4()}.jpg`;
      const file = bucket.file(fileName);

      const base64Data = data.imageBase64.replace(
        /^data:image\/\w+;base64,/,
        '',
      );
      const buffer = Buffer.from(base64Data, 'base64');

      await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });
      try {
        await file.makePublic();
        imageUrl = file.publicUrl();
      } catch (e) {
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: '01-01-2100',
        });
        imageUrl = url;
      }
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
      // Franja inmediata con cupo: se intenta asignar la franja actual tras el pago
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const currentSlot = this.currentFranjaSlot(franjaDuration, now);
      const franjaTime = await this.findFreeMinuteInFranja(
        booking.bookingDate,
        currentSlot,
        slotDuration,
        nowMins,
      );

      if (franjaTime) {
        await bookingRef.update({
          status: 'APPROVED',
          exactTime: franjaTime,
          timeSlot: currentSlot,
          imageUrl,
        });

        // Generar la imagen automáticamente en segundo plano
        this.generateImage(id).catch((err) =>
          console.error(`Error auto-generando imagen para ${id}:`, err),
        );

        return {
          success: true,
          exactTime: franjaTime,
          timeSlot: currentSlot,
          franjaFull: false,
        };
      }

      // Franja actual llena: el pago ya ocurrió, la reserva queda aprobada
      // pero sin hora hasta que el usuario elija otra franja (assignFranja).
      await bookingRef.update({
        status: 'APPROVED',
        exactTime: 'Sin asignar',
        timeSlot: '',
        imageUrl,
      });

      this.generateImage(id).catch((err) =>
        console.error(`Error auto-generando imagen para ${id}:`, err),
      );

      return {
        success: true,
        franjaFull: true,
        currentFranja: currentSlot,
        availableFranjas: await this.getFranjasAvailability(
          booking.bookingDate,
        ),
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
      // Ajustar zona horaria si es necesario, asumimos la hora local del servidor
      let baseTimeMins = now.getHours() * 60 + now.getMinutes();

      // Alinear los minutos base para que sean múltiplos exactos del slotDuration (ej: si es 2 min, horas como 1:30, 1:32)
      const remainder = baseTimeMins % slotDuration;
      if (remainder !== 0) {
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
            const [h, m] = d.exactTime.split(':').map(Number);
            const mins = h * 60 + m;
            if (mins > maxMins) maxMins = mins;
          }
        });

        // Next projection is slotDuration minutes after the latest one
        // or current time, whichever is later
        if (maxMins >= baseTimeMins) {
          baseTimeMins = maxMins + slotDuration;
        }
      }

      const toStr = (m: number) => {
        const h = Math.floor(m / 60) % 24;
        const min = m % 60;
        return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      };
      exactTime = toStr(baseTimeMins);
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
        const toMins = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        };
        const toStr = (m: number) =>
          `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

        const startMins = toMins(startStr);
        const endMins = toMins(endStr);

        const existing = await db
          .collection('lr_bookings')
          .where('timeSlot', '==', booking.timeSlot)
          .where('bookingDate', '==', booking.bookingDate)
          .get();

        const taken = existing.docs
          .map((d) => d.data().exactTime)
          .filter(Boolean);

        for (let m = startMins; m < endMins; m += slotDuration) {
          const tStr = toStr(m);
          const isDead = deadTimes.some(
            (dt: any) => tStr >= dt.startTime && tStr < dt.endTime,
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
      ...(bookingSystemType === 'queue' ? { queuePosition } : {}),
    });

    // Generar la imagen automáticamente en segundo plano
    this.generateImage(id).catch(err => console.error(`Error auto-generando imagen para ${id}:`, err));

    return { success: true, exactTime, queuePosition };
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
    } = data;

    let imageUrl = '';

    // Si se envía una imagen en base64, se sube a Firebase Storage
    if (imageBase64) {
      const storage = this.firebase.getStorage();
      const bucket = storage.bucket();
      const fileName = `bookings/${uuidv4()}.jpg`;
      const file = bucket.file(fileName);

      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      await file.save(buffer, {
        metadata: { contentType: 'image/jpeg' },
      });

      // Intentar hacer pública la imagen
      try {
        await file.makePublic();
        imageUrl = file.publicUrl();
      } catch (e) {
        // Fallback: generar Signed URL duradera en caso de reglas restrictivas del bucket
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: '01-01-2100',
        });
        imageUrl = url;
      }
    }

    // Guardar los datos en Firestore
    const db = this.firebase.getFirestore();

    // Calcular slot exacto (por defecto 1 minuto)
    let exactTime = 'Sin asignar';
    let slotDuration = 1;
    let queuePosition = 0;
    const finalBookingDate =
      bookingDate || new Date().toISOString().split('T')[0];

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
      let baseTimeMins = now.getHours() * 60 + now.getMinutes();

      // Alinear los minutos base para que sean múltiplos exactos del slotDuration (ej: si es 2 min, horas como 1:30, 1:32)
      const remainder = baseTimeMins % slotDuration;
      if (remainder !== 0) {
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
            const [h, m] = d.exactTime.split(':').map(Number);
            const mins = h * 60 + m;
            if (mins > maxMins) maxMins = mins;
          }
        });

        if (maxMins >= baseTimeMins) {
          baseTimeMins = maxMins + slotDuration;
        }
      }

      const toStr = (m: number) => {
        const h = Math.floor(m / 60) % 24;
        const min = m % 60;
        return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      };
      exactTime = toStr(baseTimeMins);
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
        const toMins = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        };
        const toStr = (m: number) =>
          `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

        const startMins = toMins(startStr);
        const endMins = toMins(endStr);

        const existing = await db
          .collection('lr_bookings')
          .where('timeSlot', '==', timeSlot)
          .where('bookingDate', '==', finalBookingDate)
          .get();

        const taken = existing.docs
          .map((d) => d.data().exactTime)
          .filter(Boolean);

        for (let m = startMins; m < endMins; m += slotDuration) {
          const tStr = toStr(m);
          const isDead = deadTimes.some(
            (dt: any) => tStr >= dt.startTime && tStr < dt.endTime,
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
      timeSlot:
        bookingSystemType === 'queue'
          ? ''
          : bookingSystemType === 'franjas'
            ? assignedFranjaSlot
            : timeSlot,
      exactTime,
      bookingDate: finalBookingDate,
      imageUrl,
      status: 'APPROVED', // Lo marcamos como APPROVED
      paymentMethod: data.paymentMethod || 'Wompi', // 'Wompi', 'Efectivo', 'Datáfono', 'QR'
      requiresInvoice: data.requiresInvoice || false, // boolean
      createdAt: new Date(),
      ...(bookingSystemType === 'queue' ? { queuePosition } : {}),
    };

    await bookingRef.set(booking);

    // Generar la imagen automáticamente en segundo plano
    this.generateImage(bookingRef.id).catch(err => console.error(`Error auto-generando imagen para ${bookingRef.id}:`, err));

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

    // Primero buscamos por docId
    let snapshot = await db
      .collection('lr_bookings')
      .where('docId', '==', query)
      .get();

    // Si no hay por docId, buscamos por email
    if (snapshot.empty) {
      snapshot = await db
        .collection('lr_bookings')
        .where('email', '==', query)
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

    if (!booking || !booking.selectedFilter)
      throw new NotFoundException('Filtro no asignado');

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

    // Llamar a la API externa de generación
    let generateRes;
    try {
      generateRes = await axios.post('http://localhost:8000/generate', form, {
        headers: form.getHeaders(),
        responseType: 'arraybuffer',
      });
    } catch (apiError: any) {
      if (apiError.response && apiError.response.data) {
        const errorString = Buffer.from(apiError.response.data).toString(
          'utf-8',
        );
        console.error('Error 422 de la API de imágenes:', errorString);
      } else {
        console.error('Error llamando a la API de imágenes:', apiError.message);
      }
      console.log(
        'API de generación no disponible. Se proyectará la imagen original inmediatamente.',
      );
      
      // Proyectar la imagen original inmediatamente
      await this.projectBooking(id);

      return {
        success: true,
        message:
          'Falló la generación, se proyectó la imagen original',
        generatedImageUrl: booking.imageUrl,
      };
    }

    let generatedBuffer: Buffer;
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

  async getScreenSettings() {
    const db = this.firebase.getFirestore();
    const doc = await db.collection('lr_settings').doc('screen').get();
    return doc.exists
      ? doc.data()
      : {
          backgroundUrl: '',
          headerUrl: '',
          footerUrl: '',
          carouselImages: [],
          carouselDuration: 5,
          projectionDuration: 15,
          carouselTransitionDirection: 'right',
          contentGrid: [],
          deadTimes: [], // Tiempos muertos (descansos)
          currentProjection: null,
        };
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

    let transitionEffect = 'fade';
    let frameUrl = '';

    if (b.selectedFilter) {
      const filterDoc = await db
        .collection('lr_filters')
        .doc(b.selectedFilter)
        .get();
      if (filterDoc.exists) {
        const filterData = filterDoc.data();
        if (filterData) {
          transitionEffect = filterData.transitionEffect || 'fade';
          frameUrl = filterData.frameUrl || '';
        }
      }
    }

    const projectionData = {
      id: bookingId,
      name: b.name || '',
      imageUrl: b.generatedImageUrl || b.imageUrl || '',
      timestamp: Date.now(),
      transitionEffect,
      frameUrl,
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
      const generalDoc = await db.collection('lr_settings').doc('general').get();
      const lang = generalDoc.exists ? (generalDoc.data()?.language || 'es') : 'es';

      const imageUrl = b.generatedImageUrl || b.imageUrl;
      const htmlEs = `
        <div style="font-family: sans-serif; text-align: center; color: #333; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #228be6;">¡Hola ${b.name}!</h1>
          <p>Gracias por ser parte de la experiencia <strong>Led's on Renacer</strong>.</p>
          <p>Aquí tienes el recuerdo de tu photobooth:</p>
          <img src="${imageUrl}" alt="Tu foto" style="max-width: 100%; border-radius: 12px; margin: 20px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
          <p>¡Esperamos que lo hayas disfrutado!</p>
          <br/>
          <p style="font-size: 12px; color: #999;">Galería Renacer</p>
        </div>
      `;
      const htmlEn = `
        <div style="font-family: sans-serif; text-align: center; color: #333; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #228be6;">Hello ${b.name}!</h1>
          <p>Thank you for being part of the <strong>Led's on Renacer</strong> experience.</p>
          <p>Here is your photobooth memory:</p>
          <img src="${imageUrl}" alt="Your photo" style="max-width: 100%; border-radius: 12px; margin: 20px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
          <p>We hope you enjoyed it!</p>
          <br/>
          <p style="font-size: 12px; color: #999;">Galería Renacer</p>
        </div>
      `;
      
      const html = lang === 'en' ? htmlEn : htmlEs;
      const subject = lang === 'en' ? "Your Led's on Renacer photo is ready!" : "¡Tu foto de Led's on Renacer está lista!";

      try {
        await this.emailService.sendEmail(
          b.email,
          subject,
          html,
        );
        await bookingRef.update({ emailSent: true });
      } catch (e: any) {
        console.error('Error enviando correo al cliente:', e.message);
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

    if (b.whatsapp && process.env.WHATSAPP_API_URL && !waSend) {
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

      const generalDoc = await db.collection('lr_settings').doc('general').get();
      const lang = generalDoc.exists ? (generalDoc.data()?.language || 'es') : 'es';

      for (const doc of snapshot.docs) {
        const b = doc.data();
        if (b.email) {
          const htmlEs = `
            <div style="font-family: sans-serif; text-align: center; color: #333; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #f59f00;">¡Hola ${b.name}!</h1>
              <p>Notamos que no terminaste el pago para tu experiencia <strong>Led's on Renacer</strong>.</p>
              <p>Tu foto y reserva en la franja <strong>${b.timeSlot}</strong> del <strong>${b.bookingDate}</strong> aún están guardadas.</p>
              <p>Puedes retomar tu compra contactándonos o regresando al punto de venta virtual.</p>
              <br/>
              <p style="font-size: 12px; color: #999;">Galería Renacer</p>
            </div>
          `;
          const htmlEn = `
            <div style="font-family: sans-serif; text-align: center; color: #333; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #f59f00;">Hello ${b.name}!</h1>
              <p>We noticed you didn't finish the payment for your <strong>Led's on Renacer</strong> experience.</p>
              <p>Your photo and booking for the slot <strong>${b.timeSlot}</strong> on <strong>${b.bookingDate}</strong> are still saved.</p>
              <p>You can resume your purchase by contacting us or returning to the virtual point of sale.</p>
              <br/>
              <p style="font-size: 12px; color: #999;">Galería Renacer</p>
            </div>
          `;

          const html = lang === 'en' ? htmlEn : htmlEs;
          const subject = lang === 'en' ? "Resume your Led's on Renacer booking!" : "¡Retoma tu reserva de Led's on Renacer!";

          try {
            await this.emailService.sendEmail(
              b.email,
              subject,
              html,
            );
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

  @Cron(CronExpression.EVERY_MINUTE)
  async autoProjectBookings() {
    const db = this.firebase.getFirestore();
    const now = new Date();

    // Convertir la fecha actual al formato YYYY-MM-DD local
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const targetDateStr = `${year}-${month}-${day}`;

    const nowMins = now.getHours() * 60 + now.getMinutes();

    try {
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
          const [h, m] = b.exactTime.split(':').map(Number);
          const exactMins = h * 60 + m;

          // Si ya es la hora programada para la proyección y no han pasado más de 5 minutos (margen de tolerancia)
          if (nowMins >= exactMins && nowMins < exactMins + 5) {
            console.log(
              `[Diagnostic] Auto-proyectando reserva ${doc.id} (Hora programada: ${b.exactTime}, Minuto actual: ${now.getHours()}:${now.getMinutes()})`,
            );
            await this.projectBooking(doc.id);
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

    const targetDateStr = now.toISOString().split('T')[0];
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
          const [h, m] = b.exactTime.split(':').map(Number);
          const exactMins = h * 60 + m;
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
