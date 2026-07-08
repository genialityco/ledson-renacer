import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firestore: admin.firestore.Firestore;
  private storage: admin.storage.Storage;

  onModuleInit() {
    let serviceAccount: any;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      try {
        serviceAccount = JSON.parse(
          Buffer.from(
            process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
            'base64',
          ).toString('utf8'),
        );
      } catch (e) {
        console.error(
          'No se pudo parsear FIREBASE_SERVICE_ACCOUNT_BASE64. Verifica que sea el JSON del service account codificado en base64.',
        );
        return;
      }
    } else {
      const serviceAccountPath = join(
        process.cwd(),
        'sured-883e9-firebase-adminsdk.json',
      );
      try {
        serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      } catch (e) {
        console.error(
          'No se pudo leer el archivo JSON de Firebase Admin SDK. Asegúrate de que existe en la raíz del backend, o define FIREBASE_SERVICE_ACCOUNT_BASE64.',
        );
        return;
      }
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
