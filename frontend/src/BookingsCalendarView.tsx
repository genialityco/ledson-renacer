import { useState, useEffect } from 'react';
import { Container, Title, Box, Button, Modal, Text, Group, Badge } from '@mantine/core';
import { IconArrowLeft, IconZoomIn, IconZoomOut } from '@tabler/icons-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';

moment.locale('es');
const localizer = momentLocalizer(moment);

export function BookingsCalendarView() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>('week');
  const [modalOpened, setModalOpened] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [zoom, setZoom] = useState(1);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'orange';
      case 'APPROVED': return 'blue';
      case 'GENERATED': return 'teal';
      case 'SHOWN': return 'indigo';
      case 'COMPLETED': return 'grape';
      default: return 'gray';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Pago Pendiente';
      case 'APPROVED': return 'Confirmada (En Cola)';
      case 'GENERATED': return 'Imagen Generada';
      case 'SHOWN': return 'Proyectada';
      case 'COMPLETED': return 'Experiencia Finalizada';
      default: return status;
    }
  };

  const fetchData = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/bookings');
      const bookings = res.data || [];
      
      const parsedEvents = bookings.map((booking: any) => {
        // bookingDate format: YYYY-MM-DD
        // timeSlot format: HH:mm-HH:mm
        let start = new Date();
        let end = new Date();

        if (booking.bookingDate && booking.timeSlot) {
          const [startStr, endStr] = booking.timeSlot.split('-');
          
          if (booking.exactTime) {
             // Use exactTime if present to reflect exactly when it happens in the calendar
             start = new Date(`${booking.bookingDate}T${booking.exactTime}`);
             // Add a default block of 5 mins for projection, or fallback to the slot end
             end = new Date(start.getTime() + 5 * 60000); // 5 minutes block
          } else {
             start = new Date(`${booking.bookingDate}T${startStr}`);
             if (endStr === '00:00' || endStr === '24:00') {
               end = new Date(`${booking.bookingDate}T00:00`);
               end.setDate(end.getDate() + 1);
             } else {
               end = new Date(`${booking.bookingDate}T${endStr}`);
             }
          }
        }
        
        const titleTime = booking.exactTime ? `[${booking.exactTime}] ` : '';

        return {
          ...booking,
          title: `${titleTime}${booking.name} - ${getStatusText(booking.status)}`,
          start,
          end,
          color: getStatusColor(booking.status)
        };
      });
      setEvents(parsedEvents);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectEvent = (event: any) => {
    setSelectedBooking(event);
    setModalOpened(true);
  };

  const eventStyleGetter = (event: any) => {
    const backgroundColor = `var(--mantine-color-${event.color}-6)`;
    const style = {
      backgroundColor,
      borderRadius: '4px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block'
    };
    return {
      style
    };
  };

  return (
    <Container size="xl" py="xl">
      <Group mb="md">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/admin')}>
          Volver al Panel
        </Button>
      </Group>

      <Group justify="space-between" mb="md" align="center">
        <Title order={2}>Calendario de Reservas</Title>
        <Group>
          <Button 
            variant="default" 
            onClick={() => setZoom(z => Math.max(z - 0.5, 1))} 
            disabled={zoom <= 1}
            leftSection={<IconZoomOut size={16} />}
          >
            Alejar
          </Button>
          <Button 
            variant="default" 
            onClick={() => setZoom(z => Math.min(z + 0.5, 4))} 
            disabled={zoom >= 4}
            leftSection={<IconZoomIn size={16} />}
          >
            Acercar
          </Button>
        </Group>
      </Group>
      
      <Box style={{ height: `${70 * zoom}vh`, minHeight: '500px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', transition: 'height 0.3s ease' }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          date={currentDate}
          view={currentView as any}
          onNavigate={(date) => setCurrentDate(date)}
          onView={(view: any) => setCurrentView(view)}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          messages={{
            next: "Sig",
            previous: "Ant",
            today: "Hoy",
            month: "Mes",
            week: "Semana",
            day: "Día",
            noEventsInRange: "No hay reservas en este rango.",
            showMore: total => `+ Ver más (${total})`
          }}
        />
      </Box>

      <Modal opened={modalOpened} onClose={() => setModalOpened(false)} title="Detalles de la Reserva" centered>
        {selectedBooking && (
          <Box>
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Cliente:</Text>
              <Text>{selectedBooking.name}</Text>
            </Group>
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Documento:</Text>
              <Text>{selectedBooking.docId}</Text>
            </Group>
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Email:</Text>
              <Text>{selectedBooking.email}</Text>
            </Group>
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Teléfono:</Text>
              <Text>{selectedBooking.whatsapp}</Text>
            </Group>
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Fecha:</Text>
              <Text>{selectedBooking.bookingDate}</Text>
            </Group>
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Horario del Bloque:</Text>
              <Text>{selectedBooking.timeSlot}</Text>
            </Group>
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Hora Exacta Asignada:</Text>
              <Text fw={700} c="blue">{selectedBooking.exactTime || 'N/A'}</Text>
            </Group>
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Estado:</Text>
              <Badge color={selectedBooking.color}>{getStatusText(selectedBooking.status)}</Badge>
            </Group>
            {selectedBooking.imageUrl && (
              <Box mt="md">
                <Text fw={500} mb="xs">Imagen Subida/Capturada:</Text>
                <img src={selectedBooking.imageUrl} alt="Reserva" style={{ width: '100%', borderRadius: '8px' }} />
              </Box>
            )}
            {selectedBooking.generatedImageUrl && (
              <Box mt="md">
                <Text fw={500} mb="xs">Imagen Generada (IA):</Text>
                <img src={selectedBooking.generatedImageUrl} alt="Generada IA" style={{ width: '100%', borderRadius: '8px' }} />
              </Box>
            )}
          </Box>
        )}
      </Modal>
    </Container>
  );
}
