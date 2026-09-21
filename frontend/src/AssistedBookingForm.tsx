import React, { useState, useRef, useEffect } from 'react';
import { Container, Title, TextInput, Select, Button, Box, Group, FileInput, Text, Grid, Radio, Checkbox, Card, Image, Badge, Modal, UnstyledButton, ActionIcon, Input, Loader, Center, NumberInput } from '@mantine/core';
import { IconCamera, IconCheck, IconArrowLeft, IconArrowRight, IconCopy, IconPhoto, IconVideo } from '@tabler/icons-react';
import Webcam from 'react-webcam';
import { CameraView } from './CameraView';
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
import { API_BASE_URL, getLocalDateStr, getLegalLinks, PHOTO_QUALITY_SCALE, MAX_VIDEO_MB } from './config';
import { trackGtagEvent } from './analytics';

// Enlaces legales del formulario del stand físico: mismas páginas que el
// formulario público pero con utm_source=pos_sale.
const LEGAL_LINKS = getLegalLinks('pos_sale');

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

interface BenefitOption {
  id: string;
  name: string;
}

interface PaymentMethodOption {
  id: string;
  name: string;
}

const FILTER_STEP_LABELS = ['ELIGE EL ESTILO', 'DATOS Y COBRO', 'LA FOTO'];
const NO_FILTER_STEP_LABELS = ['DATOS Y COBRO', 'LA FOTO'];
const DOCUMENT_TYPE_OPTIONS = [
  { value: 'CC', label: 'C.C.' },
  { value: 'CE', label: 'C.E.' },
  { value: 'TI', label: 'T.I.' },
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
  const [videoTrim, setVideoTrim] = useState<{ trimStart: number; trimEnd: number; frameX?: number; frameY?: number; frameZoom?: number } | null>(null);
  const [cropWidth, setCropWidth] = useState(576);
  const [cropHeight, setCropHeight] = useState(1152);

  const [name, setName] = useState('');
  const [docType, setDocType] = useState<string | null>(null);
  const [docId, setDocId] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(getLocalDateStr());
  const [availableSlots, setAvailableSlots] = useState<{ value: string; label: string }[]>([]);
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [currentFranja, setCurrentFranja] = useState<string | null>(null);
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [benefits, setBenefits] = useState<BenefitOption[]>([]);
  const [benefitId, setBenefitId] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  // Lo escribe el vendedor a mano (puede ser 0 para cortesía) — nunca se
  // precarga desde el precio general, que es solo informativo acá al lado.
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [requiresInvoice, setRequiresInvoice] = useState('NO');
  const [habeasData, setHabeasData] = useState(false);
  const [bookingSystemType, setBookingSystemType] = useState('slots');
  // null = "aún no se sabe" (settings sin cargar); evita que el paso de
  // filtros aparezca y desaparezca de golpe mientras llega la respuesta.
  const [filtersEnabled, setFiltersEnabled] = useState<boolean | null>(null);
  const [servicePrice, setServicePrice] = useState(15000);

  const [activeStep, setActiveStep] = useState(0);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // Modo "franjas": tras crear la reserva se le asigna una franja automática,
  // pero el vendedor puede cambiarla desde el resultado (mismo endpoint
  // assign-franja que usa BookingForm cuando la franja elegida se llena).
  const [franjasAvailability, setFranjasAvailability] = useState<{ franjas: any[] } | null>(null);
  const [selectedNewFranja, setSelectedNewFranja] = useState<string | null>(null);
  const [isChangingFranja, setIsChangingFranja] = useState(false);

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
    axios.get(`${API_BASE_URL}/api/benefits`).then((res) => {
      setBenefits(res.data.map((b: any) => ({ id: b._id, name: b.name })));
    });
    axios.get(`${API_BASE_URL}/api/payment-methods`).then((res) => {
      const methods = res.data.map((m: any) => ({ id: m._id, name: m.name }));
      setPaymentMethods(methods);
      setPaymentMethod((prev) => prev ?? methods[0]?.name ?? null);
    });
    axios.get(`${API_BASE_URL}/api/bookings/screen-settings`).then((res) => {
      setCropWidth(res.data?.cropWidth || 576);
      setCropHeight(res.data?.cropHeight || 1152);
    });
  }, []);

  // Política de filtros desactivada: el paso "elegir filtro" no existe en el
  // flujo, así que si por cualquier motivo el terminal cae en activeStep 0
  // (valor inicial, o "Registrar nuevo cliente") lo saltamos directo a datos.
  useEffect(() => {
    if (filtersEnabled === false && activeStep === 0) setActiveStep(1);
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
          if (bookingDate === getLocalDateStr()) {
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

  // El tramo elegido (trimStart/trimEnd) y el encuadre (frameX/frameY/frameZoom)
  // se guardan como metadatos junto al video completo — no se recorta/recodifica
  // el archivo en el navegador.
  const handleVideoTrimConfirm = (trim: { trimStart: number; trimEnd: number; frameX?: number; frameY?: number; frameZoom?: number }) => {
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
    if (paidAmount === '' || paidAmount == null) return alert('Debes registrar el valor pagado (puede ser 0 para cortesía).');
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
        benefitId, paidAmount: paidAmount === '' ? null : paidAmount,
        ...(isVideo && videoTrim ? {
          trimStart: videoTrim.trimStart,
          trimEnd: videoTrim.trimEnd,
          frameX: videoTrim.frameX,
          frameY: videoTrim.frameY,
          frameZoom: videoTrim.frameZoom,
        } : {}),
      });
      setFinalResult(res.data);
      // Excluye PII (nombre, cédula, correo, celular) del evento. La moneda
      // se extrae del método de pago porque no hay un campo dedicado
      // ("Efectivo COP" / "Efectivo USD", etc.).
      trackGtagEvent('pos_sale', {
        transaction_id: res.data.code,
        value: paidAmount === '' ? 0 : paidAmount,
        currency: paymentMethod?.includes('USD') ? 'USD' : 'COP',
        payment_type: paymentMethod,
        vendor_name: sellers.find((s) => s.id === sellerId)?.name || '',
        promotion_name: benefits.find((b) => b.id === benefitId)?.name || '',
        nationality: country,
        city,
        items: [{
          item_id: selectedFilter || 'ledson-renacer-sin-filtro',
          item_name: filters.find((f) => f.id === selectedFilter)?.name || "Led's on Renacer",
          quantity: 1,
        }],
      });
      setActiveStep(3);
    } catch (error) {
      console.error(error);
      alert('Hubo un error guardando tus datos.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Al llegar al resultado en modo "franjas", se trae la disponibilidad para
  // que el vendedor pueda cambiar la franja asignada si no le sirve al cliente.
  useEffect(() => {
    if (bookingSystemType !== 'franjas' || activeStep !== 3) return;
    axios.get(`${API_BASE_URL}/api/bookings/franjas`)
      .then((res) => setFranjasAvailability(res.data))
      .catch((err) => console.error('Error fetching franjas', err));
  }, [bookingSystemType, activeStep]);

  const handleChangeFranja = async () => {
    if (!selectedNewFranja || !finalResult?.id) return;
    setIsChangingFranja(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/bookings/${finalResult.id}/assign-franja`, {
        timeSlot: selectedNewFranja,
      });
      if (res.data.franjaFull) {
        alert('Esa franja se acaba de llenar. Elige otra.');
        setFranjasAvailability(res.data.availableFranjas);
        setSelectedNewFranja(null);
      } else {
        setFinalResult((prev: any) => ({ ...prev, timeSlot: res.data.timeSlot, exactTime: res.data.exactTime }));
        setSelectedNewFranja(null);
      }
    } catch (err) {
      console.error('Error cambiando franja', err);
      alert('Hubo un error cambiando la franja.');
    } finally {
      setIsChangingFranja(false);
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

      <Container size="md" className="ledson-wrap-container" pt={containerPy} px={{ base: 'xs', sm: 'md' }} style={{ position: 'relative', zIndex: 2 }}>
        <Title order={2} ta="center" className="ledson-title">
          Reserva Asistida
        </Title>
        <Text ta="center" className="ledson-subtitle">
          Punto físico Galería Renacer
        </Text>

        <StepProgress
          activeStep={activeStep}
          filtersEnabled={filtersEnabled ?? true}
          labelsWithFilter={FILTER_STEP_LABELS}
          labelsWithoutFilter={NO_FILTER_STEP_LABELS}
          onStepClick={setActiveStep}
          onHomeClick={() => navigate('/')}
        />

        {/* Settings de plan aún sin cargar: no se sabe todavía si el paso de
            filtros existe, así que se muestra un loader en vez de arriesgarse
            a mostrar y luego ocultar el paso 1. */}
        {filtersEnabled === null && activeStep === 0 && (
          <Box className="ledson-card">
            <Center py="xl">
              <Loader color="blue" />
            </Center>
          </Box>
        )}

        {/* STEP 1: FILTERS (solo si la política de filtros está activa) */}
        {filtersEnabled === true && activeStep === 0 && (
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
            {/* El total de pasos siempre cuenta el paso de filtro aunque esté
                oculto (ver StepProgress.tsx), así que "Datos" siempre es el
                paso 2, con o sin filtro habilitado. */}
            <Text className="ledson-section-title">2. Registro de datos y cobro</Text>
            <Text className="ledson-step-subtitle">Completa los datos del cliente y registra el pago recibido en el estand.</Text>
            <Grid gap="sm">
              <Grid.Col span={12}>
                <TextInput label="Nombre completo" placeholder="Tu nombre" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
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
                <TextInput type="email" label="Correo electrónico" placeholder="tucorreo@email.com" required value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
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
                <TextInput label="Número de celular" required placeholder="Tu número" value={whatsapp} onChange={(e) => setWhatsapp(e.currentTarget.value)} />
              </Grid.Col>

              {bookingSystemType === 'slots' && (
                <>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput type="date" label="Fecha de reserva" required value={bookingDate} onChange={(e) => setBookingDate(e.currentTarget.value)} min={getLocalDateStr()} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select label="Franja horaria a elegir" placeholder="Selecciona la hora" data={availableSlots} required value={timeSlot} onChange={setTimeSlot} disabled={availableSlots.length === 0} />
                  </Grid.Col>
                </>
              )}

              <Grid.Col span={12}>
                <Text size="sm" fw={500} mb={4} style={{ color: '#33363b' }}>Precio de venta de referencia</Text>
                <Text size="xl" fw={700} mb="sm" style={{ color: '#0559A5' }}>${servicePrice.toLocaleString('es-CO')} COP</Text>
              </Grid.Col>

              <Grid.Col span={6}>
                <Select
                  label="Método de pago"
                  placeholder="Selecciona el método de pago"
                  data={paymentMethods.map(m => ({ value: m.name, label: m.name }))}
                  required
                  value={paymentMethod}
                  onChange={(val) => val && setPaymentMethod(val)}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Vendedor"
                  placeholder="vendedor"
                  data={sellers.map(s => ({ value: s.id, label: s.name }))}
                  value={sellerId}
                  onChange={setSellerId}
                  clearable
                  disabled={sellers.length === 0}
                />
              </Grid.Col>

              <Grid.Col span={6}>
                <NumberInput
                  label="Valor pagado"
                  //description="Monto realmente recibido (puede ser 0 en caso de cortesía). No viene precargado del precio general."
                  placeholder="Ej. $10.000"
                  required
                  min={0}
                  hideControls
                  prefix="$"
                  value={paidAmount}
                  onChange={(val) => setPaidAmount(val === '' ? '' : Number(val))}
                  thousandSeparator="."
                  decimalSeparator=","
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Beneficio / Promoción"
                  placeholder="beneficio "
                  data={benefits.map(b => ({ value: b.id, label: b.name }))}
                  value={benefitId}
                  onChange={setBenefitId}
                  clearable
                  disabled={benefits.length === 0}
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Radio.Group label="¿Requiere factura electrónica?" withAsterisk value={requiresInvoice} onChange={setRequiresInvoice}>
                  <Group mt="xs"><Radio value="SI" label="Sí" /><Radio value="NO" label="No" /></Group>
                </Radio.Group>
              </Grid.Col>

              <Grid.Col span={12} mt="sm">
                <Checkbox
                  size="xs"
                  label={<Text size="xs">Acepto la <a href={LEGAL_LINKS.privacy} target="_blank" rel="noopener noreferrer" style={{ color: '#0559A5' }}>Política de Tratamiento de Datos Personales</a> y los <a href={LEGAL_LINKS.terms} target="_blank" rel="noopener noreferrer" style={{ color: '#0559A5' }}>Términos y Condiciones</a> de LED'S ON</Text>}
                  checked={habeasData}
                  onChange={(event) => setHabeasData(event.currentTarget.checked)}
                  required
                />
              </Grid.Col>

              <Grid.Col span={12}>
                <Group justify="space-between" mt="xs">
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
              <Box className="ledson-preview-wrap" mb={18}>
                {isVideoSelected ? (
                  <video src={fileImageBase64 as string} controls />
                ) : (
                  <img src={(useWebcam ? capturedImage : fileImageBase64) as string} alt="Preview" />
                )}
                <Button
                  className="ledson-preview-remove-btn"
                  onClick={() => { setCapturedImage(null); setFileImageBase64(null); setFileMediaType('image'); setUseWebcam(false); }}
                >
                  Cambiar
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
            <Box className="ledson-result-icon"><IconCheck size={32} /></Box>
            <Title  order={3} mb="lg" className="ledson-section-title">¡Reserva completada exitosamente!</Title>

            {finalResult?.queuePosition && (
              <Text size="xl" fw={700} style={{ color: '#0559A5' }} mb="xs">
                Turno del cliente en la fila: #{finalResult.queuePosition}
              </Text>
            )}
            {finalResult?.timeSlot && (
              <Text size="sm" mb={4} style={{ color: '#33363b' }}>
                Tu horario reservado es: <Text span fw={700} style={{ color: '#0559A5' }}>{finalResult.timeSlot.replace('-', ' - ')}</Text>
              </Text>
            )}
            {finalResult?.exactTime && finalResult.exactTime !== 'Sin asignar' && finalResult.exactTime !== 'Agotado/Lleno' ? (
              <Text size="sm" mb="xl" style={{ color: '#33363b' }}>
                Vivirás tu experiencia en pantalla a las <Text span fw={700} style={{ color: '#0559A5' }}>~{finalResult.exactTime}</Text>
              </Text>
            ) : (
              <Text size="sm" mb="xl" style={{ color: '#33363b' }}>
                Vivirás tu experiencia en pantalla a las <Text span fw={700} style={{ color: '#0559A5' }}>Sin asignar</Text>
              </Text>
            )}

            {bookingSystemType === 'franjas' && finalResult?.id && (
              <Box style={{ maxWidth: '340px', margin: '0 auto 32px' }}>
                <Select
                  label="Cambiar franja asignada"
                  placeholder="Selecciona otra franja"
                  data={(franjasAvailability?.franjas || [])
                    .filter((f: any) => f.available)
                    .map((f: any) => ({
                      value: f.timeSlot,
                      label: `${f.timeSlot.replace('-', ' - ')}${f.isCurrent ? ' (actual)' : ''} — ${f.spotsLeft} cupos`,
                    }))}
                  value={selectedNewFranja}
                  onChange={setSelectedNewFranja}
                  disabled={!franjasAvailability}
                />
                <Button
                  fullWidth
                  mt="xs"
                  className="ledson-btn-outline"
                  loading={isChangingFranja}
                  disabled={!selectedNewFranja || isChangingFranja}
                  onClick={handleChangeFranja}
                >
                  Confirmar cambio de franja
                </Button>
              </Box>
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

            <Text size="md" c="dimmed" mb="md" px="lg">
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
              Registrar nuevo cliente
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
              <CameraView webcamRef={webcamRef} />
            </Box>
            <Button className="ledson-btn-primary" mt="xl" onClick={capture} leftSection={<IconCamera size={20} />}>
              Capturar
            </Button>
          </Box>
        </Modal>

        <ImageCropModal
          opened={imageCropModalOpened}
          imageSrc={rawImageForCrop}
          aspect={cropWidth / cropHeight}
          outputWidth={cropWidth * PHOTO_QUALITY_SCALE}
          outputHeight={cropHeight * PHOTO_QUALITY_SCALE}
          onCancel={handleImageCropCancel}
          onConfirm={handleImageCropConfirm}
        />
        <VideoTrimModal
          opened={videoTrimModalOpened}
          file={rawVideoFile}
          maxSeconds={15}
          aspect={cropWidth / cropHeight}
          onCancel={handleVideoTrimCancel}
          onConfirm={handleVideoTrimConfirm}
        />
      </Container>
    </Box>
  );
}
