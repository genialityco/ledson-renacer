import { useEffect, useState } from 'react';
import { Badge, Button, Group, Loader, Modal, Select, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import axios from 'axios';
import { sendPasswordResetEmail } from 'firebase/auth';
import { API_BASE_URL } from './config';
import { auth } from './firebaseAuth';

// Pestaña "Usuarios" del panel: cuentas que pueden entrar al admin o a la
// Reserva Asistida (Firebase Auth, ver backend/src/users). Pensada para que
// la maneje alguien sin conocimientos técnicos: las contraseñas nunca se ven
// acá — Firebase le envía al usuario un correo para que cree la suya.

interface PanelUser {
  uid: string;
  email: string;
  role: 'admin' | 'vendedor' | null;
  disabled: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

const ROLE_OPTIONS = [
  { value: 'vendedor', label: 'Vendedor (solo Reserva Asistida)' },
  { value: 'admin', label: 'Administrador (todo el panel)' },
];

const roleBadge = (role: PanelUser['role']) =>
  role === 'admin' ? (
    <Badge color="indigo">Administrador</Badge>
  ) : role === 'vendedor' ? (
    <Badge color="blue">Vendedor</Badge>
  ) : (
    <Badge color="gray">Sin rol</Badge>
  );

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Nunca';

const apiError = (err: unknown, fallback: string) => {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' ? message : fallback;
};

const sendPasswordLink = (email: string) => sendPasswordResetEmail(auth, email);

export function UsersAdmin() {
  const [users, setUsers] = useState<PanelUser[] | null>(null);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  // uid null = usuario nuevo
  const [form, setForm] = useState<{ uid: string | null; email: string; role: string | null }>({
    uid: null,
    email: '',
    role: 'vendedor',
  });
  const [saving, setSaving] = useState(false);
  const currentUid = auth.currentUser?.uid;

  // Se incrementa para volver a cargar la lista después de un cambio.
  const [reloadKey, setReloadKey] = useState(0);
  const fetchUsers = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/users`)
      .then((res) => setUsers(res.data))
      .catch((err) => {
        alert(apiError(err, 'No se pudo cargar la lista de usuarios.'));
        setUsers([]);
      });
  }, [reloadKey]);

  const openCreate = () => {
    setForm({ uid: null, email: '', role: 'vendedor' });
    openModal();
  };

  const openEdit = (u: PanelUser) => {
    setForm({ uid: u.uid, email: u.email, role: u.role });
    openModal();
  };

  const handleSave = async () => {
    if (!form.email.trim() || !form.role) {
      alert('Completa el correo y el rol.');
      return;
    }
    setSaving(true);
    try {
      if (form.uid) {
        await axios.put(`${API_BASE_URL}/api/users/${form.uid}`, { email: form.email, role: form.role });
        alert('Usuario actualizado.');
      } else {
        const res = await axios.post(`${API_BASE_URL}/api/users`, { email: form.email, role: form.role });
        try {
          await sendPasswordLink(res.data.email);
          alert(`Usuario creado. Se envió un correo a ${res.data.email} para que cree su contraseña.`);
        } catch {
          alert(
            `Usuario creado, pero no se pudo enviar el correo para crear la contraseña. Usa el botón "Enviar enlace de contraseña" en la lista.`,
          );
        }
      }
      closeModal();
      fetchUsers();
    } catch (err) {
      alert(apiError(err, 'No se pudo guardar el usuario.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSendLink = async (u: PanelUser) => {
    if (!confirm(`¿Enviar a ${u.email} un correo para crear una contraseña nueva?`)) return;
    try {
      await sendPasswordLink(u.email);
      alert(`Correo enviado a ${u.email}. Si no lo ve, que revise la carpeta de spam.`);
    } catch {
      alert('No se pudo enviar el correo. Inténtalo de nuevo en unos minutos.');
    }
  };

  const handleToggleDisabled = async (u: PanelUser) => {
    const question = u.disabled
      ? `¿Reactivar la cuenta de ${u.email}? Podrá volver a iniciar sesión.`
      : `¿Desactivar la cuenta de ${u.email}? Se cerrará su sesión y no podrá volver a entrar hasta que la reactives.`;
    if (!confirm(question)) return;
    try {
      await axios.put(`${API_BASE_URL}/api/users/${u.uid}`, { disabled: !u.disabled });
      fetchUsers();
    } catch (err) {
      alert(apiError(err, 'No se pudo cambiar el estado del usuario.'));
    }
  };

  const isSelf = form.uid !== null && form.uid === currentUid;

  return (
    <>
      <Group justify="space-between" mb="xs">
        <Text fw={500}>Usuarios del panel</Text>
        <Button onClick={openCreate}>+ Añadir Usuario</Button>
      </Group>
      <Text size="xs" c="dimmed" mb="md">
        Personas que pueden iniciar sesión. Los administradores ven todo el panel; los vendedores solo la Reserva
        Asistida. Si alguien olvidó su contraseña, usa «Enviar enlace de contraseña» (o puede hacerlo desde
        «¿Olvidaste tu contraseña?» en la pantalla de inicio de sesión). Para quitarle el acceso a alguien, desactiva
        su cuenta.
      </Text>

      {users === null ? (
        <Loader color="blue" />
      ) : (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Correo</Table.Th>
              <Table.Th>Rol</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th>Último acceso</Table.Th>
              <Table.Th>Acciones</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.map((u) => {
              const self = u.uid === currentUid;
              return (
                <Table.Tr key={u.uid}>
                  <Table.Td>
                    {u.email}
                    {self && <Text span size="xs" c="dimmed"> (tú)</Text>}
                  </Table.Td>
                  <Table.Td>{roleBadge(u.role)}</Table.Td>
                  <Table.Td>
                    <Badge color={u.disabled ? 'red' : 'green'}>{u.disabled ? 'Desactivado' : 'Activo'}</Badge>
                  </Table.Td>
                  <Table.Td>{formatDate(u.lastSignInAt)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" variant="subtle" onClick={() => openEdit(u)}>Editar</Button>
                      <Button size="xs" variant="subtle" onClick={() => handleSendLink(u)} disabled={u.disabled}>
                        Enviar enlace de contraseña
                      </Button>
                      {!self && (
                        <Button
                          size="xs"
                          variant="light"
                          color={u.disabled ? 'green' : 'red'}
                          onClick={() => handleToggleDisabled(u)}
                        >
                          {u.disabled ? 'Activar' : 'Desactivar'}
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={modalOpened} onClose={closeModal} title={form.uid ? 'Editar Usuario' : 'Añadir Nuevo Usuario'}>
        <TextInput
          type="email"
          label="Correo electrónico"
          description={form.uid ? 'Con este correo inicia sesión.' : 'Le llegará un correo para que cree su contraseña.'}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
          mb="md"
        />
        <Select
          label="Rol"
          data={ROLE_OPTIONS}
          value={form.role}
          onChange={(role) => setForm({ ...form, role })}
          disabled={isSelf}
          description={isSelf ? 'No puedes cambiar tu propio rol.' : undefined}
          mb="md"
        />
        <Button fullWidth onClick={handleSave} loading={saving}>
          {form.uid ? 'Guardar Cambios' : 'Crear Usuario'}
        </Button>
      </Modal>
    </>
  );
}
