import { useEffect, useState } from 'react';
import { Container, Title, TextInput, Button, Card, Image, Text, Badge, Group, Box, Grid } from '@mantine/core';
import { IconSearch, IconArrowLeft } from '@tabler/icons-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from './i18n';
import { API_BASE_URL } from './config';

export function UserBookingsView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language } = useLanguage();
  const [query, setQuery] = useState(searchParams.get('code') || '');
  const [bookings, setBookings] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const runSearch = async (q: string) => {
    if (!q) return;
    setLoading(true);
    setHasSearched(false);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/bookings/search/${encodeURIComponent(q)}`);
      setBookings(res.data);
    } catch (err) {
      console.error('Error buscando reservas', err);
      alert(t('searchError'));
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch(query);
  };

  // Si se llega desde el enlace del correo de confirmación (/my-bookings?code=XX-XX-XX),
  // busca automáticamente con el código ya puesto en el campo.
  useEffect(() => {
    const codeFromLink = searchParams.get('code');
    if (codeFromLink) runSearch(codeFromLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge color="orange">{t('pendingPayment')}</Badge>;
      case 'APPROVED': return <Badge color="blue">{t('confirmedInQueue')}</Badge>;
      case 'GENERATED': return <Badge color="teal">{t('imageGenerated')}</Badge>;
      case 'SHOWN': return <Badge color="indigo">{t('projected')}</Badge>;
      case 'COMPLETED': return <Badge color="grape">{t('experienceFinished')}</Badge>;
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
    let formatted = dateObj.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', options);
    
    if (language === 'es') {
      formatted = formatted.replace(',', '').replace(/,\s*/, ' a las ').replace(/\.\s*m\./, 'm');
    }
    
    return formatted;
  };

  return (
    <Container size="sm" py="xl">
      <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/')} mb="md">
        {t('backHome')}
      </Button>

      <Title order={2} ta="center" mb="md" c="blue.7">
        {t('myProjections')}
      </Title>
      <Text ta="center" c="dimmed" mb="xl">
        {t('enterIdToVerify')}
      </Text>

      <Box component="form" onSubmit={handleSearch} mb="xl">
        <Group align="flex-end">
          <TextInput
            style={{ flex: 1 }}
            label={t('idOrEmail')}
            placeholder={t('idOrEmailPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            required
          />
          <Button type="submit" leftSection={<IconSearch size={16} />} loading={loading}>
            {t('search')}
          </Button>
        </Group>
      </Box>

      {hasSearched && bookings.length === 0 && (
        <Text ta="center" c="dimmed" mt="xl">
          {t('noProjectionsFound')}
        </Text>
      )}

      {bookings.length > 0 && (
        <Grid>
          {bookings.map((booking) => (
            <Grid.Col span={{ base: 12, sm: 6 }} key={booking.id}>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Card.Section>
                  {booking.mediaType === 'video' ? (
                    <video
                      src={booking.generatedImageUrl || booking.imageUrl}
                      controls
                      style={{ width: '100%', height: 250, objectFit: 'cover', display: 'block', backgroundColor: '#000' }}
                    />
                  ) : (
                    <Image
                      src={booking.generatedImageUrl || booking.imageUrl}
                      height={250}
                      alt="Tu imagen"
                      style={{ objectFit: 'cover' }}
                    />
                  )}
                </Card.Section>

                <Group justify="space-between" mt="md" mb="xs">
                  <Text fw={500}>{booking.name}</Text>
                  {getStatusBadge(booking.status)}
                </Group>

                {booking.code && (
                  <Text size="sm" c="dimmed" mb="xs">
                    <strong>{t('bookingCodeLabel')}:</strong> {booking.code}
                  </Text>
                )}

                <Text size="sm" c="dimmed" mb="xs">
                  <strong>{t('date')}</strong> {booking.bookingDate}
                </Text>
                
                {booking.timeSlot && (
                  <Text size="sm" c="dimmed" mb="xs">
                    <strong>{t('generalSlot')}</strong> {booking.timeSlot}
                  </Text>
                )}
                
                {booking.queuePosition ? (
                  <Text size="sm" c="dimmed" mb="xs">
                    <strong>{t('queuePosition')}</strong> #{booking.queuePosition}
                  </Text>
                ) : null}
                
                <Box mt="md" p="sm" bg="blue.0" style={{ borderRadius: '8px', borderLeft: '4px solid #228be6' }}>
                  <Text size="sm" fw={700} c="blue.9">
                    {t('projectionDateTime')}
                  </Text>
                  <Title order={4} c="blue.9">
                    {booking.exactTime && booking.exactTime !== 'Sin asignar' && booking.exactTime !== 'Agotado/Lleno' 
                      ? formatDateTime(booking.bookingDate, booking.exactTime)
                      : (booking.status === 'PENDING' ? t('pendingPaymentState') : t('toCalculate'))}
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
