import React, { useState, useRef, useEffect } from 'react';
import { Container, Title, TextInput, Select, Button, Box, Group, FileInput, Text, Grid, Radio, Checkbox, Card, Image, Badge, Modal, ScrollArea, UnstyledButton, ActionIcon, Input } from '@mantine/core';
import { IconCamera, IconX, IconCheck, IconArrowLeft, IconArrowRight, IconCopy, IconPhoto, IconVideo } from '@tabler/icons-react';
import Webcam from 'react-webcam';
import axios from 'axios';
import QRCode from 'react-qr-code';
import { useNavigate } from 'react-router-dom';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { StepProgress } from './StepProgress';
import { ImageCropModal } from './ImageCropModal';
import { VideoTrimModal } from './VideoTrimModal';
import { fetchCountries } from './countries';
import './graffiti.css';
import './ledson-clean.css';
import { API_BASE_URL } from './config';

interface FilterOption {
  id: string;
  name: string;
  url: string;
  description?: string;
}

interface SellerOption {
  id: string;
  name: string;
}

const FILTER_STEP_LABELS = ['ELIGE EL ESTILO', 'DATOS Y COBRO', 'LA FOTO'];
const NO_FILTER_STEP_LABELS = ['DATOS Y COBRO', 'LA FOTO'];
const DOCUMENT_TYPE_OPTIONS = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'TI', label: 'Tarjeta de identidad' },
  { value: 'PA', label: 'Pasaporte' },
];

