import { useState } from 'react';
import { Container, Title, TextInput, Button, Card, Image, Text, Badge, Group, Box, Grid } from '@mantine/core';
import { IconSearch, IconArrowLeft } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export function UserBookingsView() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [bookings, setBookings] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setHasSearched(false);
    try {
      const res = await axios.get(`http://localhost:5000/api/bookings/search/${encodeURIComponent(query)}`);
      setBookings(res.data);
    } catch (err) {
      console.error('Error buscando reservas', err);
      alert('Hubo un error al buscar tus proyecciones.');
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge color="orange">Pago Pendiente</Badge>;
      case 'APPROVED': return <Badge color="blue">Confirmada (En Cola)</Badge>;
      case 'GENERATED': return <Badge color="teal">Imagen Generada</Badge>;
      case 'SHOWN': return <Badge color="indigo">Proyectada</Badge>;
      case 'COMPLETED': return <Badge color="grape">Experiencia Finalizada</Badge>;
      default: return <Badge color="gray">{status}</Badge>;
    }
  };

  const formatDateTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return '';
    const dateObj = new Date(`${dateStr}T${timeStr}:00`);
    
    // Opciones para Intl.DateTimeFormat
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    };
    
    // Formatear la fecha en español
    let formatted = dateObj.toLocaleDateString('es-ES', options);
    
    // Ajustar el string "jue, 18 de junio de 2026, 3:20 p. m." a "jue 18 de junio de 2026 a las 3:20 pm"
    formatted = formatted.replace(',', '').replace(/,\s*/, ' a las ').replace(/\.\s*m\./, 'm');
    
    return formatted;
  };

  return (
    <Container size="sm" py="xl">
      <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/')} mb="md">
        Volver al inicio
      </Button>

      <Title order={2} ta="center" mb="md" c="blue.7">
        Mis Proyecciones
      </Title>
      <Text ta="center" c="dimmed" mb="xl">
        Ingresa tu cédula o correo electrónico para verificar tus reservas y el horario de tus proyecciones en pantalla gigante.
      </Text>

      <Box component="form" onSubmit={handleSearch} mb="xl">
        <Group align="flex-end">
          <TextInput
            style={{ flex: 1 }}
            label="Cédula o Correo Electrónico"
            placeholder="Ej: 10203040 o juan@correo.com"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            required
          />
          <Button type="submit" leftSection={<IconSearch size={16} />} loading={loading}>
            Buscar
          </Button>
        </Group>
      </Box>

      {hasSearched && bookings.length === 0 && (
        <Text ta="center" c="dimmed" mt="xl">
          No se encontraron proyecciones con ese dato.
        </Text>
      )}

      {bookings.length > 0 && (
        <Grid>
          {bookings.map((booking) => (
            <Grid.Col span={{ base: 12, sm: 6 }} key={booking.id}>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Card.Section>
                  <Image
                    src={booking.generatedImageUrl || booking.imageUrl}
                    height={250}
                    alt="Tu imagen"
                    style={{ objectFit: 'cover' }}
                  />
                </Card.Section>

                <Group justify="space-between" mt="md" mb="xs">
                  <Text fw={500}>{booking.name}</Text>
                  {getStatusBadge(booking.status)}
                </Group>

                <Text size="sm" c="dimmed" mb="xs">
                  <strong>Fecha:</strong> {booking.bookingDate}
                </Text>
                
                {booking.timeSlot && (
                  <Text size="sm" c="dimmed" mb="xs">
                    <strong>Franja General:</strong> {booking.timeSlot}
                  </Text>
                )}
                
                {booking.queuePosition ? (
                  <Text size="sm" c="dimmed" mb="xs">
                    <strong>Turno en la cola:</strong> #{booking.queuePosition}
                  </Text>
                ) : null}
                
                <Box mt="md" p="sm" bg="blue.0" style={{ borderRadius: '8px', borderLeft: '4px solid #228be6' }}>
                  <Text size="sm" fw={700} c="blue.9">
                    Fecha y hora de proyección:
                  </Text>
                  <Title order={4} c="blue.9">
                    {booking.exactTime && booking.exactTime !== 'Sin asignar' && booking.exactTime !== 'Agotado/Lleno' 
                      ? formatDateTime(booking.bookingDate, booking.exactTime)
                      : (booking.status === 'PENDING' ? 'Pendiente de pago' : 'Por calcular')}
                  </Title>
                </Box>
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      )}
    </Container>
  );
}
