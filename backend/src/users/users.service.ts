import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { UserRecord } from 'firebase-admin/auth';
import { FirebaseService } from '../firebase/firebase.service';

const ROLES = ['admin', 'vendedor'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UserUpdate {
  email?: string;
  role?: string;
  disabled?: boolean;
}

// Gestión de las cuentas del panel (Firebase Auth) desde la pestaña
// "Usuarios" del admin, para no depender de la consola de Firebase ni de
// scripts/set-user-role.ts. Las contraseñas nunca pasan por acá: al crear un
// usuario se le pone una aleatoria y el frontend le envía el correo de
// Firebase para que cree la suya.
@Injectable()
export class UsersService {
  constructor(private firebase: FirebaseService) {}

  private get auth() {
    const auth = this.firebase.getAuth();
    if (!auth) {
      throw new ServiceUnavailableException(
        'Firebase Admin no está inicializado',
      );
    }
    return auth;
  }

  private toDto(u: UserRecord) {
    return {
      uid: u.uid,
      email: u.email ?? '',
      role: (u.customClaims?.role as string | undefined) ?? null,
      disabled: u.disabled,
      createdAt: u.metadata.creationTime,
      lastSignInAt: u.metadata.lastSignInTime ?? null,
    };
  }

  private normalizeEmail(email: unknown): string {
    const value = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(value)) {
      throw new BadRequestException('El correo no es válido');
    }
    return value;
  }

  private checkRole(role: unknown): string {
    if (typeof role !== 'string' || !ROLES.includes(role)) {
      throw new BadRequestException('El rol debe ser admin o vendedor');
    }
    return role;
  }

  async findAll() {
    const users: UserRecord[] = [];
    let pageToken: string | undefined;
    do {
      const page = await this.auth.listUsers(1000, pageToken);
      // Solo cuentas con correo: el proyecto de Firebase es compartido y
      // tiene cientos de usuarios anónimos de otra app, que no pueden
      // iniciar sesión en el panel.
      users.push(...page.users.filter((u) => u.email));
      pageToken = page.pageToken;
    } while (pageToken);
    return users
      .map((u) => this.toDto(u))
      .sort((a, b) => a.email.localeCompare(b.email));
  }

  async create(data: { email?: unknown; role?: unknown }) {
    const email = this.normalizeEmail(data.email);
    const role = this.checkRole(data.role);
    let user: UserRecord;
    try {
      user = await this.auth.createUser({
        email,
        password: randomBytes(24).toString('base64url'),
      });
    } catch (e: any) {
      if (e?.code === 'auth/email-already-exists') {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }
      throw e;
    }
    await this.auth.setCustomUserClaims(user.uid, { role });
    return this.toDto(await this.auth.getUser(user.uid));
  }

  async update(uid: string, data: UserUpdate, currentUid: string) {
    let user: UserRecord;
    try {
      user = await this.auth.getUser(uid);
    } catch {
      throw new NotFoundException('Usuario no encontrado');
    }

    const role =
      data.role === undefined ? undefined : this.checkRole(data.role);
    // Un admin no puede quitarse a sí mismo el acceso: así el panel nunca
    // queda sin al menos un administrador.
    if (uid === currentUid && (role === 'vendedor' || data.disabled === true)) {
      throw new BadRequestException(
        'No puedes quitarte el rol de administrador ni desactivar tu propia cuenta',
      );
    }

    const changes: { email?: string; disabled?: boolean } = {};
    if (data.email !== undefined) {
      const email = this.normalizeEmail(data.email);
      if (email !== user.email) changes.email = email;
    }
    if (typeof data.disabled === 'boolean') changes.disabled = data.disabled;
    if (Object.keys(changes).length) {
      try {
        await this.auth.updateUser(uid, changes);
      } catch (e: any) {
        if (e?.code === 'auth/email-already-exists') {
          throw new ConflictException('Ya existe un usuario con ese correo');
        }
        throw e;
      }
    }

    const roleChanged = role !== undefined && role !== user.customClaims?.role;
    if (roleChanged) {
      await this.auth.setCustomUserClaims(uid, {
        ...user.customClaims,
        role,
      });
    }
    // Cierra las sesiones abiertas para que el cambio de rol o la
    // desactivación apliquen ya (el AuthGuard verifica tokens revocados).
    if (roleChanged || changes.disabled === true) {
      await this.auth.revokeRefreshTokens(uid);
    }

    return this.toDto(await this.auth.getUser(uid));
  }
}
