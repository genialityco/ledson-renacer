import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Center, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebaseAuth';

const ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-disabled': 'Este usuario está deshabilitado.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
};

export function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
      const code = (err as { code?: string } | null)?.code ?? '';
      setError(ERRORS[code] || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center style={{ minHeight: '60vh', padding: 16 }}>
      <Paper withBorder shadow="sm" p="xl" radius="md" style={{ width: '100%', maxWidth: 380 }}>
        <form onSubmit={handleSubmit}>
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
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
