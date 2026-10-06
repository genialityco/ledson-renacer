import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button, Center, Group, Loader, Stack, Text } from '@mantine/core';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, type Role } from './firebaseAuth';

// Usuario actual y su rol (undefined mientras Firebase restaura la sesión).
function useAuthUser() {
  const [state, setState] = useState<{ user: User | null; role: Role | null } | undefined>(
    undefined,
  );
  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        const claims = user ? (await user.getIdTokenResult()).claims : {};
        const role = claims.role === 'admin' || claims.role === 'vendedor' ? claims.role : null;
        setState({ user, role });
      }),
    [],
  );
  return state;
}

// Envuelve una ruta protegida: sin sesión manda a /login (y vuelve acá
// después de entrar); con sesión pero sin el rol, muestra un aviso. 'admin'
// siempre tiene acceso, igual que en el AuthGuard del backend. Se carga con
// lazy() desde App.tsx para que Firebase no entre en el bundle de las vistas
// públicas.
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const state = useAuthUser();
  const location = useLocation();

  if (!state) {
    return <Center style={{ minHeight: '60vh' }}><Loader color="blue" /></Center>;
  }
  const { user, role } = state;
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (role !== 'admin' && !(role && roles.includes(role))) {
    return (
      <Center style={{ minHeight: '60vh' }}>
        <Stack align="center" gap="sm">
          <Text fw={600}>No tienes permiso para ver esta página</Text>
          <Text size="sm" c="dimmed">Sesión iniciada como {user.email}</Text>
          <Button variant="light" onClick={() => signOut(auth)}>Cerrar sesión</Button>
        </Stack>
      </Center>
    );
  }
  return (
    <>
      <Group justify="flex-end" gap="xs" px="md" pt="xs">
        <Text size="xs" c="dimmed">{user.email}</Text>
        <Button size="compact-xs" variant="subtle" onClick={() => signOut(auth)}>Cerrar sesión</Button>
      </Group>
      {children}
    </>
  );
}
