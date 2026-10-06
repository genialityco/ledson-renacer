import { SetMetadata } from '@nestjs/common';

// 'admin' y 'vendedor' son custom claims de Firebase Auth (ver
// scripts/set-user-role.ts). 'screen' es la pantalla gigante, que no inicia
// sesión: se autentica con el header X-Screen-Key = SCREEN_KEY del .env.
export type Role = 'admin' | 'vendedor' | 'screen';

export const ROLES_KEY = 'roles';

// Restringe un endpoint a estos roles; 'admin' siempre pasa. Los endpoints
// SIN @Roles quedan públicos (flujo del cliente, pagos, pantalla, etc.), así
// que un endpoint nuevo del panel de admin debe llevar @Roles('admin').
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
