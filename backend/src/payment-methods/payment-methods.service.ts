import { Injectable, OnModuleInit } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

const DEFAULT_PAYMENT_METHODS = [
  'Efectivo USD',
  'Efectivo COP',
  'QR Bancolombia',
  'Datáfono',
  'Link Wompi',
];

@Injectable()
export class PaymentMethodsService implements OnModuleInit {
  constructor(private firebase: FirebaseService) {}

  async onModuleInit() {
    setTimeout(() => this.seedDefaults(), 2000);
  }

  async seedDefaults() {
    const db = this.firebase.getFirestore();
    if (!db) return;

    const snapshot = await db.collection('lr_payment_methods').limit(1).get();
    if (!snapshot.empty) return;

    const batch = db.batch();
    DEFAULT_PAYMENT_METHODS.forEach((name) => {
      const docRef = db.collection('lr_payment_methods').doc();
      batch.set(docRef, { name, active: true, createdAt: new Date() });
    });
    await batch.commit();
  }

  async findAll(): Promise<any[]> {
    const db = this.firebase.getFirestore();
    if (!db) return [];

    const snapshot = await db
      .collection('lr_payment_methods')
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
      .collection('lr_payment_methods')
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map((doc) => ({ _id: doc.id, ...doc.data() }));
  }

  async create(data: any) {
    const db = this.firebase.getFirestore();
    const docRef = db.collection('lr_payment_methods').doc();
    const methodData = { name: data.name, active: true, createdAt: new Date() };
    await docRef.set(methodData);
    return { _id: docRef.id, ...methodData };
  }

  async update(id: string, data: any) {
    const db = this.firebase.getFirestore();
    await db.collection('lr_payment_methods').doc(id).update(data);
    return { success: true };
  }
}
