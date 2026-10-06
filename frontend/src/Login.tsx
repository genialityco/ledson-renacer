import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Anchor, Button, Center, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebaseAuth';

const ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-disabled': 'Este usuario está deshabilitado.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
};

const errorMessage = (err: unknown, fallback: string) =>
  ERRORS[(err as { code?: string } | null)?.code ?? ''] || fallback;

export function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // 'reset' = formulario de "¿Olvidaste tu contraseña?"
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (next: 'login' | 'reset') => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
      const next = params.get('next');
      // Solo rutas internas, para que ?next= no pueda redirigir a otro sitio.
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        navigate(next, { replace: true });
        return;
      }
      const { claims } = await user.getIdTokenResult();
      navigate(claims.role === 'vendedor' ? '/assisted-booking' : '/admin', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'No se pudo iniciar sesión.'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      // Mismo mensaje exista o no la cuenta, para no revelar qué correos
      // están registrados.
      setInfo(
        `Si ${email.trim()} tiene una cuenta, recibirá un correo con un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.`,
      );
    } catch (err) {
      setError(errorMessage(err, 'No se pudo enviar el correo. Inténtalo de nuevo.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center style={{ minHeight: '60vh', padding: 16 }}>
      <Paper withBorder shadow="sm" p="xl" radius="md" style={{ width: '100%', maxWidth: 380 }}>
        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <Stack>
              <Title order={3} style={{ color: '#0559A5' }}>Iniciar sesión</Title>
              {error && <Alert color="red">{error}</Alert>}
              <TextInput
                type="email"
                label="Correo electrónico"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
              <PasswordInput
                label="Contraseña"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
              <Button type="submit" loading={loading} fullWidth>Entrar</Button>
              <Anchor component="button" type="button" size="sm" onClick={() => switchMode('reset')}>
                ¿Olvidaste tu contraseña?
              </Anchor>
            </Stack>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <Stack>
              <Title order={3} style={{ color: '#0559A5' }}>Recuperar contraseña</Title>
              <Text size="sm" c="dimmed">
                Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.
              </Text>
              {error && <Alert color="red">{error}</Alert>}
              {info && <Alert color="green">{info}</Alert>}
              <TextInput
                type="email"
                label="Correo electrónico"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
              <Button type="submit" loading={loading} fullWidth>Enviar enlace</Button>
              <Anchor component="button" type="button" size="sm" onClick={() => switchMode('login')}>
                Volver a iniciar sesión
              </Anchor>
            </Stack>
          </form>
        )}
      </Paper>
    </Center>
  );
}
