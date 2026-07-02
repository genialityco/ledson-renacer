import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class SchedulesService {
  constructor(private firebase: FirebaseService) {}

  async getTemplates() {
    const db = this.firebase.getFirestore();
    const snapshot = await db.collection('lr_slot_templates').get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async getScheduleSettings() {
    const db = this.firebase.getFirestore();
    const doc = await db.collection('lr_settings').doc('schedules').get();
    if (doc.exists) {
      return doc.data();
    }
    return { slotDuration: 1 };
  }

  async updateScheduleSettings(data: any) {
    const db = this.firebase.getFirestore();
    await db
      .collection('lr_settings')
      .doc('schedules')
      .set(data, { merge: true });
    return { success: true };
  }

  async saveTemplate(data: any) {
    const db = this.firebase.getFirestore();
    if (data.id) {
      const { id, ...updateData } = data;
      await db
        .collection('lr_slot_templates')
        .doc(id)
        .set(updateData, { merge: true });
      return { id, ...updateData };
    } else {
      const ref = await db.collection('lr_slot_templates').add(data);
      return { id: ref.id, ...data };
    }
  }

  async deleteTemplate(id: string) {
    const db = this.firebase.getFirestore();
    await db.collection('lr_slot_templates').doc(id).delete();
    return { success: true };
  }

  async getScheduleForDate(dateStr: string) {
    // dateStr format: YYYY-MM-DD
    const db = this.firebase.getFirestore();
    const doc = await db.collection('lr_daily_schedules').doc(dateStr).get();
    if (doc.exists) {
      return doc.data();
    }
    return { slots: [], deadTimes: [] };
  }

  async saveScheduleForDate(dateStr: string, data: any) {
    const db = this.firebase.getFirestore();
    await db
      .collection('lr_daily_schedules')
      .doc(dateStr)
      .set(data, { merge: true });
    return { success: true };
  }

  async applyTemplateToDates(templateId: string, dates: string[]) {
    const db = this.firebase.getFirestore();
    const tplDoc = await db
      .collection('lr_slot_templates')
      .doc(templateId)
      .get();
    if (!tplDoc.exists) throw new Error('Template not found');
    const tpl = tplDoc.data();
    if (!tpl) throw new Error('Template is empty');

    const batch = db.batch();
    for (const dateStr of dates) {
      const ref = db.collection('lr_daily_schedules').doc(dateStr);
      batch.set(
        ref,
        { slots: tpl.slots || [], deadTimes: tpl.deadTimes || [] },
        { merge: true },
      );
    }
    await batch.commit();
    return { success: true };
  }
}
