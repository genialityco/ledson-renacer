import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class BenefitsService {
  constructor(private firebase: FirebaseService) {}

  async findAll(): Promise<any[]> {
    const db = this.firebase.getFirestore();
    if (!db) return [];

    const snapshot = await db
      .collection('lr_benefits')
      .where('active', '==', true)
      .get();

    return snapshot.docs
      .map((doc) => ({ _id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
  }

  async findAllAdmin(): Promise<any[]> {
    const db = this.firebase.getFirestore();
    if (!db) return [];

    const snapshot = await db
      .collection('lr_benefits')
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map((doc) => ({ _id: doc.id, ...doc.data() }));
  }

  async create(data: any) {
    const db = this.firebase.getFirestore();
    const docRef = db.collection('lr_benefits').doc();
    const benefitData = {
      name: data.name,
      active: true,
      createdAt: new Date(),
    };
    await docRef.set(benefitData);
    return { _id: docRef.id, ...benefitData };
  }

  async update(id: string, data: any) {
    const db = this.firebase.getFirestore();
    await db.collection('lr_benefits').doc(id).update(data);
    return { success: true };
  }
}
