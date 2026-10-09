import { useState } from 'react';
import { Badge, Button, Group, Modal, PasswordInput, SegmentedControl, Select, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import axios from 'axios';
import { sendPasswordResetEmail } from 'firebase/auth';
import { API_BASE_URL } from './config';
import { auth } from './firebaseAuth';

// Pestaña "Vendedores" del panel. Cada vendedor puede tener una cuenta de
// acceso vinculada (Firebase Auth, la misma que se ve en "Usuarios"): con ella
// entra a la Reserva Asistida y las ventas quedan a su nombre sin elegirlo a
// mano. La cuenta se puede crear desde acá o elegir una que ya exista.

export interface Seller {
  _id: string;
  name: string;
  active: boolean;
  uid: string | null;
  // null si no tiene cuenta, o si la cuenta vinculada ya no existe.
  account: { email: string; role: string | null; disabled: boolean } | null;
}

interface PanelUser {
  uid: string;
  email: string;
  role: 'admin' | 'vendedor' | null;
  disabled: boolean;
  seller: { id: string; name: string } | null;
}

type AccountMode = 'none' | 'existing' | 'new';

interface SellerForm {
  _id: string | null;
  name: string;
  mode: AccountMode;
  uid: string | null;
  email: string;
  password: string;
}

const EMPTY_FORM: SellerForm = { _id: null, name: '', mode: 'new', uid: null, email: '', password: '' };

const apiError = (err: unknown, fallback: string) => {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' ? message : fallback;
};

const accountCell = (s: Seller) => {
  if (!s.uid) return <Text size="sm" c="dimmed">Sin cuenta</Text>;
  if (!s.account) return <Badge color="orange" variant="light">Cuenta eliminada</Badge>;
  return (
    <Group gap={6}>
      <Text size="sm">{s.account.email}</Text>
      {s.account.role === 'admin' && <Badge size="xs" color="indigo">Admin</Badge>}
      {s.account.disabled && <Badge size="xs" color="red">Desactivada</Badge>}
    </Group>
  );
};

export function SellersAdmin({ sellers, onChanged }: { sellers: Seller[]; onChanged: () => void }) {
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<SellerForm>(EMPTY_FORM);
  const [users, setUsers] = useState<PanelUser[]>([]);
  const [saving, setSaving] = useState(false);

  // Las cuentas se cargan al abrir el modal para que la lista esté al día
  // con lo que se haya cambiado en la pestaña "Usuarios".
  const loadUsers = () =>
    axios
      .get(`${API_BASE_URL}/api/users`)
      .then((res) => setUsers(res.data))
      .catch(() => setUsers([]));

  const openCreate = () => {
    setForm(EMPTY_FORM);
    loadUsers();
    open();
  };

  const openEdit = (s: Seller) => {
    setForm({ ...EMPTY_FORM, _id: s._id, name: s.name, mode: s.uid ? 'existing' : 'none', uid: s.uid });
    loadUsers();
    open();
  };

  // Cuentas libres + la que ya tiene este vendedor (una cuenta por vendedor).
  const accountOptions = users
    .filter((u) => !u.seller || u.seller.id === form._id)
    .map((u) => ({
      value: u.uid,
      label: `${u.email}${u.role === 'admin' ? ' (admin)' : ''}${u.disabled ? ' — desactivada' : ''}`,
    }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Escribe el nombre del vendedor.');
      return;
    }
    if (form.mode === 'existing' && !form.uid) {
      alert('Elige la cuenta a vincular.');
      return;
    }
    if (form.mode === 'new' && !form.email.trim()) {
      alert('Escribe el correo de la cuenta nueva.');
      return;
    }
    if (form.mode === 'new' && form.password && form.password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setSaving(true);
    let uid = form.mode === 'existing' ? form.uid : null;
    let notice = '';
    try {
      if (form.mode === 'new') {
        const res = await axios.post(`${API_BASE_URL}/api/users`, {
          email: form.email,
          role: 'vendedor',
          password: form.password || undefined,
        });
        uid = res.data.uid;
        if (form.password) {
          notice = `Cuenta creada: ${res.data.email} con la contraseña que escribiste.`;
        } else {
          try {
            await sendPasswordResetEmail(auth, res.data.email);
            notice = `Cuenta creada. Se envió un correo a ${res.data.email} para que cree su contraseña.`;
          } catch {
            notice =
              'Cuenta creada, pero no se pudo enviar el correo para crear la contraseña. Usa «Enviar enlace de contraseña» en la pestaña Usuarios.';
          }
        }
      }
    } catch (err) {
      alert(apiError(err, 'No se pudo crear la cuenta.'));
      setSaving(false);
      return;
    }

    try {
      const data = { name: form.name, uid };
      if (form._id) {
        await axios.put(`${API_BASE_URL}/api/sellers/${form._id}`, data);
      } else {
        await axios.post(`${API_BASE_URL}/api/sellers`, data);
      }
      if (notice) alert(notice);
      close();
      onChanged();
    } catch (err) {
      const message = apiError(err, 'No se pudo guardar el vendedor.');
      // Si la cuenta ya se creó, que no la vuelvan a crear: queda en
      // «Cuenta existente» lista para vincular.
      if (form.mode === 'new' && uid) {
        alert(`${notice}\n\nPero el vendedor no se guardó: ${message}\nVuelve a intentarlo; la cuenta ya quedó seleccionada.`);
        setForm({ ...form, mode: 'existing', uid, password: '' });
        loadUsers();
      } else {
        alert(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (s: Seller) => {
    try {
      await axios.put(`${API_BASE_URL}/api/sellers/${s._id}`, { active: !s.active });
      // Ofrece llevar la cuenta al mismo estado. Solo cuentas de vendedor: a
      // un admin vinculado no se le quita el acceso al panel desde acá.
      const acc = s.account;
      // s.active es el estado anterior: al desactivar, la cuenta debería
      // quedar disabled = true.
      if (s.uid && acc?.role === 'vendedor' && acc.disabled !== s.active) {
        const question = s.active
          ? `¿También desactivar la cuenta ${acc.email}? Se cerrará su sesión y no podrá entrar a la Reserva Asistida.`
          : `¿También reactivar la cuenta ${acc.email}? Podrá volver a iniciar sesión.`;
        if (confirm(question)) {
          await axios.put(`${API_BASE_URL}/api/users/${s.uid}`, { disabled: s.active });
        }
      }
    } catch (err) {
      alert(apiError(err, 'No se pudo cambiar el estado.'));
    }
    onChanged();
  };

  return (
    <>
      <Group justify="space-between" mb="xs">
        <Text fw={500}>Vendedores</Text>
        <Button onClick={openCreate}>+ Añadir Vendedor</Button>
      </Group>
      <Text size="xs" c="dimmed" mb="md">
        Personas que atienden el stand. Con una cuenta de acceso vinculada, el vendedor entra a la Reserva Asistida con su
        correo y contraseña, y sus ventas quedan a su nombre automáticamente. Desactivar un vendedor lo oculta sin borrar
        su historial.
      </Text>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>Cuenta de acceso</Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th>Acciones</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sellers.map((s) => (
            <Table.Tr key={s._id}>
              <Table.Td>{s.name}</Table.Td>
              <Table.Td>{accountCell(s)}</Table.Td>
              <Table.Td>
                <Badge color={s.active ? 'green' : 'red'}>{s.active ? 'Activo' : 'Inactivo'}</Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Button size="xs" color="blue" variant="subtle" onClick={() => openEdit(s)}>Editar</Button>
                  <Button size="xs" variant="light" color={s.active ? 'red' : 'green'} onClick={() => handleToggleStatus(s)}>
                    {s.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={close} title={form._id ? 'Editar Vendedor' : 'Añadir Nuevo Vendedor'}>
        <TextInput
          label="Nombre del vendedor"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
          mb="md"
        />
        <Text size="sm" fw={500} mb={4}>Cuenta de acceso</Text>
        <SegmentedControl
          fullWidth
          value={form.mode}
          onChange={(mode) => setForm({ ...form, mode: mode as AccountMode })}
          data={[
            { value: 'new', label: 'Crear nueva' },
            { value: 'existing', label: 'Cuenta existente' },
            { value: 'none', label: 'Sin cuenta' },
          ]}
          mb="md"
        />
        {form.mode === 'new' && (
          <>
            <TextInput
              type="email"
              label="Correo"
              description="Con este correo inicia sesión en la Reserva Asistida."
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
              mb="sm"
            />
            <PasswordInput
              label="Contraseña (opcional)"
              description="Mínimo 6 caracteres. Si la dejas vacía, le llega un correo para que cree la suya."
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
              mb="md"
            />
          </>
        )}
        {form.mode === 'existing' && (
          <Select
            label="Cuenta"
            placeholder={accountOptions.length ? 'Elige una cuenta' : 'No hay cuentas libres'}
            description="Cuentas de la pestaña «Usuarios» que no están vinculadas a otro vendedor."
            data={accountOptions}
            value={form.uid}
            onChange={(uid) => setForm({ ...form, uid })}
            searchable
            mb="md"
          />
        )}
        {form.mode === 'none' && (
          <Text size="xs" c="dimmed" mb="md">
            Solo aparecerá en la lista «Vendedor» del formulario del stand; no podrá iniciar sesión.
            {sellers.find((s) => s._id === form._id)?.uid &&
              ' La cuenta que tenía vinculada no se borra: sigue en la pestaña «Usuarios» y puedes desactivarla allí.'}
          </Text>
        )}
        <Button fullWidth onClick={handleSave} loading={saving}>Guardar Vendedor</Button>
      </Modal>
    </>
  );
}
