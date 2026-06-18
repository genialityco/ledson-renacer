import { useState, useEffect } from 'react';
import { Container, Title, Tabs, Table, Button, Badge, Group, Text, Image, Box, TextInput, Modal, Grid, FileButton, ActionIcon, Loader, Select, NumberInput } from '@mantine/core';
import { IconUsers, IconFilter, IconDeviceTv, IconCheck, IconLink, IconExternalLink, IconUpload, IconCalendar } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export function AdminDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [filters, setFilters] = useState<any[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [newFilter, setNewFilter] = useState({ 
    label: '', value: '', imageUrl: '', lora: '', prompt: '', lora_strength: 0.8, denoise: 0.6, transitionEffect: 'fade', frameUrl: '' 
  });
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [screenBgUrl, setScreenBgUrl] = useState('');
  const [headerUrl, setHeaderUrl] = useState('');
  const [footerUrl, setFooterUrl] = useState('');
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [newCarouselImg, setNewCarouselImg] = useState('');
  const [carouselDuration, setCarouselDuration] = useState(5);
  const [projectionDuration, setProjectionDuration] = useState(15);
  const [carouselDirection, setCarouselDirection] = useState('fade');
  const [isUploading, setIsUploading] = useState(false);
  const [contentGrid, setContentGrid] = useState<any[]>([]);
  const [deadTimes, setDeadTimes] = useState<any[]>([]);
  const [gridModalOpened, { open: openGridModal, close: closeGridModal }] = useDisclosure(false);
  const [newGridItem, setNewGridItem] = useState({ name: '', url: '', type: 'image', duration: 10, startTime: '00:00:00', endTime: '23:59:59', priority: 1, active: true });

  const addSecondsToTime = (timeStr: string, seconds: number) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    const h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    const s = parseInt(parts[2] || '0', 10);
    const date = new Date();
    date.setHours(h, m, s + seconds);
    return date.toTimeString().slice(0, 8); // "HH:mm:ss"
  };

  // Schedules states
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateModalOpened, { open: openTemplateModal, close: closeTemplateModal }] = useDisclosure(false);
  const [newTemplate, setNewTemplate] = useState<any>({ name: '', slots: [], deadTimes: [] });
  const [applyModalOpened, { open: openApplyModal, close: closeApplyModal }] = useDisclosure(false);
  const [selectedTemplateToApply, setSelectedTemplateToApply] = useState('');
  const [startDateToApply, setStartDateToApply] = useState('');
  const [endDateToApply, setEndDateToApply] = useState('');
  
  const [autoSlotStart, setAutoSlotStart] = useState('20:00');
  const [autoSlotEnd, setAutoSlotEnd] = useState('23:00');
  const [autoSlotInterval, setAutoSlotInterval] = useState<string | null>('60');
  
  const [slotDuration, setSlotDuration] = useState(1);

  const fetchData = async () => {
    try {
      const [resBookings, resFilters, resScreen, resTemplates, resScheduleSettings] = await Promise.all([
        axios.get('http://localhost:5000/api/bookings'),
        axios.get('http://localhost:5000/api/images/admin'),
        axios.get('http://localhost:5000/api/bookings/screen-settings'),
        axios.get('http://localhost:5000/api/schedules/templates'),
        axios.get('http://localhost:5000/api/schedules/settings')
      ]);
      setBookings(resBookings.data);
      setFilters(resFilters.data);
      setTemplates(resTemplates.data || []);
      setSlotDuration(resScheduleSettings.data?.slotDuration || 1);
      if (resScreen.data) {
        setScreenBgUrl(resScreen.data.backgroundUrl || '');
        setHeaderUrl(resScreen.data.headerUrl || '');
        setFooterUrl(resScreen.data.footerUrl || '');
        setCarouselImages(resScreen.data.carouselImages || []);
        setCarouselDuration(resScreen.data.carouselDuration || 5);
        setProjectionDuration(resScreen.data.projectionDuration || 15);
        setCarouselDirection(resScreen.data.carouselTransitionDirection || 'fade');
        setContentGrid(resScreen.data.contentGrid || []);
        setDeadTimes(resScreen.data.deadTimes || []);
      }
    } catch (e) {
      console.error('Error fetching admin data', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* const handleUpdateBookingStatus = async (id: string, status: string) => {
    await axios.put(`http://localhost:5000/api/bookings/${id}/status`, { status });
    fetchData();
  }; */

  const handleAddFilter = async () => {
    if (newFilter._id) {
      // Editar
      const { _id, ...updateData } = newFilter;
      await axios.put(`http://localhost:5000/api/images/${_id}`, updateData);
    } else {
      // Crear
      await axios.post('http://localhost:5000/api/images', newFilter);
    }
    
    setNewFilter({ label: '', value: '', imageUrl: '', lora: '', prompt: '', lora_strength: 0.8, denoise: 0.6, transitionEffect: 'fade', frameUrl: '' });
    close();
    fetchData();
  };

  const handleEditFilter = (f: any) => {
    setNewFilter(f);
    open();
  };

  const handleToggleFilterStatus = async (id: string, active: boolean) => {
    await axios.put(`http://localhost:5000/api/images/${id}`, { active });
    fetchData();
  };

  const handleGenerateImage = async (id: string) => {
    setGeneratingId(id);
    try {
      await axios.post(`http://localhost:5000/api/bookings/${id}/generate`);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Error contactando a la API de generación de imágenes.');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleUpdateSettings = async (overrideGrid?: any[]) => {
    await axios.put('http://localhost:5000/api/bookings/screen-settings', { 
      backgroundUrl: screenBgUrl,
      headerUrl,
      footerUrl,
      carouselImages,
      carouselDuration,
      projectionDuration,
      carouselTransitionDirection: carouselDirection,
      contentGrid: overrideGrid || contentGrid,
      deadTimes
    });
    alert('Configuración de la Pantalla Gigante actualizada');
  };

  const addCarouselImage = () => {
    if (newCarouselImg) {
      setCarouselImages([...carouselImages, newCarouselImg]);
      setNewCarouselImg('');
    }
  };

  const removeCarouselImage = (index: number) => {
    setCarouselImages(carouselImages.filter((_, i) => i !== index));
  };

  const handleUploadFile = async (
    file: File | null, 
    setUrlCallback: (url: string) => void, 
    setTypeCallback?: (type: string) => void,
    setDurationCallback?: (duration: number) => void
  ) => {
    if (!file) return;
    setIsUploading(true);
    const isVideo = file.type.startsWith('video/');
    if (setTypeCallback) setTypeCallback(isVideo ? 'video' : 'image');

    if (isVideo && setDurationCallback) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        setDurationCallback(Math.round(video.duration));
      };
      video.src = URL.createObjectURL(file);
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const res = await axios.post('http://localhost:5000/api/images/upload-base64', { 
          imageBase64: base64, 
          folder: 'screen-assets',
          contentType: file.type,
          extension: file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')
        });
        setUrlCallback(res.data.url);
      } catch(e) {
        console.error(e);
        alert('Error subiendo archivo a Firebase');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearScreen = async () => {
    await axios.post('http://localhost:5000/api/bookings/screen-settings/clear');
    alert('Pantalla gigante despejada');
  };

  const handleProject = async (id: string) => {
    await axios.post(`http://localhost:5000/api/bookings/${id}/project`);
    fetchData();
  };

  const handleSaveTemplate = async () => {
    try {
      await axios.post('http://localhost:5000/api/schedules/templates', newTemplate);
      setNewTemplate({ name: '', slots: [], deadTimes: [] });
      closeTemplateModal();
      fetchData();
    } catch (e) {
      alert('Error guardando plantilla');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('¿Eliminar plantilla?')) {
      await axios.delete(`http://localhost:5000/api/schedules/templates/${id}`);
      fetchData();
    }
  };

  const handleEditTemplate = (t: any) => {
    setNewTemplate({ ...t });
    openTemplateModal();
  };

  const handleAutoGenerateSlots = () => {
    if (!autoSlotStart || !autoSlotEnd || !autoSlotInterval) return;
    
    const slots = [];
    let current = new Date(`2000-01-01T${autoSlotStart}:00`);
    const end = new Date(`2000-01-01T${autoSlotEnd}:00`);
    const intervalMs = parseInt(autoSlotInterval) * 60000;

    if (end <= current) {
      end.setDate(end.getDate() + 1);
    }

    while (current < end) {
      const startStr = current.toTimeString().slice(0, 5);
      const next = new Date(current.getTime() + intervalMs);
      if (next > end) break; // Evitar que se pase de la hora final
      const nextStr = next.toTimeString().slice(0, 5);
      slots.push({ startTime: startStr, endTime: nextStr });
      current = next;
    }

    setNewTemplate({...newTemplate, slots: [...newTemplate.slots, ...slots]});
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplateToApply || !startDateToApply || !endDateToApply) {
      return alert('Selecciona una plantilla y un rango de fechas');
    }
    
    const start = new Date(`${startDateToApply}T12:00:00`);
    const end = new Date(`${endDateToApply}T12:00:00`);

    if (start > end) {
      return alert('La fecha inicial no puede ser posterior a la fecha final');
    }

    const dates = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    try {
      await axios.post('http://localhost:5000/api/schedules/apply-template', {
        templateId: selectedTemplateToApply,
        dates
      });
      alert(`Plantilla aplicada exitosamente desde ${startDateToApply} hasta ${endDateToApply}`);
      closeApplyModal();
    } catch (e) {
      alert('Error aplicando plantilla');
    }
  };

  const handleUpdateScheduleSettings = async () => {
    try {
      await axios.put('http://localhost:5000/api/schedules/settings', { slotDuration });
      alert('Ajustes de horario actualizados');
    } catch (e) {
      alert('Error guardando ajustes de horario');
    }
  };

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" align="center" mb="xl">
        <Title order={2}>Panel de Administración</Title>
        <Group>
          <Button variant="light" leftSection={<IconLink size={16} />} onClick={() => navigate('/booking')}>
            Enlace Reserva (Wompi)
          </Button>
          <Button variant="light" color="grape" leftSection={<IconLink size={16} />} onClick={() => navigate('/assisted-booking')}>
            Terminal de Stand (Físico)
          </Button>
          <Button variant="filled" color="dark" leftSection={<IconExternalLink size={16} />} onClick={() => window.open('/screen', '_blank')}>
            Abrir Pantalla Gigante
          </Button>
          <Button variant="filled" color="indigo" leftSection={<IconCalendar size={16} />} onClick={() => navigate('/admin/grid')}>
            Parrilla de Contenidos
          </Button>
        </Group>
      </Group>

      <Tabs defaultValue="bookings">
        <Tabs.List mb="md">
          <Tabs.Tab value="bookings" leftSection={<IconUsers size={16} />}>Reservas y Pagos</Tabs.Tab>
          <Tabs.Tab value="filters" leftSection={<IconFilter size={16} />}>Gestión de Filtros</Tabs.Tab>
          <Tabs.Tab value="schedules" leftSection={<IconCalendar size={16} />}>Gestión de Horarios</Tabs.Tab>
          <Tabs.Tab value="screen" leftSection={<IconDeviceTv size={16} />}>Pantalla Gigante</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="bookings">
          <Group justify="space-between" mb="md" align="center">
            <Text fw={500} size="lg">Listado de Reservas</Text>
            <Button leftSection={<IconCalendar size={16} />} onClick={() => navigate('/admin/bookings-calendar')} variant="light" color="indigo">
              Ver Calendario de Reservas
            </Button>
          </Group>
          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nombre</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Filtro</Table.Th>
                  <Table.Th>Horario Asignado</Table.Th>
                  <Table.Th>Método Pago</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Foto</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {bookings.map((b) => (
                  <Table.Tr key={b.id}>
                    <Table.Td>{b.name}</Table.Td>
                    <Table.Td>{b.email}</Table.Td>
                    <Table.Td>
                      <Badge color="grape" variant="light">{filters.find(f => f._id === b.selectedFilter)?.label || b.selectedFilter}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color="gray">{b.timeSlot}</Badge>
                      <br/>
                      <Text size="xs" fw={700} c="dimmed">Exacto: {b.exactTime || 'N/A'}</Text>
                    </Table.Td>
                    <Table.Td>{b.paymentMethod}</Table.Td>
                    <Table.Td>
                      <Badge color={b.status === 'SHOWN' ? 'blue' : b.status === 'COMPLETED' ? 'grape' : b.status === 'GENERATED' ? 'teal' : 'orange'}>
                        {b.status === 'SHOWN' ? 'PROYECTADA' : b.status === 'COMPLETED' ? 'FINALIZADA' : b.status === 'GENERATED' ? 'GENERADA' : 'EN COLA'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {b.status === 'COMPLETED' || b.status === 'SHOWN' || b.status === 'GENERATED' ? (
                        <a href={b.generatedImageUrl || b.imageUrl} target="_blank" rel="noreferrer" style={{color: 'blue'}}>Ver Imagen IA</a>
                      ) : (
                        <a href={b.imageUrl} target="_blank" rel="noreferrer" style={{color: 'blue'}}>Ver Original</a>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="filters">
          <Group justify="space-between" mb="sm">
            <Text fw={500}>Filtros Disponibles</Text>
            <Button onClick={open}>+ Añadir Filtro</Button>
          </Group>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Miniatura</Table.Th>
                <Table.Th>Label (Visual)</Table.Th>
                <Table.Th>Value (API Backend)</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filters.map((f) => (
                <Table.Tr key={f._id}>
                  <Table.Td><Image src={f.imageUrl} w={50} radius="sm" /></Table.Td>
                  <Table.Td>{f.label}</Table.Td>
                  <Table.Td><code>{f.value}</code></Table.Td>
                  <Table.Td>
                    <Badge color={f.active ? 'green' : 'red'}>{f.active ? 'Activo' : 'Inactivo'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" color="blue" variant="subtle" onClick={() => handleEditFilter(f)}>Editar</Button>
                      <Button 
                        size="xs" 
                        variant="light" 
                        color={f.active ? 'red' : 'green'}
                        onClick={() => handleToggleFilterStatus(f._id, !f.active)}
                      >
                        {f.active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Modal opened={opened} onClose={() => {
            setNewFilter({ label: '', value: '', imageUrl: '', lora: '', prompt: '', lora_strength: 0.8, denoise: 0.6, transitionEffect: 'fade', frameUrl: '' });
            close();
          }} title={newFilter._id ? "Editar Filtro" : "Añadir Nuevo Filtro"}>
            <TextInput label="Label (Ej: Estilo Acuarela)" value={newFilter.label} onChange={e => setNewFilter({...newFilter, label: e.currentTarget.value})} mb="sm" />
            <TextInput label="Valor API (Para UI)" value={newFilter.value} onChange={e => setNewFilter({...newFilter, value: e.currentTarget.value})} mb="sm" />
            <TextInput label="URL de Imagen (Ejemplo Visual)" value={newFilter.imageUrl} onChange={e => setNewFilter({...newFilter, imageUrl: e.currentTarget.value})} mb="sm" />
            
            <Text fw={500} mt="md" mb="xs">Parámetros de IA (Generación)</Text>
            <TextInput label="Nombre del LoRA" value={newFilter.lora} onChange={e => setNewFilter({...newFilter, lora: e.currentTarget.value})} mb="sm" required />
            <TextInput label="Prompt" value={newFilter.prompt} onChange={e => setNewFilter({...newFilter, prompt: e.currentTarget.value})} mb="sm" required />
            <TextInput type="number" step="0.1" label="Fuerza del LoRA (0.0 a 1.0)" value={newFilter.lora_strength} onChange={e => setNewFilter({...newFilter, lora_strength: Number(e.currentTarget.value)})} mb="sm" />
            <TextInput type="number" step="0.1" label="Denoise (0.0 a 1.0)" value={newFilter.denoise} onChange={e => setNewFilter({...newFilter, denoise: Number(e.currentTarget.value)})} mb="md" />

            <Text fw={500} mt="md" mb="xs">Visualización en Pantalla Gigante</Text>
            <Select 
              label="Efecto de Transición"
              value={newFilter.transitionEffect}
              onChange={(val) => setNewFilter({...newFilter, transitionEffect: val || 'fade'})}
              data={[
                { value: 'fade', label: 'Desvanecimiento (Fade)' },
                { value: 'slide-up', label: 'Deslizar hacia arriba' },
                { value: 'slide-down', label: 'Deslizar hacia abajo' },
                { value: 'slide-right', label: 'Deslizar a la derecha' },
                { value: 'slide-left', label: 'Deslizar a la izquierda' },
                { value: 'scale', label: 'Escalar' },
                { value: 'pop', label: 'Pop' },                { value: 'particles', label: 'Partículas' },              ]}
              mb="sm"
            />
            <TextInput 
              label="Marco Decorativo (PNG con transparencia)" 
              placeholder="URL o subir archivo..." 
              value={newFilter.frameUrl} 
              onChange={e => setNewFilter({...newFilter, frameUrl: e.currentTarget.value})}
              mb="md"
              rightSection={
                <FileButton onChange={(f) => handleUploadFile(f, (url) => setNewFilter({...newFilter, frameUrl: url}))} accept="image/png">
                  {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16}/></ActionIcon>}
                </FileButton>
              }
            />

            <Button fullWidth onClick={handleAddFilter}>Guardar Filtro</Button>
          </Modal>
        </Tabs.Panel>

        <Tabs.Panel value="schedules">
          <Box mb="xl" p="md" style={{ border: '1px solid #eee', borderRadius: '8px' }}>
            <Title order={4} mb="sm">Configuración General de Asignación</Title>
            <Grid align="flex-end">
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NumberInput 
                  label="Tiempo asignado por usuario (Minutos)" 
                  description="Intervalo exacto de tiempo asignado para cada proyección"
                  value={slotDuration} 
                  onChange={(val) => setSlotDuration(Number(val) || 1)} 
                  min={1} 
                  max={60}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Button onClick={handleUpdateScheduleSettings}>Guardar Ajuste</Button>
              </Grid.Col>
            </Grid>
          </Box>

          <Group justify="space-between" mb="sm" mt="md">
            <Text fw={500}>Plantillas de Horarios</Text>
            <Group>
              <Button onClick={() => { setNewTemplate({ name: '', slots: [], deadTimes: [] }); openTemplateModal(); }}>+ Nueva Plantilla</Button>
              <Button onClick={openApplyModal} color="teal">Aplicar Plantilla a Fechas</Button>
            </Group>
          </Group>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Franjas (Slots)</Table.Th>
                <Table.Th>Descansos (Dead Times)</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {templates.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>{t.name}</Table.Td>
                  <Table.Td>{t.slots?.map((s: any) => `${s.startTime}-${s.endTime}`).join(', ') || 'Ninguno'}</Table.Td>
                  <Table.Td>{t.deadTimes?.map((d: any) => `${d.startTime}-${d.endTime}`).join(', ') || 'Ninguno'}</Table.Td>
                  <Table.Td>
                    <Button size="xs" color="blue" variant="subtle" onClick={() => handleEditTemplate(t)}>Editar</Button>
                    <Button size="xs" color="red" variant="subtle" onClick={() => handleDeleteTemplate(t.id)}>Eliminar</Button>
                  </Table.Td>
                </Table.Tr>
              ))}
              {templates.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4} ta="center" c="dimmed">No hay plantillas creadas</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>

          <Modal opened={templateModalOpened} onClose={closeTemplateModal} title={newTemplate.id ? "Editar Plantilla" : "Crear Plantilla"} size="lg">
            <TextInput label="Nombre de la Plantilla" placeholder="Ej: Fin de semana" value={newTemplate.name} onChange={(e) => setNewTemplate({...newTemplate, name: e.currentTarget.value})} mb="sm" required />
            
            <Box mt="md" p="sm" style={{ backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <Text fw={500} size="sm" mb="xs">Generación Automática de Franjas</Text>
              <Group grow align="flex-end">
                <TextInput type="time" label="Hora Inicial" value={autoSlotStart} onChange={(e) => setAutoSlotStart(e.currentTarget.value)} />
                <TextInput type="time" label="Hora Final" value={autoSlotEnd} onChange={(e) => setAutoSlotEnd(e.currentTarget.value)} />
                <Select label="Intervalo" data={[{value: '15', label: '15 min'}, {value: '30', label: '30 min'}, {value: '60', label: '1 hora'}]} value={autoSlotInterval} onChange={setAutoSlotInterval} />
                <Button variant="light" color="blue" onClick={handleAutoGenerateSlots}>Generar</Button>
              </Group>
            </Box>

            <Text fw={500} size="sm" mt="md" mb="xs">Franjas de Atención (Slots)</Text>
            <Text size="xs" c="dimmed" mb="sm">Ejemplo: 20:00 a 21:00, 21:00 a 22:00.</Text>
            {newTemplate.slots.map((s: any, idx: number) => (
              <Group key={idx} mb="xs">
                <TextInput type="time" value={s.startTime} onChange={(e) => {
                  const arr = [...newTemplate.slots];
                  arr[idx].startTime = e.currentTarget.value;
                  setNewTemplate({...newTemplate, slots: arr});
                }} />
                <Text>-</Text>
                <TextInput type="time" value={s.endTime} onChange={(e) => {
                  const arr = [...newTemplate.slots];
                  arr[idx].endTime = e.currentTarget.value;
                  setNewTemplate({...newTemplate, slots: arr});
                }} />
                <Button size="xs" color="red" variant="subtle" onClick={() => {
                  const arr = [...newTemplate.slots];
                  arr.splice(idx, 1);
                  setNewTemplate({...newTemplate, slots: arr});
                }}>X</Button>
              </Group>
            ))}
            <Button size="xs" variant="light" mb="md" onClick={() => setNewTemplate({...newTemplate, slots: [...newTemplate.slots, { startTime: '', endTime: '' }]})}>+ Añadir Franja</Button>

            <Text fw={500} size="sm" mt="md" mb="xs">Descansos (Tiempos Muertos)</Text>
            {newTemplate.deadTimes.map((d: any, idx: number) => (
              <Group key={idx} mb="xs">
                <TextInput type="time" value={d.startTime} onChange={(e) => {
                  const arr = [...newTemplate.deadTimes];
                  arr[idx].startTime = e.currentTarget.value;
                  setNewTemplate({...newTemplate, deadTimes: arr});
                }} />
                <Text>-</Text>
                <TextInput type="time" value={d.endTime} onChange={(e) => {
                  const arr = [...newTemplate.deadTimes];
                  arr[idx].endTime = e.currentTarget.value;
                  setNewTemplate({...newTemplate, deadTimes: arr});
                }} />
                <Button size="xs" color="red" variant="subtle" onClick={() => {
                  const arr = [...newTemplate.deadTimes];
                  arr.splice(idx, 1);
                  setNewTemplate({...newTemplate, deadTimes: arr});
                }}>X</Button>
              </Group>
            ))}
            <Button size="xs" variant="light" mb="md" color="orange" onClick={() => setNewTemplate({...newTemplate, deadTimes: [...newTemplate.deadTimes, { startTime: '', endTime: '' }]})}>+ Añadir Descanso</Button>

            <Button fullWidth mt="md" onClick={handleSaveTemplate}>Guardar Plantilla</Button>
          </Modal>

          <Modal opened={applyModalOpened} onClose={closeApplyModal} title="Aplicar Plantilla a Rango de Fechas">
            <Select 
              label="Selecciona la Plantilla" 
              data={templates.map(t => ({ value: t.id, label: t.name }))}
              value={selectedTemplateToApply}
              onChange={(val) => setSelectedTemplateToApply(val || '')}
              mb="sm"
            />
            <Group grow mb="md">
              <TextInput 
                type="date" 
                label="Fecha Inicial" 
                value={startDateToApply}
                onChange={(e) => setStartDateToApply(e.currentTarget.value)}
              />
              <TextInput 
                type="date" 
                label="Fecha Final" 
                value={endDateToApply}
                onChange={(e) => setEndDateToApply(e.currentTarget.value)}
              />
            </Group>
            <Button fullWidth onClick={handleApplyTemplate} color="teal">Aplicar a estas fechas</Button>
          </Modal>
        </Tabs.Panel>

        <Tabs.Panel value="screen">
          <Box mb="xl" p="md" style={{ border: '1px solid #eee', borderRadius: '8px', position: 'relative' }}>
            {isUploading && (
              <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader /> <Text ml="sm" fw={500}>Subiendo imagen a Firebase...</Text>
              </Box>
            )}
            <Title order={4} mb="sm">Configuración de Pantalla (En Espera / Carrusel)</Title>
            <Grid mb="sm">
              <Grid.Col span={{ base: 12, md: 4 }}>
                <TextInput 
                  label="Fondo Global (Opcional)" 
                  placeholder="URL o subir archivo..." 
                  value={screenBgUrl} 
                  onChange={e => setScreenBgUrl(e.currentTarget.value)}
                  rightSection={
                    <FileButton onChange={(f) => handleUploadFile(f, setScreenBgUrl)} accept="image/*,video/*">
                      {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16}/></ActionIcon>}
                    </FileButton>
                  }
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <TextInput 
                  label="Imagen Header (Arriba)" 
                  placeholder="URL o subir archivo..." 
                  value={headerUrl} 
                  onChange={e => setHeaderUrl(e.currentTarget.value)}
                  rightSection={
                    <FileButton onChange={(f) => handleUploadFile(f, setHeaderUrl)} accept="image/*">
                      {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16}/></ActionIcon>}
                    </FileButton>
                  }
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <TextInput 
                  label="Imagen Footer (Abajo)" 
                  placeholder="URL o subir archivo..." 
                  value={footerUrl} 
                  onChange={e => setFooterUrl(e.currentTarget.value)}
                  rightSection={
                    <FileButton onChange={(f) => handleUploadFile(f, setFooterUrl)} accept="image/*">
                      {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16}/></ActionIcon>}
                    </FileButton>
                  }
                />
              </Grid.Col>
            </Grid>
            
            <Text fw={500} size="sm" mt="md" mb="xs">Imágenes para el Carrusel (Rotan automáticamente)</Text>
            <Group mb="sm">
              <TextInput 
                placeholder="URL de nueva imagen..." 
                value={newCarouselImg} 
                onChange={e => setNewCarouselImg(e.currentTarget.value)} 
                style={{ flex: 1 }}
                rightSection={
                  <FileButton onChange={(f) => handleUploadFile(f, setNewCarouselImg)} accept="image/*,video/*">
                    {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16}/></ActionIcon>}
                  </FileButton>
                }
              />
              <Button onClick={addCarouselImage} variant="light">Añadir al Carrusel</Button>
            </Group>
            
            <Group mb="md">
              {carouselImages.map((img, idx) => (
                <Box key={idx} style={{ position: 'relative' }}>
                  <Image src={img} w={80} h={80} radius="md" style={{ border: '1px solid #ccc', objectFit: 'cover' }} />
                  <Button size="compact-xs" color="red" style={{ position: 'absolute', top: -5, right: -5, padding: 0, width: 20, height: 20 }} onClick={() => removeCarouselImage(idx)}>X</Button>
                </Box>
              ))}
            </Group>

            <Grid mb="xl" mt="md">
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NumberInput 
                  label="Duración Carrusel (seg)" 
                  value={carouselDuration} 
                  onChange={(val) => setCarouselDuration(Number(val) || 5)} 
                  min={1} 
                  max={60}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <NumberInput 
                  label="Duración Proyección IA (seg)" 
                  value={projectionDuration} 
                  onChange={(val) => setProjectionDuration(Number(val) || 15)} 
                  min={5} 
                  max={300}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Select 
                  label="Transición de Carrusel"
                  value={carouselDirection}
                  onChange={(val) => setCarouselDirection(val || 'fade')}
                  data={[
                    { value: 'fade', label: 'Desvanecimiento (Fade)' },
                    { value: 'slide-left', label: 'Deslizar hacia la Izquierda' },
                    { value: 'slide-right', label: 'Deslizar hacia la Derecha' },
                    { value: 'slide-up', label: 'Deslizar hacia Arriba' },
                    { value: 'slide-down', label: 'Deslizar hacia Abajo' },
                  ]}
                />
              </Grid.Col>
            </Grid>

            <Group align="flex-end" justify="space-between" mt="md">
              <Button color="teal" onClick={handleUpdateSettings}>Guardar Configuración de Standby</Button>
              <Button color="red" variant="light" onClick={handleClearScreen}>Forzar Limpieza de Pantalla (Quitar proyección actual)</Button>
            </Group>

            <Box mt="xl" pt="xl" style={{ borderTop: '1px solid #eee' }}>
              <Title order={4} mb="sm">Parrilla de Contenidos Programados (Ads/Promos)</Title>
              <Text c="dimmed" size="sm" mb="sm">
                Las imágenes de esta parrilla sobrescribirán el carrusel normal si la hora actual coincide y están activas. 
                Si varias coinciden, rotarán únicamente las que tengan la prioridad más alta.
              </Text>
              <Group mb="sm">
                <Button onClick={() => {
                  setNewGridItem({ name: '', url: '', type: 'image', duration: 10, startTime: '00:00:00', endTime: '23:59:59', priority: 1, active: true });
                  openGridModal();
                }} variant="light" color="blue">+ Añadir a la Parrilla</Button>
              </Group>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nombre</Table.Th>
                    <Table.Th>Miniatura</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Horario</Table.Th>
                    <Table.Th>Duración</Table.Th>
                    <Table.Th>Prioridad</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th>Acciones</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {contentGrid.map((item, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td>{item.name}</Table.Td>
                      <Table.Td>
                        {item.type === 'video' ? (
                          <video src={item.url} style={{width: 40, height: 40, objectFit: 'cover'}} muted />
                        ) : (
                          <Image src={item.url} w={40} h={40} radius="sm" style={{objectFit: 'cover'}}/>
                        )}
                      </Table.Td>
                      <Table.Td><Badge color={item.type === 'video' ? 'red' : 'blue'}>{item.type}</Badge></Table.Td>
                      <Table.Td><Badge color="gray">{item.startTime} {item.type === 'image' && item.endTime ? `- ${item.endTime}` : ''}</Badge></Table.Td>
                      <Table.Td>{item.type === 'video' ? 'Video' : `${item.duration}s`}</Table.Td>
                      <Table.Td>{item.priority}</Table.Td>
                      <Table.Td><Badge color={item.active ? 'green' : 'gray'}>{item.active ? 'Activo' : 'Inactivo'}</Badge></Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Button size="xs" color="blue" variant="subtle" onClick={() => {
                            setNewGridItem(item);
                            openGridModal();
                          }}>Editar</Button>
                          <Button size="xs" color="red" variant="subtle" onClick={() => {
                            const grid = [...contentGrid];
                            grid.splice(idx, 1);
                            setContentGrid(grid);
                            handleUpdateSettings(grid); // Guardar automáticamente al eliminar
                          }}>Eliminar</Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {contentGrid.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={6} ta="center" c="dimmed">No hay contenidos en la parrilla</Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Box>

            <Modal opened={gridModalOpened} onClose={() => {
              setNewGridItem({ name: '', url: '', type: 'image', duration: 10, startTime: '00:00:00', endTime: '23:59:59', priority: 1, active: true });
              closeGridModal();
            }} title={(newGridItem as any).id ? "Editar Contenido de Parrilla" : "Añadir Contenido a la Parrilla"}>
              <TextInput label="Nombre Descriptivo" placeholder="Ej. Promo Coca-Cola" value={newGridItem.name} onChange={(e) => setNewGridItem({...newGridItem, name: e.currentTarget.value})} mb="sm" required />
              
              <Select 
                label="Tipo de Contenido" 
                data={[{value: 'image', label: 'Imagen'}, {value: 'video', label: 'Video'}]}
                value={newGridItem.type}
                onChange={(val) => setNewGridItem({...newGridItem, type: val || 'image'})}
                mb="sm"
              />

              <TextInput 
                label="URL del Archivo" 
                placeholder="Subir imagen o video..."
                value={newGridItem.url} 
                onChange={(e) => setNewGridItem({...newGridItem, url: e.currentTarget.value})} 
                mb="sm"
                required
                rightSection={
                  <FileButton onChange={(f) => handleUploadFile(f, 
                    (url) => setNewGridItem(prev => ({...prev, url})),
                    (type) => setNewGridItem(prev => ({...prev, type})),
                    (duration) => setNewGridItem(prev => {
                      const newStart = prev.startTime;
                      const newEnd = addSecondsToTime(newStart, duration);
                      return {...prev, duration, endTime: newEnd};
                    })
                  )} accept="image/*,video/*">
                    {(props) => <ActionIcon {...props} variant="light" color="blue"><IconUpload size={16}/></ActionIcon>}
                  </FileButton>
                }
              />

              {newGridItem.type === 'video' ? (
                <NumberInput 
                  label="Duración detectada (Segundos)" 
                  value={newGridItem.duration} 
                  disabled
                  mb="sm" 
                />
              ) : (
                <NumberInput 
                  label="Duración en pantalla (Segundos)" 
                  value={newGridItem.duration} 
                  onChange={(val) => setNewGridItem({...newGridItem, duration: Number(val) || 10})} 
                  mb="sm" 
                />
              )}

              <Group grow mb="sm">
                <TextInput type="time" step={1} label="Hora Inicio (HH:MM:SS)" required value={newGridItem.startTime} onChange={(e) => {
                  const newStart = e.currentTarget.value;
                  let newEnd = newGridItem.endTime;
                  if (newGridItem.type === 'video' && newGridItem.duration) {
                    newEnd = addSecondsToTime(newStart, newGridItem.duration);
                  }
                  setNewGridItem({...newGridItem, startTime: newStart, endTime: newEnd});
                }} />
                <TextInput type="time" step={1} label="Hora Fin (HH:MM:SS)" required value={newGridItem.endTime} disabled={newGridItem.type === 'video'} onChange={(e) => setNewGridItem({...newGridItem, endTime: e.currentTarget.value})} />
              </Group>
              <NumberInput label="Prioridad" description="En caso de choque de horarios, se mostrará el número mayor" value={newGridItem.priority} onChange={(val) => setNewGridItem({...newGridItem, priority: Number(val)})} mb="md" />
              <Button fullWidth onClick={() => {
                if(!newGridItem.name || !newGridItem.url) return alert('Completa nombre y url');
                
                let updatedGrid;
                if ((newGridItem as any).id) {
                  // Edit
                  updatedGrid = contentGrid.map(item => item.id === (newGridItem as any).id ? newGridItem : item);
                } else {
                  // Add
                  updatedGrid = [...contentGrid, {...newGridItem, id: Date.now().toString()}];
                }
                
                setContentGrid(updatedGrid);
                handleUpdateSettings(updatedGrid); // Guardar automáticamente
                
                setNewGridItem({ name: '', url: '', type: 'image', duration: 10, startTime: '00:00', endTime: '23:59', priority: 1, active: true });
                closeGridModal();
              }}>
                {(newGridItem as any).id ? 'Guardar Cambios' : 'Añadir a Parrilla'}
              </Button>
            </Modal>

          </Box>

          <Text mb="sm" c="dimmed">Administra qué fotos ya fueron mostradas en la pantalla gigante.</Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Usuario</Table.Th>
                <Table.Th>Franja Horaria</Table.Th>
                <Table.Th>Imagen Final</Table.Th>
                <Table.Th>Estado Proyección</Table.Th>
                <Table.Th>Acción</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {bookings.map((b) => (
                <Table.Tr key={b.id}>
                  <Table.Td>{b.name}</Table.Td>
                  <Table.Td>
                    <Badge>{b.timeSlot}</Badge>
                    <br/>
                    <Text size="xs" fw={700} c="dimmed">Exacto: {b.exactTime || 'N/A'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Image src={b.generatedImageUrl || b.imageUrl} w={60} radius="md" />
                  </Table.Td>
                  <Table.Td>
                    <Badge color={b.status === 'SHOWN' ? 'blue' : b.status === 'COMPLETED' ? 'grape' : b.status === 'GENERATED' ? 'teal' : 'orange'}>
                      {b.status === 'SHOWN' ? 'PROYECTADA' : b.status === 'COMPLETED' ? 'FINALIZADA' : b.status === 'GENERATED' ? 'GENERADA' : 'EN COLA'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {(!b.generatedImageUrl && b.status !== 'SHOWN' && b.status !== 'COMPLETED') && (
                        <Button 
                          size="xs" 
                          color="violet" 
                          loading={generatingId === b.id}
                          onClick={() => handleGenerateImage(b.id)}
                        >
                          Generar Imagen
                        </Button>
                      )}
                      
                      {b.status !== 'SHOWN' && b.status !== 'COMPLETED' ? (
                        <Button size="xs" color="blue" leftSection={<IconCheck size={14} />} onClick={() => handleProject(b.id)}>
                          Proyectar
                        </Button>
                      ) : (
                        <Button size="xs" color="gray" variant="light" onClick={() => handleProject(b.id)}>
                          Volver a Proyectar
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

      </Tabs>
    </Container>
  );
}