export function AssistedBookingForm() {
  const navigate = useNavigate();
  const [countries, setCountries] = useState<{ value: string; label: string }[]>([]);
  const [cities, setCities] = useState<{ value: string; label: string }[]>([]);
  const [isFetchingCities, setIsFetchingCities] = useState(false);
  const [cameraModalOpened, { open: openCameraModal, close: closeCameraModal }] = useDisclosure(false);
  const isMobile = useMediaQuery('(max-width: 50em)');
  const isDesktop = useMediaQuery('(min-width: 700px)');
  const isShort = useMediaQuery('(max-height: 800px)');
  const isVeryShort = useMediaQuery('(max-height: 560px)');
  const roomy = isDesktop && !isShort;
  const containerPy = isVeryShort ? 4 : roomy ? 40 : 10;
  const [useWebcam, setUseWebcam] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [fileImageBase64, setFileImageBase64] = useState<string | null>(null);
  // La webcam solo captura foto; el video únicamente se puede cargar desde
  // archivo (no se edita ni se le aplica generación de IA, solo se proyecta).
  const [fileMediaType, setFileMediaType] = useState<'image' | 'video'>('image');
  const [filters, setFilters] = useState<FilterOption[]>([]);
  const webcamRef = useRef<Webcam>(null);

  // Recorte interactivo de la foto (webcam o archivo) y selección de tramo
  // del video (máx. 15s), en vez de recortar/limitar automáticamente sin que
  // el vendedor/cliente vean nada.
  const [imageCropModalOpened, setImageCropModalOpened] = useState(false);
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null);
  const [videoTrimModalOpened, setVideoTrimModalOpened] = useState(false);
  const [rawVideoFile, setRawVideoFile] = useState<File | null>(null);
  const [videoTrim, setVideoTrim] = useState<{ trimStart: number; trimEnd: number } | null>(null);

  const [name, setName] = useState('');
  const [docType, setDocType] = useState<string | null>(null);
  const [docId, setDocId] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [availableSlots, setAvailableSlots] = useState<{ value: string; label: string }[]>([]);
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [currentFranja, setCurrentFranja] = useState<string | null>(null);
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [sellerId, setSellerId] = useState<string | null>(null);
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
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    fetchCountries().then(setCountries).catch((err) => console.error('Error fetching countries', err));
    axios.get(`${API_BASE_URL}/api/images`).then((res) => {
      setFilters(res.data.map((img: any) => ({ id: img._id, name: img.label || img.altText, url: img.imageUrl, description: img.description || '' })));
    });
    axios.get(`${API_BASE_URL}/api/schedules/settings`).then((res) => {
      if (res.data && res.data.bookingSystemType) setBookingSystemType(res.data.bookingSystemType);
    });
    axios.get(`${API_BASE_URL}/api/plans/settings`).then((res) => {
      setFiltersEnabled(res.data?.filtersEnabled ?? true);
      setServicePrice(res.data?.price ?? 15000);
    });
    axios.get(`${API_BASE_URL}/api/sellers`).then((res) => {
      setSellers(res.data.map((s: any) => ({ id: s._id, name: s.name })));
    });
  }, []);

  // Política de filtros desactivada: el paso "elegir filtro" no existe en el
  // flujo, así que si por cualquier motivo el terminal cae en activeStep 0
  // (valor inicial, o "Registrar nuevo cliente") lo saltamos directo a datos.
  useEffect(() => {
    if (!filtersEnabled && activeStep === 0) setActiveStep(1);
  }, [filtersEnabled, activeStep]);

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

  // En modo "franjas" el backend auto-asigna la primera franja con cupo al
  // crear la reserva (sin pedirle selección al admin, ver createBooking en
  // el backend) — acá solo mostramos, a modo informativo para el staff, cuál
  // es la franja actual mientras se toma/carga la foto. Por eso no hay
  // selector para cambiarla, a diferencia de BookingForm (que sí permite
  // elegir porque ahí el usuario paga por adelantado).
  useEffect(() => {
    if (bookingSystemType !== 'franjas' || activeStep !== 2) return;

    const fetchFranjas = () => {
      axios.get(`${API_BASE_URL}/api/bookings/franjas`)
        .then((res) => {
          const current = (res.data?.franjas || []).find((f: any) => f.isCurrent);
          if (current) setCurrentFranja(current.timeSlot);
        })
        .catch((err) => console.error('Error fetching franjas', err));
    };

    fetchFranjas();
    const interval = setInterval(fetchFranjas, 20000);
    return () => clearInterval(interval);
  }, [bookingSystemType, activeStep]);

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
    if (imageSrc) {
      closeCameraModal();
      setRawImageForCrop(imageSrc);
      setImageCropModalOpened(true);
    }
  };

  const MAX_VIDEO_MB = 80;

  const handleFileChange = (file: File | null) => {
    if (file) {
      const isVideo = file.type.startsWith('video/');
      if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) {
        alert(`El video pesa demasiado (máximo ${MAX_VIDEO_MB}MB). Elige uno más liviano.`);
        return;
      }
      setFileMediaType(isVideo ? 'video' : 'image');
      if (isVideo) {
        setRawVideoFile(file);
        setVideoTrimModalOpened(true);
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setRawImageForCrop(reader.result as string);
          setImageCropModalOpened(true);
        };
        reader.readAsDataURL(file);
      }
    } else {
      setFileImageBase64(null);
      setFileMediaType('image');
      setVideoTrim(null);
    }
  };

  // La foto queda recortada exactamente por lo que se eligió en
  // ImageCropModal (siempre cuadrada, 512x512 — la misma proporción que ya
  // recibía la IA externa, sin arriesgar su compatibilidad).
  const handleImageCropConfirm = (croppedBase64: string) => {
    if (useWebcam) setCapturedImage(croppedBase64);
    else setFileImageBase64(croppedBase64);
    setImageCropModalOpened(false);
    setRawImageForCrop(null);
  };

  const handleImageCropCancel = () => {
    setImageCropModalOpened(false);
    setRawImageForCrop(null);
    if (useWebcam) setUseWebcam(false);
  };

  // El tramo elegido (trimStart/trimEnd) se guarda como metadato junto al
  // video completo — no se recorta/recodifica el archivo en el navegador.
  const handleVideoTrimConfirm = (trim: { trimStart: number; trimEnd: number }) => {
    if (!rawVideoFile) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFileImageBase64(reader.result as string);
      setVideoTrim(trim);
    };
    reader.readAsDataURL(rawVideoFile);
    setVideoTrimModalOpened(false);
    setRawVideoFile(null);
  };

  const handleVideoTrimCancel = () => {
    setVideoTrimModalOpened(false);
    setRawVideoFile(null);
    setFileMediaType('image');
  };

  const handleDataSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filtersEnabled && filters.length > 0 && !selectedFilter) return alert('Debes seleccionar un filtro primero.');
    if (!habeasData) return alert('Debes aceptar la política de datos.');
    setActiveStep(2);
  };

  const submitPhotoAndConfirm = async () => {
    const finalImage = useWebcam ? capturedImage : fileImageBase64;
    if (!finalImage) return alert('Por favor, tómate una foto o sube un archivo.');
    const isVideo = !useWebcam && fileMediaType === 'video';
    setIsUploadingPhoto(true);
    try {
      // La foto ya llega recortada por ImageCropModal; el video no se edita
      // ni se recomprime, solo se envía junto con el tramo elegido.
      const res = await axios.post(`${API_BASE_URL}/api/bookings`, {
        name, docId, email, whatsapp, country, city, selectedFilter, timeSlot, bookingDate,
        imageBase64: finalImage, paymentMethod, requiresInvoice: requiresInvoice === 'SI', sellerId,
        ...(isVideo && videoTrim ? { trimStart: videoTrim.trimStart, trimEnd: videoTrim.trimEnd } : {}),
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

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  // La webcam siempre captura foto; el video solo puede venir de un archivo.
  const isVideoSelected = !useWebcam && fileMediaType === 'video';

  return (
    <Box className="ledson-bg-white ledson-booking-wrap">

      <div className="paint-particles ledson-bubbles">
        <span className="particle" />
        <span className="particle" />
        <span className="particle" />
        <span className="particle" />
        <span className="particle" />
        <span className="particle" />
        <span className="particle" />
        <span className="particle" />
        <span className="particle" />
        <span className="particle" />
        <span className="particle" />
        <span className="particle" />
      </div>

      <Container size="md" py={containerPy} px={{ base: 'xs', sm: 'md' }} style={{ position: 'relative', zIndex: 2 }}>
        <Title order={2} ta="center" className="ledson-title">
          Reserva Asistida
        </Title>
        <Text ta="center" className="ledson-subtitle">
          Estand físico — Galería Renacer
        </Text>

        <StepProgress
          activeStep={activeStep}
          filtersEnabled={filtersEnabled}
          labelsWithFilter={FILTER_STEP_LABELS}
          labelsWithoutFilter={NO_FILTER_STEP_LABELS}
          onStepClick={setActiveStep}
          onHomeClick={() => navigate('/')}
        />

        {/* STEP 1: FILTERS (solo si la política de filtros está activa) */}
        {filtersEnabled && activeStep === 0 && (
          <Box className="ledson-card">
            <Text className="ledson-section-title">1. Selecciona el estilo que el cliente desea</Text>
            <Text className="ledson-step-subtitle">Este será el filtro que se aplicará a su fotografía.</Text>
            {filters.length === 0 ? (
              <Text c="dimmed" ta="center" mb="md">No hay filtros activos en este momento.</Text>
            ) : (
              <Grid gap={12} mb={22}>
                {filters.map(f => (
                  <Grid.Col span={6} key={f.id}>
                    <Card
                      className="ledson-filter-card"
                      data-selected={selectedFilter === f.id}
                      onClick={() => setSelectedFilter(f.id)}
                    >
                      <Card.Section>
                        <Image src={f.url} alt={f.name} />
                      </Card.Section>
                      <Text className="ledson-filter-card-name">{f.name}</Text>
                      {f.description && (
                        <Text className="ledson-filter-card-desc">{f.description}</Text>
                      )}
                      {selectedFilter === f.id && (
                        <Badge className="ledson-badge-selected" variant="filled" style={{ position: 'absolute', top: 14, right: 14 }}>
                          <IconCheck size={13} />
                        </Badge>
                      )}
                    </Card>
                  </Grid.Col>
                ))}
              </Grid>
            )}
            <Button
              fullWidth
              className="ledson-btn-primary"
              rightSection={<IconArrowRight size={20} />}
              disabled={filtersEnabled && filters.length > 0 && !selectedFilter}
              onClick={() => setActiveStep(1)}
            >
              Continuar
            </Button>
          </Box>
        )}

        {/* STEP 2: DATOS Y COBRO */}
        {activeStep === 1 && (
          <Box component="form" onSubmit={handleDataSubmit} className="ledson-card">
            <Text className="ledson-section-title">{filtersEnabled ? 2 : 1}. Registro de datos y cobro</Text>
            <Text className="ledson-step-subtitle">Completa los datos del cliente y registra el pago recibido en el estand.</Text>
            <Grid>
              <Grid.Col span={12}>
                <TextInput label="Nombre completo" placeholder="Juan Pérez" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
              </Grid.Col>
              <Grid.Col span={12}>
                <Input.Wrapper label="Documento de identidad" required>
                  <Grid gap="xs" mt={4}>
                    <Grid.Col span={5}>
                      <Select placeholder="Tipo" data={DOCUMENT_TYPE_OPTIONS} required value={docType} onChange={setDocType} />
                    </Grid.Col>
                    <Grid.Col span={7}>
                      <TextInput placeholder="Número de documento" required value={docId} onChange={(e) => setDocId(e.currentTarget.value)} />
                    </Grid.Col>
                  </Grid>
                </Input.Wrapper>
              </Grid.Col>
              <Grid.Col span={12}>
                <TextInput type="email" label="Correo Electrónico" placeholder="tucorreo@email.com" required value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
              </Grid.Col>
              <Grid.Col span={12}>
                <Input.Wrapper label="Nacionalidad" required>
                  <Grid gap="xs" mt={4}>
                    <Grid.Col span={6}>
                      <Select placeholder="País" data={countries} searchable required value={country} onChange={handleCountryChange} />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Select placeholder="Ciudad" data={cities} searchable disabled={!country || isFetchingCities} required value={city} onChange={(val) => setCity(val || '')} />
                    </Grid.Col>
                  </Grid>
                </Input.Wrapper>
              </Grid.Col>
              <Grid.Col span={12}>
                <TextInput label="Número de celular" required placeholder="+573001234567" value={whatsapp} onChange={(e) => setWhatsapp(e.currentTarget.value)} />
              </Grid.Col>

              {bookingSystemType === 'slots' && (
                <>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput type="date" label="Fecha de reserva" required value={bookingDate} onChange={(e) => setBookingDate(e.currentTarget.value)} min={new Date().toISOString().split('T')[0]} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select label="Franja horaria a elegir" placeholder="Selecciona la hora" data={availableSlots} required value={timeSlot} onChange={setTimeSlot} disabled={availableSlots.length === 0} />
                  </Grid.Col>
                </>
              )}

              <Grid.Col span={12}>
                <Select
                  label="Vendedor que atiende"
                  placeholder="Selecciona un vendedor (opcional)"
                  data={sellers.map(s => ({ value: s.id, label: s.name }))}
                  value={sellerId}
                  onChange={setSellerId}
                  clearable
                  disabled={sellers.length === 0}
                />
              </Grid.Col>

              <Grid.Col span={12}>
                <Text size="sm" fw={500} mb={4} style={{ color: '#33363b' }}>Valor del servicio a cobrar</Text>
                <Text size="xl" fw={700} mb="sm" style={{ color: '#0559A5' }}>${servicePrice.toLocaleString('es-CO')} COP</Text>
              </Grid.Col>
              <Grid.Col span={12}>
                <Select label="Método de pago físico recibido" placeholder="Efectivo, Datáfono o QR" data={['Efectivo', 'Datáfono', 'QR']} required value={paymentMethod} onChange={(val) => val && setPaymentMethod(val)} />
              </Grid.Col>
              <Grid.Col span={12}>
                <Radio.Group label="¿Requiere factura electrónica?" withAsterisk value={requiresInvoice} onChange={setRequiresInvoice}>
                  <Group mt="xs"><Radio value="SI" label="Sí" /><Radio value="NO" label="No" /></Group>
                </Radio.Group>
              </Grid.Col>

              <Grid.Col span={12} mt="sm">
                <Checkbox
                  size="xs"
                  label={<Text size="xs">Acepto la <a href="#" onClick={(e) => { e.preventDefault(); setTermsModalOpen(true); }} style={{ color: '#0559A5' }}>Política de Tratamiento de Datos Personales</a> y los <a href="#" onClick={(e) => { e.preventDefault(); setTermsModalOpen(true); }} style={{ color: '#0559A5' }}>Términos y Condiciones</a> de LED'S ON</Text>}
                  checked={habeasData}
                  onChange={(event) => setHabeasData(event.currentTarget.checked)}
                  required
                />
              </Grid.Col>

              <Grid.Col span={12}>
                <Group justify="space-between" mt="md">
                  <Button
                    className="ledson-btn-outline ledson-btn-back"
                    onClick={() => (filtersEnabled ? setActiveStep(0) : navigate('/'))}
                    aria-label="Volver"
                  >
                    <IconArrowLeft size={18} />
                  </Button>
                  <Button
                    type="submit"
                    className="ledson-btn-primary"
                    style={{ flex: 1 }}
                    rightSection={<IconArrowRight size={20} />}
                  >
                    Continuar a la Foto
                  </Button>
                </Group>
              </Grid.Col>
            </Grid>
          </Box>
        )}

        {/* STEP 3: CAPTURA DE FOTO */}
        {activeStep === 2 && (
          <Box className="ledson-card">
            <Text className="ledson-section-title">Captura de la foto</Text>
            <Text className="ledson-step-subtitle">El cliente ya está registrado. Toma la foto o carga el archivo ahora.</Text>

            {!((!useWebcam && fileImageBase64) || (useWebcam && capturedImage)) && (
              <Grid mb={20} gap={12}>
                <Grid.Col span={4}>
                  <UnstyledButton
                    className="ledson-upload-card"
                    onClick={() => { setUseWebcam(true); openCameraModal(); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}
                  >
                    <Box className="ledson-upload-icon"><IconCamera size={20} /></Box>
                    <Text size="sm" fw={500} style={{ color: '#33363b' }}>Tomar Selfie</Text>
                  </UnstyledButton>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Box
                    className="ledson-upload-card"
                    style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Box className="ledson-upload-icon"><IconPhoto size={18} /></Box>
                    <Text size="sm" fw={500} style={{ color: '#33363b' }}>Subir Foto</Text>
                    <FileInput
                      key={fileImageBase64 ? 'loaded' : 'empty'}
                      accept="image/*"
                      onChange={(file) => { setUseWebcam(false); handleFileChange(file); }}
                      variant="unstyled"
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Box
                    className="ledson-upload-card"
                    style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Box className="ledson-upload-icon"><IconVideo size={18} /></Box>
                    <Text size="sm" fw={500} style={{ color: '#33363b' }}>Subir Video</Text>
                    <FileInput
                      key={fileImageBase64 ? 'loaded' : 'empty'}
                      accept="video/*"
                      onChange={(file) => { setUseWebcam(false); handleFileChange(file); }}
                      variant="unstyled"
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    />
                  </Box>
                </Grid.Col>
              </Grid>
            )}

            {!((!useWebcam && fileImageBase64) || (useWebcam && capturedImage)) && (
              <Text size="xs" c="dimmed" ta="center" mb={16}>
                Si vas a subir un video, se recomienda que sea en formato vertical: se proyectará en una pantalla vertical.
              </Text>
            )}

            {((!useWebcam && fileImageBase64) || (useWebcam && capturedImage)) && (
              <Box mb={18}>
                <Box className="ledson-preview-wrap">
                  {isVideoSelected ? (
                    <video src={fileImageBase64 as string} controls />
                  ) : (
                    <img src={(useWebcam ? capturedImage : fileImageBase64) as string} alt="Preview" />
                  )}
                </Box>
                <Button
                  className="ledson-preview-remove-btn"
                  leftSection={<IconX size={14} />}
                  onClick={() => { setCapturedImage(null); setFileImageBase64(null); setFileMediaType('image'); setUseWebcam(false); }}
                >
                  Quitar {isVideoSelected ? 'video' : 'imagen'}
                </Button>
              </Box>
            )}

            {bookingSystemType === 'franjas' && (
              <Text size="sm" mb="md" style={{ color: '#33363b' }}>
                Horario aproximado de publicación:{' '}
                <Text span fw={700} style={{ color: '#0559A5' }}>
                  {currentFranja ? currentFranja.replace('-', ' - ') : '...'}
                </Text>
              </Text>
            )}

            <Text size="sm" fw={500} mb="md" style={{ color: '#0559A5' }}>
              {isVideoSelected ? 'Tu video está listo para proyectarse en pantalla' : 'Estamos listos para agregar la magia de la comuna 13'}
            </Text>
            <Group gap={10}>
              <Button className="ledson-btn-outline ledson-btn-back" onClick={() => setActiveStep(1)} aria-label="Volver">
                <IconArrowLeft size={18} />
              </Button>
              <Button
                className="ledson-btn-primary"
                style={{ flex: 1 }}
                loading={isUploadingPhoto}
                onClick={submitPhotoAndConfirm}
                disabled={(!useWebcam && !fileImageBase64) || (useWebcam && !capturedImage)}
              >
                Finalizar y Reservar Turno
              </Button>
            </Group>
          </Box>
        )}

        {/* STEP 4: RESULTADO */}
        {activeStep === 3 && (
          <Box className="ledson-card ledson-card--center">
            <Box className="ledson-result-icon"><IconCheck size={28} /></Box>
            <Title order={3} mb="md" className="ledson-section-title">¡Reserva Asistida Completada!</Title>

            {finalResult?.queuePosition && (
              <Text size="xl" fw={700} style={{ color: '#0559A5' }} mb="xs">
                Turno del cliente en la fila: #{finalResult.queuePosition}
              </Text>
            )}
            {finalResult?.timeSlot && (
              <Text size="sm" mb="xs" style={{ color: '#33363b' }}>
                Horario reservado: <Text span fw={700} style={{ color: '#0559A5' }}>{finalResult.timeSlot.replace('-', ' - ')}</Text>
              </Text>
            )}
            {finalResult?.exactTime && finalResult.exactTime !== 'Sin asignar' && finalResult.exactTime !== 'Agotado/Lleno' ? (
              <Text size="sm" mb="lg" style={{ color: '#33363b' }}>
                Hora asignada para la proyección: <Text span fw={700} style={{ color: '#0559A5' }}>~{finalResult.exactTime}</Text>
              </Text>
            ) : (
              <Text size="sm" mb="lg" style={{ color: '#33363b' }}>
                Hora asignada para la proyección: <Text span fw={700} style={{ color: '#0559A5' }}>Sin asignar</Text>
              </Text>
            )}

            {finalResult?.code && (
              <Box mb="lg">
                <Text size="xs" c="dimmed" mb={6}>Código de reserva del cliente</Text>
                <Group justify="center" gap={8} wrap="nowrap">
                  <Box className="ledson-code-box">{finalResult.code}</Box>
                  <ActionIcon
                    variant="light"
                    color="blue"
                    size={38}
                    radius="md"
                    onClick={() => handleCopyCode(finalResult.code)}
                    aria-label="Copiar código"
                  >
                    {codeCopied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                  </ActionIcon>
                </Group>
              </Box>
            )}

            <Text size="sm" c="dimmed" mb="md">
              Pídele al cliente que guarde el código o escanee el QR para revisar su reserva en /my-bookings.
            </Text>
            <Box style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '1.5rem' }}>
              <QRCode value={`${window.location.origin}/my-bookings`} size={140} />
            </Box>

            <Text size="sm" fw={500} mb="xs" style={{ color: '#33363b' }}>
              ¿Registrar al siguiente cliente?
            </Text>
            <Button
              fullWidth
              className="ledson-btn-primary"
              leftSection={<IconArrowLeft size={18} />}
              onClick={() => window.location.reload()}
            >
              Registrar Nuevo Cliente
            </Button>
          </Box>
        )}

        <Modal
          opened={cameraModalOpened}
          onClose={closeCameraModal}
          fullScreen={isMobile}
          size="xl"
          title="Acomoda tu mejor pose"
          className="ledson-modal"
          styles={{ body: { height: isMobile ? 'calc(100vh - 60px)' : 'auto', display: 'flex', flexDirection: 'column' } }}
        >
          <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Box style={{ width: '100%', maxWidth: '600px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000' }}>
              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: 'user', height: 720 }} style={{ width: '100%', height: '60vh', objectFit: 'cover', display: 'block' }} />
            </Box>
            <Button className="ledson-btn-primary" mt="xl" onClick={capture} leftSection={<IconCamera size={20} />}>
              Capturar
            </Button>
          </Box>
        </Modal>

        <ImageCropModal
          opened={imageCropModalOpened}
          imageSrc={rawImageForCrop}
          aspect={1}
          outputWidth={512}
          outputHeight={512}
          onCancel={handleImageCropCancel}
          onConfirm={handleImageCropConfirm}
        />
        <VideoTrimModal
          opened={videoTrimModalOpened}
          file={rawVideoFile}
          maxSeconds={15}
          onCancel={handleVideoTrimCancel}
          onConfirm={handleVideoTrimConfirm}
        />

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
            <Button className="ledson-btn-primary" onClick={() => { setHabeasData(true); setTermsModalOpen(false); }}>Aceptar</Button>
          </Group>
        </Modal>
      </Container>
    </Box>
  );
}
