// Configura CORS de solo lectura (GET/HEAD, cualquier origen) en el bucket de
// Firebase Storage. Sin esto el navegador no puede descargar los archivos con
// fetch() y la pantalla gigante (useCachedAsset) no logra guardar su copia
// local del videoloop, la imagen por defecto ni el video de transición: sin
// internet dejarían de verse. Los archivos ya son públicos, así que esto no
// expone nada nuevo.
//
//   npx ts-node scripts/set-storage-cors.ts
//
// Usa la misma cuenta de servicio que el backend: FIREBASE_SERVICE_ACCOUNT_BASE64
// o el archivo sured-883e9-firebase-adminsdk.json en la raíz del backend.
import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
      ? Buffer.from(
          process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
          'base64',
        ).toString('utf8')
      : readFileSync(
          join(__dirname, '..', 'sured-883e9-firebase-adminsdk.json'),
          'utf8',
        ),
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      `${serviceAccount.project_id}.firebasestorage.app`,
  });
  const bucket = admin.storage().bucket();

  const [before] = await bucket.getMetadata();
  console.log(`Bucket ${bucket.name} — CORS actual:`, JSON.stringify(before.cors ?? null));

  await bucket.setCorsConfiguration([
    {
      origin: ['*'],
      method: ['GET', 'HEAD'],
      responseHeader: ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges'],
      maxAgeSeconds: 3600,
    },
  ]);

  const [after] = await bucket.getMetadata();
  console.log('CORS nuevo:', JSON.stringify(after.cors));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
