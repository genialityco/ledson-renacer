// Asigna el rol de un usuario de Firebase Auth (custom claim `role`), que es
// lo que el backend (AuthGuard) y el frontend usan para dar acceso al panel.
//
//   npx ts-node scripts/set-user-role.ts <correo> <admin|vendedor|ninguno> [contraseña]
//
// Si el usuario no existe y se pasa una contraseña, lo crea. "ninguno" le
// quita el rol (pierde acceso). El usuario debe cerrar sesión y volver a
// entrar (o esperar hasta 1 hora) para que el cambio de rol se aplique.
// Usa la misma cuenta de servicio que el backend: FIREBASE_SERVICE_ACCOUNT_BASE64
// o el archivo sured-883e9-firebase-adminsdk.json en la raíz del backend.
import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

const [email, roleArg, password] = process.argv.slice(2);
const ROLES = ['admin', 'vendedor', 'ninguno'];

async function main() {
  if (!email || !ROLES.includes(roleArg)) {
    console.error(
      'Uso: npx ts-node scripts/set-user-role.ts <correo> <admin|vendedor|ninguno> [contraseña]',
    );
    process.exit(1);
  }

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
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const auth = admin.auth();

  let user: admin.auth.UserRecord;
  try {
    user = await auth.getUserByEmail(email);
  } catch (e: any) {
    if (e?.code !== 'auth/user-not-found') throw e;
    if (!password) {
      console.error(
        `No existe un usuario con el correo ${email}. Créalo en la consola de Firebase o pasa una contraseña como tercer argumento.`,
      );
      process.exit(1);
    }
    user = await auth.createUser({ email, password });
    console.log(`Usuario creado: ${email}`);
  }

  const role = roleArg === 'ninguno' ? null : roleArg;
  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role });
  console.log(`Rol de ${email}: ${role ?? '(ninguno)'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
