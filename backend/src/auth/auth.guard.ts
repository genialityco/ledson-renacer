import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { createHash, timingSafeEqual } from 'crypto';
import { FirebaseService } from '../firebase/firebase.service';
import { ROLES_KEY, Role } from './roles.decorator';

// Request de un endpoint con @Roles autenticado con Firebase: el guard deja
// acá el token verificado (uid, email, role) para que el controlador sepa
// quién hace la acción. No existe cuando entró la pantalla con su llave.
export type AuthedRequest = Request & { user?: DecodedIdToken };

const sameSecret = (a: string, b: string): boolean =>
  timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );

// Guard global (registrado como APP_GUARD en AppModule). Solo actúa sobre los
// endpoints marcados con @Roles(...): verifica el ID token de Firebase Auth
// que manda el frontend en "Authorization: Bearer <token>" y su custom claim
// `role`, o el header X-Screen-Key para la pantalla gigante.
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly screenKey = process.env.SCREEN_KEY;

  constructor(
    private readonly reflector: Reflector,
    private readonly firebase: FirebaseService,
  ) {
    if (!this.screenKey) {
      this.logger.error(
        'Falta SCREEN_KEY en .env: la pantalla gigante no podrá completar proyecciones (/complete) hasta que se defina.',
      );
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();

    if (roles.includes('screen') && this.screenKey) {
      const key = req.header('x-screen-key');
      if (key && sameSecret(key, this.screenKey)) return true;
    }

    const header = req.header('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('Debes iniciar sesión');

    const auth = this.firebase.getAuth();
    if (!auth) {
      this.logger.error(
        'No se puede verificar la sesión: Firebase Admin no está inicializado',
      );
      throw new UnauthorizedException('No se pudo verificar la sesión');
    }

    // checkRevoked = true: rechaza también tokens de usuarios desactivados o
    // cuyas sesiones se revocaron (al cambiarles el rol desde la pestaña
    // Usuarios), en vez de seguir aceptándolos hasta que expiren (1 hora).
    let decoded: DecodedIdToken;
    try {
      decoded = await auth.verifyIdToken(token, true);
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    const role: unknown = decoded.role;
    if (role === 'admin' || roles.includes(role as Role)) {
      req.user = decoded;
      return true;
    }
    throw new ForbiddenException('No tienes permiso para esta acción');
  }
}
