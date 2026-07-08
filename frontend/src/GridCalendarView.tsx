import { useState, useEffect } from 'react';
import { Container, Title, Box, Button, Modal, TextInput, Select, NumberInput, Group, FileButton, ActionIcon, Switch } from '@mantine/core';
import { IconUpload, IconArrowLeft } from '@tabler/icons-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { API_BASE_URL } from './config';

moment.locale('es');
const localizer = momentLocalizer(moment);

export function GridCalendarView() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [screenSettings, setScreenSettings] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>('week');
  const [modalOpened, setModalOpened] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<any>({
    id: null,
    title: '',
    start: new Date(),
    end: new Date(),
    type: 'image',
    url: '',
    duration: 10,
    priority: 1,
    active: true
  });

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/bookings/screen-settings`);
      setScreenSettings(res.data);
      const grid = res.data?.contentGrid || [];
      
      const parsedEvents = grid.map((item: any) => {
        let start, end;
        if (item.start && item.end) {
          start = new Date(item.start);
          end = new Date(item.end);
        } else {
          const todayStr = new Date().toISOString().split('T')[0];
          start = new Date(`${todayStr}T${item.startTime}`);
          end = new Date(`${todayStr}T${item.endTime}`);
        }
        return {
          ...item,
          title: item.name,
          start,
          end,
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

  const handleUpdateSettings = async (newGrid: any[]) => {
    if (!screenSettings) return;
    
    const gridToSave = newGrid.map(ev => ({
      ...ev,
      id: ev.id,
      name: ev.title,
      type: ev.type,
      url: ev.url,
      duration: ev.duration,
      priority: ev.priority,
      active: ev.active,
      start: ev.start.toISOString(),
      end: ev.end.toISOString(),
      startTime: ev.start.toTimeString().slice(0, 8),
      endTime: ev.end.toTimeString().slice(0, 8),
    }));

    try {
      await axios.put(`${API_BASE_URL}/api/bookings/screen-settings`, { 
        ...screenSettings,
        contentGrid: gridToSave
      });
      setScreenSettings({ ...screenSettings, contentGrid: gridToSave });
    } catch (e) {
      alert('Error al guardar en la base de datos');
    }
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    setEditingItem({
      id: null,
      title: '',
      start: slotInfo.start,
      end: slotInfo.end,
      type: 'image',
      url: '',
      duration: 10,
      priority: 1,
      active: true,
      transition: 'fade',
      cooldownPeriod: 5,
      targetAppearances: 100,
      currentAppearances: 0,
      exclusionWindows: []
    });
    setModalOpened(true);
  };

  const handleSelectEvent = (event: any) => {
    setEditingItem({ ...event });
    setModalOpened(true);
  };

  const handleSave = () => {
    if (!editingItem.title || !editingItem.url) return alert('El nombre y la URL son requeridos');
    
    let newEvents;
    if (editingItem.id) {
      newEvents = events.map(e => e.id === editingItem.id ? editingItem : e);
    } else {
      newEvents = [...events, { ...editingItem, id: Date.now().toString() }];
    }
    
    setEvents(newEvents);
    handleUpdateSettings(newEvents);
    setModalOpened(false);
  };

  const handleDelete = () => {
    if (!editingItem.id) return;
    const newEvents = events.filter(e => e.id !== editingItem.id);
    setEvents(newEvents);
    handleUpdateSettings(newEvents);
    setModalOpened(false);
  };

  const handleUploadFile = async (file: File | null) => {
    if (!file) return;
    setIsUploading(true);
    const isVideo = file.type.startsWith('video/');
    setEditingItem((prev: any) => ({ ...prev, type: isVideo ? 'video' : 'image' }));

    if (isVideo) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        setEditingItem((prev: any) => ({
          ...prev, 
          duration: Math.round(video.duration),
          end: new Date(prev.start.getTime() + Math.round(video.duration) * 1000)
        }));
      };
      video.src = URL.createObjectURL(file);
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const res = await axios.post(`${API_BASE_URL}/api/images/upload-base64`, { 
          imageBase64: base64, 
          folder: 'screen-assets',
          contentType: file.type,
          extension: file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')
        });
        setEditingItem((prev: any) => ({ ...prev, url: res.data.url }));
      } catch(e) {
        alert('Error subiendo archivo');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const getDatetimeLocalString = (date: Date) => {
    if (!date) return '';
    const tzOffset = date.getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 19);
  };

  const handleStartChange = (val: string) => {
    const newStart = new Date(val);
    let newEnd = editingItem.end;
    if (editingItem.type === 'video') {
      newEnd = new Date(newStart.getTime() + editingItem.duration * 1000);
    } else if (newEnd <= newStart) {
      newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);
    }
    setEditingItem({ ...editingItem, start: newStart, end: newEnd });
  };

  const handleEndChange = (val: string) => {
    setEditingItem({ ...editingItem, end: new Date(val) });
  };

  const eventStyleGetter = (event: any) => {
    let backgroundColor = event.active ? '#339af0' : '#adb5bd';
    if (event.type === 'video') backgroundColor = event.active ? '#f03e3e' : '#e03131';
    
    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" align="center" mb="md">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/admin')}>
          Volver al Panel de Administración
        </Button>
        <Title order={2}>Parrilla de Contenidos (Ads/Promos)</Title>
      </Group>

      <Box style={{ height: '75vh', backgroundColor: 'white', padding: '1rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <Calendar
  localizer={localizer}
  events={events}
  startAccessor="start"
  endAccessor="end"
  selectable
  onSelectSlot={handleSelectSlot}
  onSelectEvent={handleSelectEvent}
  eventPropGetter={eventStyleGetter}

  // ✅ Nuevas props para controlar navegación y vistas
  date={currentDate}
  view={currentView}
  onNavigate={(date) => setCurrentDate(date)}
  onView={(view) => setCurrentView(view as 'month' | 'week' | 'day')}

  defaultView="week"
  views={['month', 'week', 'day']}

  messages={{
    next: "Sig",
    previous: "Ant",
    today: "Hoy",
    month: "Mes",
    week: "Semana",
    day: "Día",
    // Opcional: más mensajes en español
    agenda: "Agenda",
    showMore: (total) => `+${total} más`,
  }}
/>
      </Box>

      <Modal opened={modalOpened} onClose={() => setModalOpened(false)} title={editingItem.id ? "Editar Contenido" : "Nuevo Contenido"} size="lg">
        <TextInput 
          label="Nombre Descriptivo" 
          placeholder="Ej. Promo Coca-Cola" 
          value={editingItem.title} 
          onChange={(e) => setEditingItem({...editingItem, title: e.currentTarget.value})} 
          mb="sm" 
          required 
        />
        
        <Select 
          label="Tipo de Contenido" 
          data={[{value: 'image', label: 'Imagen'}, {value: 'video', label: 'Video'}]}
          value={editingItem.type}
          onChange={(val) => setEditingItem({...editingItem, type: val || 'image'})}
          mb="sm"
        />

        <TextInput 
          label="URL del Archivo" 
          placeholder="Sube tu imagen o video..."
          value={editingItem.url} 
          onChange={(e) => setEditingItem({...editingItem, url: e.currentTarget.value})} 
          mb="sm"
          required
          rightSection={
            <FileButton onChange={handleUploadFile} accept="image/*,video/*">
              {(props) => <ActionIcon {...props} variant="light" color="blue" loading={isUploading}><IconUpload size={16}/></ActionIcon>}
            </FileButton>
          }
        />

        {editingItem.type === 'video' ? (
          <NumberInput 
            label="Duración detectada (Segundos)" 
            value={editingItem.duration} 
            disabled
            mb="sm" 
          />
        ) : (
          <NumberInput 
            label="Duración en pantalla (Segundos)" 
            value={editingItem.duration} 
            onChange={(val) => setEditingItem({...editingItem, duration: Number(val) || 10})} 
            mb="sm" 
          />
        )}

        <Group grow mb="sm">
          <TextInput 
            type="datetime-local" 
            step="1"
            label="Inicio" 
            required 
            value={getDatetimeLocalString(editingItem.start)} 
            onChange={(e) => handleStartChange(e.currentTarget.value)} 
          />
          <TextInput 
            type="datetime-local" 
            step="1"
            label="Fin" 
            required 
            value={getDatetimeLocalString(editingItem.end)} 
            disabled={editingItem.type === 'video'} 
            onChange={(e) => handleEndChange(e.currentTarget.value)} 
          />
        </Group>
        
        <Group grow mb="xl" align="flex-end">
          <NumberInput 
            label="Prioridad" 
            description="En caso de cruces, se mostrará el mayor" 
            value={editingItem.priority} 
            onChange={(val) => setEditingItem({...editingItem, priority: Number(val)})} 
          />
          <Switch 
            label="Elemento Activo" 
            checked={editingItem.active} 
            onChange={(e) => setEditingItem({...editingItem, active: e.currentTarget.checked})} 
            size="md"
          />
        </Group>

        <Group justify="space-between">
          {editingItem.id ? (
            <Button color="red" variant="subtle" onClick={handleDelete}>Eliminar</Button>
          ) : <div></div>}
          <Button onClick={handleSave}>Guardar Cambios</Button>
        </Group>
      </Modal>
    </Container>
  );
}
