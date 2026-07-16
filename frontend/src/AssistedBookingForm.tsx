import React, { useState, useRef, useEffect } from 'react';
import { Container, Title, TextInput, Select, Button, Box, Group, FileInput, Text, Grid, Radio, Checkbox, Card, Image, Stepper, Badge, Modal, ScrollArea } from '@mantine/core';
import { IconCamera, IconUpload, IconDeviceFloppy, IconCheck, IconX } from '@tabler/icons-react';
import Webcam from 'react-webcam';
import axios from 'axios';
import QRCode from 'react-qr-code';
import { API_BASE_URL } from './config';

interface FilterOption {
  id: string;
  name: string;
  url: string;
}

export function AssistedBookingForm() {
  const [countries, setCountries] = useState<{ value: string; label: string }[]>([]);
  const [cities, setCities] = useState<{ value: string; label: string }[]>([]);
  const [isFetchingCities, setIsFetchingCities] = useState(false);
  const [useWebcam, setUseWebcam] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [fileImageBase64, setFileImageBase64] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOption[]>([]);
  const webcamRef = useRef<Webcam>(null);

  const [name, setName] = useState('');
  const [docId, setDocId] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [availableSlots, setAvailableSlots] = useState<{ value: string; label: string }[]>([]);
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [requiresInvoice, setRequiresInvoice] = useState('NO');
  const [habeasData, setHabeasData] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [bookingSystemType, setBookingSystemType] = useState('slots');
  const [filtersEnabled, setFiltersEnabled] = useState(true);
  const [servicePrice, setServicePrice] = useState(15000);

  const [activeStep, setActiveStep] = useState(0);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [finalResult, setFinalResult] = useState<any>(null);

  useEffect(() => {
    axios.get('https://countriesnow.space/api/v0.1/countries').then((res) => {
      if (!res.data.error) {
        setCountries(res.data.data.map((item: any) => ({ value: item.country, label: item.country })));
      }
    });
    axios.get(`${API_BASE_URL}/api/images`).then((res) => {
      setFilters(res.data.map((img: any) => ({ id: img._id, name: img.label || img.altText, url: img.imageUrl })));
    });
    axios.get(`${API_BASE_URL}/api/schedules/settings`).then((res) => {
      if (res.data && res.data.bookingSystemType) setBookingSystemType(res.data.bookingSystemType);
    });
    axios.get(`${API_BASE_URL}/api/plans/settings`).then((res) => {
      setFiltersEnabled(res.data?.filtersEnabled ?? true);
      setServicePrice(res.data?.price ?? 15000);
    });
  }, []);

  useEffect(() => {
    if (bookingDate) {
      axios.get(`${API_BASE_URL}/api/schedules/daily?date=${bookingDate}`)
        .then((res) => {
          let slots = res.data.slots || [];
          if (slots.length === 0) {
            slots = [
              { startTime: '20:00', endTime: '21:00' },
              { startTime: '21:00', endTime: '22:00' },
              { startTime: '22:00', endTime: '23:00' },
              { startTime: '23:00', endTime: '00:00' }
            ];
          }
          const today = new Date();
          today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
          if (bookingDate === today.toISOString().split('T')[0]) {
            const now = new Date();
            const currentHour = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
            slots = slots.filter((s: any) => (s.endTime === '00:00' ? '24:00' : s.endTime) > currentHour);
          }
          setAvailableSlots(slots.map((s: any) => ({ value: `${s.startTime}-${s.endTime}`, label: `${s.startTime} - ${s.endTime}` })));
          setTimeSlot(null);
        }).catch(() => setAvailableSlots([]));
    }
  }, [bookingDate]);

  const handleCountryChange = (selectedCountry: string | null) => {
    setCountry(selectedCountry);
    setCity(''); setCities([]);
    if (selectedCountry) {
      setIsFetchingCities(true);
      axios.post('https://countriesnow.space/api/v0.1/countries/cities', { country: selectedCountry }).then((res) => {
        if (!res.data.error) setCities(res.data.data.map((cityName: string) => ({ value: cityName, label: cityName })));
      }).finally(() => setIsFetchingCities(false));
    }
  };

  const capture = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) setCapturedImage(imageSrc);
  };

  const handleFileChange = (file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFileImageBase64(reader.result as string);
      reader.readAsDataURL(file);
    } else setFileImageBase64(null);
  };

  const resizeImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const size = Math.min(img.width, img.height);
          const x = (img.width - size) / 2; // Center horizontally
          const y = 0; // Top vertically, cropping the bottom
          ctx.drawImage(img, x, y, size, size, 0, 0, 512, 512);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handleDataSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filtersEnabled && filters.length > 0 && !selectedFilter) return alert('Debes seleccionar un filtro primero.');
    if (!habeasData) return alert('Debes aceptar la política de datos.');
    setActiveStep(2);
  };

  const submitPhotoAndConfirm = async () => {
    let finalImage = useWebcam ? capturedImage : fileImageBase64;
    if (!finalImage) return alert('Por favor, tómate una foto o sube un archivo.');
    setIsUploadingPhoto(true);
    try {
      finalImage = await resizeImage(finalImage);
      const res = await axios.post(`${API_BASE_URL}/api/bookings`, {
        name, docId, email, whatsapp, country, city, selectedFilter, timeSlot, bookingDate,
        imageBase64: finalImage, paymentMethod, requiresInvoice: requiresInvoice === 'SI'
      });
      setFinalResult(res.data);
      setActiveStep(3);
    } catch (error) {
      console.error(error);
      alert('Hubo un error guardando tus datos.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <Container size="md" py="xl">
      <Title order={2} ta="center" mb="md" c="grape.7">Reserva Asistida (Terminal Físico)</Title>
      <Stepper active={activeStep} onStepClick={setActiveStep} allowNextStepsSelect={false} mb="xl">
        <Stepper.Step label="Estilo" description="Elegir filtro" />
        <Stepper.Step label="Datos" description="Registro y pago" />
        <Stepper.Step label="Foto" description="Toma fotográfica" />
        <Stepper.Step label="Resultado" description="Turno asignado" />
      </Stepper>

      {activeStep === 0 && (
        <Box>
          <Text ta="center" size="lg" mb="md" fw={500}>1. Selecciona el estilo que el cliente desea</Text>
          {filters.length === 0 ? <Text c="dimmed" ta="center">No hay filtros activos.</Text> : (
            <Grid>
              {filters.map(f => (
                <Grid.Col span={{ base: 6, sm: 4 }} key={f.id}>
                  <Card shadow="sm" padding="sm" radius="md" withBorder style={{ cursor: 'pointer', borderColor: selectedFilter === f.id ? '#be4bdb' : '#e9ecef', borderWidth: selectedFilter === f.id ? '2px' : '1px', transform: selectedFilter === f.id ? 'scale(1.02)' : 'scale(1)', transition: 'all 0.2s ease' }} onClick={() => setSelectedFilter(f.id)}>
                    <Card.Section><Image src={f.url} height={160} alt={f.name} /></Card.Section>
                    <Text fw={500} ta="center" mt="md">{f.name}</Text>
                    {selectedFilter === f.id && <Badge color="grape" variant="filled" style={{ position: 'absolute', top: 10, right: 10 }}><IconCheck size={14} /></Badge>}
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          )}
          <Group justify="center" mt="xl">
            <Button size="lg" color="grape" onClick={() => { if(filtersEnabled && filters.length > 0 && !selectedFilter) return alert('Selecciona un filtro'); setActiveStep(1); }}>Siguiente Paso</Button>
          </Group>
        </Box>
      )}

      {activeStep === 1 && (
        <Box component="form" onSubmit={handleDataSubmit} style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <Text fw={500} size="lg" mb="md">2. Registro de datos del cliente</Text>
          <Grid>
            <Grid.Col span={12}><TextInput label="Nombre completo" required value={name} onChange={(e) => setName(e.currentTarget.value)} /></Grid.Col>
            <Grid.Col span={12}><TextInput label="ID / Cédula" required value={docId} onChange={(e) => setDocId(e.currentTarget.value)} /></Grid.Col>
            <Grid.Col span={12}><TextInput type="email" label="Correo Electrónico" required value={email} onChange={(e) => setEmail(e.currentTarget.value)} /></Grid.Col>
            <Grid.Col span={12}><TextInput label="WhatsApp (Celular)" required placeholder="Ej: +573001234567" value={whatsapp} onChange={(e) => setWhatsapp(e.currentTarget.value)} /></Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}><Select label="Nacionalidad (País)" placeholder="Selecciona país" data={countries} searchable required value={country} onChange={handleCountryChange} /></Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}><Select label="Ciudad" placeholder={country ? "Selecciona ciudad" : "Primero selecciona un país"} data={cities} searchable disabled={!country || isFetchingCities} required value={city} onChange={(val) => setCity(val || '')} /></Grid.Col>

            {bookingSystemType === 'slots' && (
              <>
                <Grid.Col span={{ base: 12, sm: 6 }}><TextInput type="date" label="Fecha de reserva" required value={bookingDate} onChange={(e) => setBookingDate(e.currentTarget.value)} min={new Date().toISOString().split('T')[0]} /></Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}><Select label="Franja horaria a elegir" placeholder="Selecciona la hora" data={availableSlots} required value={timeSlot} onChange={setTimeSlot} disabled={availableSlots.length === 0} /></Grid.Col>
              </>
            )}

            <Grid.Col span={12}>
              <Text size="sm" fw={500} mb={4}>Valor del servicio a cobrar</Text>
              <Text size="xl" fw={700} c="grape.7" mb="sm">${servicePrice.toLocaleString('es-CO')} COP</Text>
            </Grid.Col>
            <Grid.Col span={12}><Select label="Método de pago físico recibido" placeholder="Efectivo, Datáfono o QR" data={['Efectivo', 'Datáfono', 'QR']} required value={paymentMethod} onChange={(val) => val && setPaymentMethod(val)} /></Grid.Col>
            <Grid.Col span={12}>
              <Radio.Group label="¿Requiere factura electrónica?" withAsterisk value={requiresInvoice} onChange={setRequiresInvoice}>
                <Group mt="xs"><Radio value="SI" label="Sí" /><Radio value="NO" label="No" /></Group>
              </Radio.Group>
            </Grid.Col>
            <Grid.Col span={12} mt="sm">
              <Checkbox
                label={<Text size="sm">Acepto los <a href="#" onClick={(e) => { e.preventDefault(); setTermsModalOpen(true); }} style={{ color: '#228be6' }}>términos y condiciones y la política de tratamiento de datos personales</a>.</Text>}
                checked={habeasData}
                onChange={(event) => setHabeasData(event.currentTarget.checked)}
                required
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Group justify="space-between" mt="md">
                <Button variant="default" onClick={() => setActiveStep(0)}>Volver</Button>
                <Button type="submit" size="lg" color="grape">Continuar a la Foto</Button>
              </Group>
            </Grid.Col>
          </Grid>
        </Box>
      )}

      {activeStep === 2 && (
        <Box style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <Title order={3} mb="sm" c="grape.7">Captura de la Foto</Title>
          <Text fw={500} size="lg" mb="xl">El cliente ya está registrado. Toma la foto ahora.</Text>
          <Group justify="center" mb="md">
            <Button variant={useWebcam ? 'filled' : 'outline'} color="grape" onClick={() => { setUseWebcam(true); setFileImageBase64(null); }} leftSection={<IconCamera size={16}/>}>Usar Cámara</Button>
            <FileInput key={fileImageBase64 ? 'loaded' : 'empty'} placeholder="Subir Archivo" accept="image/*" onChange={(file) => { setUseWebcam(false); handleFileChange(file); }} leftSection={<IconUpload size={16}/>} style={{ maxWidth: '200px' }} />
          </Group>
          {useWebcam && !capturedImage && (
            <Box style={{ position: 'relative', width: '100%', maxWidth: '400px', margin: '0 auto' }}>
              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', borderRadius: '8px' }} />
              <Button fullWidth mt="sm" color="grape" onClick={capture}>¡Capturar Ahora!</Button>
            </Box>
          )}
          {((!useWebcam && fileImageBase64) || (useWebcam && capturedImage)) && (
            <Box ta="center" mt="md" p="sm" style={{ border: '1px dashed #ccc', borderRadius: '8px', maxWidth: '300px', margin: '0 auto' }}>
              <Text size="xs" c="dimmed" mb="xs">Imagen seleccionada:</Text>
              <img src={(useWebcam ? capturedImage : fileImageBase64) as string} alt="Preview" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', objectFit: 'cover' }} />
              <Button fullWidth variant="light" color="red" mt="sm" leftSection={<IconX size={16} />} onClick={() => { setCapturedImage(null); setFileImageBase64(null); setUseWebcam(useWebcam); }}>Quitar imagen</Button>
            </Box>
          )}
          <Group justify="space-between" mt="xl">
             <Button variant="default" onClick={() => setActiveStep(1)} disabled={isUploadingPhoto}>Volver a Datos</Button>
             <Button size="lg" color="teal" loading={isUploadingPhoto} onClick={submitPhotoAndConfirm} disabled={(!useWebcam && !fileImageBase64) || (useWebcam && !capturedImage)} leftSection={<IconDeviceFloppy size={24} />}>Finalizar y Reservar Turno</Button>
          </Group>
        </Box>
      )}

      {activeStep === 3 && (
        <Box style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <Title order={3} mb="md" c="blue.7">¡Reserva Asistida Completada!</Title>
          {finalResult?.queuePosition && <Text size="xl" fw={700} c="dimmed" mb="xs">Turno del cliente en la fila: #{finalResult.queuePosition}</Text>}
          <Text size="lg" mb="xl">La hora asignada para la proyección es a las <Text span fw={700} c="blue">{finalResult?.exactTime || 'Sin asignar'}</Text>.</Text>
          <Text c="dimmed" mb="md">Pídele al cliente que guarde este QR o dígale que revise en la web con su cédula.</Text>
          <Box style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '2rem' }}>
            <QRCode value={`${window.location.origin}/my-bookings`} size={150} />
          </Box>
          <Group justify="center"><Button size="lg" onClick={() => window.location.reload()}>Registrar Nuevo Cliente</Button></Group>
        </Box>
      )}

      <Modal opened={termsModalOpen} onClose={() => setTermsModalOpen(false)} title="Términos y Condiciones - Política de Tratamiento de Datos Personales" size="lg" centered>
        <ScrollArea h={400} mb="md">
          <Text size="sm" mb="sm">
            Al participar en la experiencia "Led's on Renacer" de Galería Renacer, el cliente acepta los siguientes términos:
          </Text>
          <Text size="sm" fw={600} mt="md" mb="xs">1. Uso de la fotografía</Text>
          <Text size="sm" mb="sm">
            La fotografía capturada será procesada mediante un sistema de inteligencia artificial para generar una versión estilizada,
            la cual será proyectada en la pantalla principal del evento en el horario asignado, y posteriormente enviada al cliente por correo electrónico y/o WhatsApp.
          </Text>
          <Text size="sm" fw={600} mt="md" mb="xs">2. Tratamiento de datos personales (Habeas Data)</Text>
          <Text size="sm" mb="sm">
            Los datos personales suministrados (nombre, documento de identidad, correo electrónico, número de WhatsApp, país y ciudad)
            serán utilizados exclusivamente para la gestión de la reserva, la generación y entrega de la fotografía, y el envío de
            comunicaciones relacionadas con el evento, de conformidad con la Ley 1581 de 2012 y demás normas aplicables sobre protección de datos personales.
          </Text>
          <Text size="sm" mb="sm">
            El cliente podrá ejercer sus derechos de acceso, corrección, actualización y supresión de sus datos personales
            contactando a la organización del evento.
          </Text>
          <Text size="sm" fw={600} mt="md" mb="xs">3. Autorización de imagen</Text>
          <Text size="sm" mb="sm">
            El cliente autoriza a Galería Renacer el uso de su imagen fotográfica y su versión estilizada para su proyección
            en el evento y su envío personal, sin que esto implique un uso comercial adicional sin previa autorización expresa.
          </Text>
          <Text size="sm" fw={600} mt="md" mb="xs">4. Pagos</Text>
          <Text size="sm" mb="sm">
            El pago realizado por el servicio corresponde al derecho a participar en la experiencia fotográfica y no es reembolsable,
            salvo casos de fallas atribuibles a la organización.
          </Text>
        </ScrollArea>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setTermsModalOpen(false)}>Cerrar</Button>
          <Button color="grape" onClick={() => { setHabeasData(true); setTermsModalOpen(false); }}>Aceptar</Button>
        </Group>
      </Modal>
    </Container>
  );
}
