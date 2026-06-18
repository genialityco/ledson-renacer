import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firestore: admin.firestore.Firestore;
  private storage: admin.storage.Storage;

  onModuleInit() {
    const serviceAccountPath = join(
      process.cwd(),
      'sured-883e9-firebase-adminsdk.json',
    );
    let serviceAccount: any;

    try {
      serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    } catch (e) {
      console.error(
        'No se pudo leer el archivo JSON de Firebase Admin SDK. Asegúrate de que existe en la raíz del backend.',
      );
      return;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // En los proyectos recientes de Firebase, el Storage usa el sufijo .firebasestorage.app
        storageBucket:
          process.env.FIREBASE_STORAGE_BUCKET ||
          `${serviceAccount.project_id}.firebasestorage.app`,
      });
    }

    this.firestore = admin.firestore();
    this.storage = admin.storage();
    console.log('✅ Firebase Admin SDK inicializado');
  }

  getFirestore() {
    return this.firestore;
  }

  getStorage() {
    return this.storage;
  }
}
