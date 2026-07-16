import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

const DEFAULT_PLAN_SETTINGS = {
  filtersEnabled: true,
  allowedFilterIds: [] as string[],
  price: 15000,
};

@Injectable()
export class PlansService {
  constructor(private firebase: FirebaseService) {}

  async getPlanSettings() {
    const db = this.firebase.getFirestore();
    const doc = await db.collection('lr_settings').doc('plans').get();
    if (doc.exists) {
      return { ...DEFAULT_PLAN_SETTINGS, ...doc.data() };
    }
    return DEFAULT_PLAN_SETTINGS;
  }

  async updatePlanSettings(data: any) {
    const db = this.firebase.getFirestore();
    await db
      .collection('lr_settings')
      .doc('plans')
      .set(data, { merge: true });
    return { success: true };
  }
}
