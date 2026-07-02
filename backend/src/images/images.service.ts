import { Injectable, OnModuleInit } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ImagesService implements OnModuleInit {
  constructor(private firebase: FirebaseService) {}

  async onModuleInit() {
    setTimeout(() => this.seedImages(), 2000);
  }

  async findAll(): Promise<any[]> {
    const db = this.firebase.getFirestore();
    if (!db) return [];

    try {
      // Retiramos orderBy para que Firestore no exija un índice compuesto
      // al mezclar 'where' con 'orderBy' en diferentes campos.
      const snapshot = await db
        .collection('lr_filters')
        .where('active', '==', true)
        .get();

      // Ordenamos en memoria
      const docs = snapshot.docs.map((doc) => ({
        _id: doc.id,
        ...doc.data(),
      }));

      return docs.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
    } catch (e) {
      console.error('Error fetching lr_filters:', e);
      return [];
    }
  }

  async findAllAdmin(): Promise<any[]> {
    const db = this.firebase.getFirestore();
    if (!db) return [];

    const snapshot = await db
      .collection('lr_filters')
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map((doc) => ({ _id: doc.id, ...doc.data() }));
  }

  async seedImages() {
    const db = this.firebase.getFirestore();
    if (!db) return;

    const snapshot = await db.collection('lr_filters').limit(1).get();

    if (snapshot.empty) {
      const sampleFilters = [
        {
          label: 'Estilo Botero',
          value: 'botero',
          imageUrl:
            'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?auto=format&fit=crop&q=80&w=400',
          active: true,
          createdAt: new Date(),
        },
        {
          label: 'Estilo Picasso',
          value: 'picasso',
          imageUrl:
            'https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb?auto=format&fit=crop&q=80&w=400',
          active: true,
          createdAt: new Date(),
        },
      ];

      const batch = db.batch();
      sampleFilters.forEach((img) => {
        const docRef = db.collection('lr_filters').doc();
        batch.set(docRef, img);
      });

      await batch.commit();
      console.log(
        '✅ Filtros de prueba insertados automáticamente en Firestore',
      );
    }
  }

  async createFilter(data: any) {
    const db = this.firebase.getFirestore();
    const docRef = db.collection('lr_filters').doc();
    const filterData = { ...data, active: true, createdAt: new Date() };
    await docRef.set(filterData);
    return { _id: docRef.id, ...filterData };
  }

  async updateFilter(id: string, data: any) {
    const db = this.firebase.getFirestore();
    await db.collection('lr_filters').doc(id).update(data);
    return { success: true };
  }

  async deleteFilter(id: string) {
    const db = this.firebase.getFirestore();
    await db.collection('lr_filters').doc(id).delete();
    return { success: true };
  }

  async forceSeed() {
    await this.seedImages();
    return { message: 'Seed ejecutado (o ya existían datos)' };
  }

  async uploadImageBase64(data: {
    imageBase64: string;
    folder?: string;
    contentType?: string;
    extension?: string;
  }) {
    const {
      imageBase64,
      folder = 'screen_assets',
      contentType = 'image/jpeg',
      extension = 'jpg',
    } = data;
    if (!imageBase64) throw new Error('No se proporcionó imagen');

    const storage = this.firebase.getStorage();
    const bucket = storage.bucket();
    const fileName = `${folder}/${uuidv4()}.${extension}`;
    const file = bucket.file(fileName);

    const base64Data = imageBase64.replace(/^data:(.*?);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await file.save(buffer, {
      metadata: { contentType },
    });

    let imageUrl = '';
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

    return { url: imageUrl };
  }
}
