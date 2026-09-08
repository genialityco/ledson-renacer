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
      const planDoc = await db.collection('lr_settings').doc('plans').get();
      const planSettings = planDoc.exists ? planDoc.data() : null;
      if (planSettings?.filtersEnabled === false) return [];
      const allowedFilterIds: string[] = planSettings?.allowedFilterIds || [];

      // Retiramos orderBy para que Firestore no exija un índice compuesto
      // al mezclar 'where' con 'orderBy' en diferentes campos.
      const snapshot = await db
        .collection('lr_filters')
        .where('active', '==', true)
        .get();

      // Ordenamos en memoria
      let docs = snapshot.docs.map((doc) => ({
        _id: doc.id,
        ...doc.data(),
      }));

      if (allowedFilterIds.length > 0) {
        docs = docs.filter((d: any) => allowedFilterIds.includes(d._id));
      }

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
          description:
            'Formas voluminosas y colores cálidos inspirados en el maestro colombiano.',
          value: 'botero',
          imageUrl:
            'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?auto=format&fit=crop&q=80&w=400',
          active: true,
          createdAt: new Date(),
        },
        {
          label: 'Estilo Picasso',
          description: 'Formas geométricas y cubismo aplicados a tu retrato.',
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

    const base64Data = imageBase64.replace(/^data:(.*?);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = `${folder}/${uuidv4()}.${extension}`;

    const imageUrl = await this.saveBufferToStorage(
      buffer,
      fileName,
      contentType,
    );
    return { url: imageUrl };
  }

  // Subida real multipart (en vez de base64+JSON): evita que un video pesado
  // (hasta 300MB) reviente el JSON.stringify del navegador ("allocation size
  // overflow") y el límite de body JSON del backend. Usada por la carga de
  // media de la pantalla de reposo/parrilla en el admin.
  async uploadImageFile(
    file: { buffer: Buffer; originalname?: string; mimetype?: string },
    folder = 'screen_assets',
  ) {
    if (!file?.buffer) throw new Error('No se proporcionó archivo');

    const extension = (
      file.originalname?.split('.').pop() || 'bin'
    ).toLowerCase();
    const contentType = file.mimetype || 'application/octet-stream';
    const fileName = `${folder}/${uuidv4()}.${extension}`;

    const imageUrl = await this.saveBufferToStorage(
      file.buffer,
      fileName,
      contentType,
    );
    return { url: imageUrl };
  }

  private async saveBufferToStorage(
    buffer: Buffer,
    fileName: string,
    contentType: string,
  ) {
    const storage = this.firebase.getStorage();
    const bucket = storage.bucket();
    const file = bucket.file(fileName);

    await file.save(buffer, {
      metadata: { contentType },
    });

    try {
      await file.makePublic();
      return file.publicUrl();
    } catch (e) {
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '01-01-2100',
      });
      return url;
    }
  }
}
