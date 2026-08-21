import React, { useState, useRef, useEffect } from 'react';
import { Container, Title, TextInput, Select, Button, Box, Group, FileInput, Text, Grid, Modal, Checkbox, Card, Image, Badge, UnstyledButton, ActionIcon, Input } from '@mantine/core';
import { IconCamera, IconCreditCard, IconX, IconCheck, IconArrowLeft, IconArrowRight, IconCopy, IconPhoto, IconVideo } from '@tabler/icons-react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { useLanguage } from './i18n';
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

const FILTER_STEP_LABELS = ['ELIGE TU FILTRO', 'TUS DATOS', 'FOTO Y PAGO'];
const NO_FILTER_STEP_LABELS = ['INGRESA TUS DATOS', 'FOTO Y PAGO'];

export function BookingForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [countries, setCountries] = useState<{ value: string; label: string }[]>([]);
  const [cities, setCities] = useState<{ value: string; label: string }[]>([]);
  const [isFetchingCities, setIsFetchingCities] = useState(false);
  const [cameraModalOpened, { open: openCameraModal, close: closeCameraModal }] = useDisclosure(false);
  const isMobile = useMediaQuery('(max-width: 50em)');
  // Mismo esquema responsivo que Home.tsx: el alto manda tanto como el
  // ancho, para que el paso 1 (elegir filtro) quepa sin scroll en la
  // mayoría de tamaños reales, igual que la home.
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
  // el usuario vea nada.
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
  const [franjasAvailability, setFranjasAvailability] = useState<{ franjas: any[] } | null>(null);
  const [userPickedFranja, setUserPickedFranja] = useState(false);
  const [habeasData, setHabeasData] = useState(false);
  // Factura electrónica: se envía siempre como "SI" sin mostrar el campo al usuario.
  const requiresInvoice = 'SI';
  const [bookingSystemType, setBookingSystemType] = useState('slots');
  const [paymentGateway, setPaymentGateway] = useState('wompi');
  const [dlocalgoLink, setDlocalgoLink] = useState('');
  const [filtersEnabled, setFiltersEnabled] = useState(true);
  const [servicePrice, setServicePrice] = useState(15000);

  const [activeStep, setActiveStep] = useState(0);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [selectedFranja, setSelectedFranja] = useState<string | null>(null);
  const [isAssigningFranja, setIsAssigningFranja] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const { t } = useLanguage();
  const documentTypeOptions = [
    { value: 'CC', label: t('docTypeCC') },
    { value: 'CE', label: t('docTypeCE') },
    { value: 'TI', label: t('docTypeTI') },
    { value: 'PA', label: t('docTypePA') },
  ];

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const statusParam = searchParams.get('status');
    const bookingIdParam = searchParams.get('bookingId');
    const dlocalBookingId = sessionStorage.getItem('dlocal_booking_id');
    const dlocalPaymentId = sessionStorage.getItem('dlocal_payment_id');

    // La foto/video ya quedó guardada en el backend (attach-media) antes de
    // salir a pagar, así que al volver solo hace falta confirmar el pago —
    // no se le vuelve a pedir la foto al usuario.
    if (statusParam === 'success' && bookingIdParam) {
      sessionStorage.removeItem('dlocal_booking_id');
      sessionStorage.removeItem('dlocal_payment_id');
      sessionStorage.removeItem('dlocal_link');
      finalizeBooking(bookingIdParam);
    } else if (dlocalBookingId && dlocalPaymentId) {
      setBookingId(dlocalBookingId);
      axios.get(`${API_BASE_URL}/api/dlocalgo/status/${dlocalPaymentId}`)
        .then(res => {
          if (res.data && (res.data.status === 'PAID' || res.data.status === 'APPROVED' || res.data.status === 'COMPLETED' || res.data.status === 'AUTHORIZED')) {
            sessionStorage.removeItem('dlocal_booking_id');
            sessionStorage.removeItem('dlocal_payment_id');
            sessionStorage.removeItem('dlocal_link');
            finalizeBooking(dlocalBookingId);
          } else {
            // Pago aún no confirmado: se queda en el paso de foto y pago,
            // donde vive el botón "Ya realicé el pago" para reintentar.
            const storedLink = sessionStorage.getItem('dlocal_link');
            if (storedLink) setDlocalgoLink(storedLink);
            setPaymentStatus(`PENDING_${dlocalPaymentId}`);
            setActiveStep(2);
          }
        })
        .catch(err => {
          console.error('Error verifying DLocal status', err);
          setActiveStep(2);
        });
    }

    fetchCountries()
      .then(setCountries)
      .catch((err) => console.error("Error fetching countries", err));

    axios.get(`${API_BASE_URL}/api/images`)
      .then((res) => {
        setFilters(res.data.map((img: any) => ({ id: img._id, name: img.label || img.altText, url: img.imageUrl, description: img.description || '' })));
      });

    axios.get(`${API_BASE_URL}/api/schedules/settings`)
      .then((res) => {
        if (res.data && res.data.bookingSystemType) setBookingSystemType(res.data.bookingSystemType);
        if (res.data && res.data.paymentGateway) setPaymentGateway(res.data.paymentGateway);
      })
      .catch((err) => console.error("Error fetching settings", err));

    axios.get(`${API_BASE_URL}/api/plans/settings`)
      .then((res) => {
        setFiltersEnabled(res.data?.filtersEnabled ?? true);
        setServicePrice(res.data?.price ?? 15000);
      })
      .catch((err) => console.error("Error fetching plan settings", err));
  }, []);

  // Política de filtros desactivada: el paso "elegir filtro" no existe en el
  // flujo, así que si por cualquier motivo el usuario cae en activeStep 0
  // (valor inicial, o "Reserva un nuevo espacio") lo saltamos directo a datos.
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
              { startTime: '23:00', endTime: '00:00' },
            ];
          }
          const today = new Date();
          today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
          const todayStr = today.toISOString().split('T')[0];
          if (bookingDate === todayStr) {
            const now = new Date();
            const currentHour = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
            slots = slots.filter((s: any) => {
              const endTime = s.endTime === '00:00' ? '24:00' : s.endTime;
              return endTime > currentHour;
            });
          }
          setAvailableSlots(slots.map((s: any) => ({ value: `${s.startTime}-${s.endTime}`, label: `${s.startTime} - ${s.endTime}` })));
          setTimeSlot(null);
        })
        .catch(() => setAvailableSlots([]));
    }
  }, [bookingDate]);

  // En modo "franjas", se le muestra al usuario la franja actual (aproximada)
  // y se refresca periódicamente mientras no elija otra manualmente. La UI vive
  // en el paso de la foto (activeStep 2), así que el polling sigue activo ahí
  // y solo se detiene al llegar al resultado final.
  useEffect(() => {
    if (bookingSystemType !== 'franjas' || activeStep >= 3) return;

    const fetchFranjas = () => {
      axios.get(`${API_BASE_URL}/api/bookings/franjas`)
        .then((res) => {
          setFranjasAvailability(res.data);
          if (!userPickedFranja) {
            const current = (res.data?.franjas || []).find((f: any) => f.isCurrent);
            if (current) setTimeSlot(current.timeSlot);
          }
        })
        .catch((err) => console.error('Error fetching franjas', err));
    };

    fetchFranjas();
    const interval = setInterval(fetchFranjas, 20000);
    return () => clearInterval(interval);
  }, [bookingSystemType, activeStep, userPickedFranja]);

  const handleCountryChange = (selectedCountry: string | null) => {
    setCountry(selectedCountry);
    setCity('');
    setCities([]);
    if (selectedCountry) {
      setIsFetchingCities(true);
      axios.post('https://countriesnow.space/api/v0.1/countries/cities', { country: selectedCountry })
        .then((res) => {
          if (!res.data.error) {
            setCities(res.data.data.map((cityName: string) => ({ value: cityName, label: cityName })));
          }
        })
        .catch((err) => console.error("Error fetching cities", err))
        .finally(() => setIsFetchingCities(false));
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
        alert(t('videoTooLargeAlert').replace('{max}', String(MAX_VIDEO_MB)));
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

  // La foto queda recortada exactamente por lo que el usuario eligió en
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

  // Paso 1: solo guarda los datos de la reserva (PENDING, sin pago). El pago
  // se dispara más adelante, al subir la foto/video.
  const handleDataSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (filtersEnabled && filters.length > 0 && !selectedFilter) { alert('Debes seleccionar un filtro primero.'); return; }
    if (!habeasData) { alert('Debes aceptar la política de tratamiento de datos personales para continuar.'); return; }

    setIsSubmittingForm(true);
    try {
      const initRes = await axios.post(`${API_BASE_URL}/api/bookings/init`, {
        name, docId, email, whatsapp, country, city, selectedFilter, timeSlot, bookingDate,
        imageBase64: '',
        paymentMethod: paymentGateway === 'dlocalgo' ? 'DLocal Go' : 'Wompi',
        requiresInvoice: requiresInvoice === 'SI'
      });
      setBookingId(initRes.data.id);
      setActiveStep(2);
    } catch (error) {
      console.error('Error guardando la reserva:', error);
      alert(t('bookingCreateErrorAlert'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Confirma el pago ya aprobado: asigna el minuto exacto de proyección y
  // dispara la generación con IA. No reenvía la foto/video: para Wompi ya se
  // mandó junto con esta misma llamada (ver handleUploadAndPay); para dLocal
  // Go ya quedó guardada de antes vía attach-media, porque el navegador
  // pierde el estado al salir a pagar y volver.
  const finalizeBooking = async (id: string) => {
    try {
      const confirmRes = await axios.post(`${API_BASE_URL}/api/bookings/${id}/confirm-payment`, {});
      setBookingId(id);
      setFinalResult(confirmRes.data);
      setPaymentStatus('APPROVED');
      setActiveStep(3);
    } catch (err) {
      console.error('Error confirmando la reserva:', err);
      alert(t('uploadErrorAlert'));
    }
  };

  const handleAssignFranja = async () => {
    if (!selectedFranja) { alert(t('selectFranjaAlert')); return; }
    if (!bookingId) return;
    setIsAssigningFranja(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/bookings/${bookingId}/assign-franja`, {
        timeSlot: selectedFranja
      });
      if (res.data.franjaFull) {
        alert(t('franjaNowFull'));
        setSelectedFranja(null);
        setFinalResult((prev: any) => ({ ...prev, availableFranjas: res.data.availableFranjas }));
      } else {
        setFinalResult((prev: any) => ({ ...prev, ...res.data, franjaFull: false }));
      }
    } catch (err) {
      console.error('Error asignando franja:', err);
      alert(t('assignFranjaError'));
    } finally {
      setIsAssigningFranja(false);
    }
  };

  // Paso 2: al dar "Subir y pagar" se dispara el cobro. Wompi no navega
  // fuera de la página, así que la foto se manda junto con la confirmación
  // del pago. dLocal Go sí redirige a una página externa (se pierde el
  // estado del navegador), así que la foto se guarda primero en el backend
  // (attach-media) y luego se redirige a pagar.
  const handleUploadAndPay = async () => {
    const finalImage = useWebcam ? capturedImage : fileImageBase64;
    if (!finalImage || !bookingId) { alert(t('takeOrUploadAlert')); return; }
    const isVideo = !useWebcam && fileMediaType === 'video';
    const mediaPayload = {
      imageBase64: finalImage,
      ...(isVideo && videoTrim ? { trimStart: videoTrim.trimStart, trimEnd: videoTrim.trimEnd } : {}),
      ...(bookingSystemType === 'franjas' && timeSlot ? { timeSlot } : {}),
    };

    setIsUploadingPhoto(true);
    try {
      const amountInCents = servicePrice * 100;
      const reference = `booking-${bookingId}`;

      if (paymentGateway === 'dlocalgo') {
        await axios.post(`${API_BASE_URL}/api/bookings/${bookingId}/attach-media`, mediaPayload);

        const dlocalRes = await axios.post(`${API_BASE_URL}/api/dlocalgo/create-link`, {
          amount: servicePrice,
          currency: 'COP',
          reference: reference,
          successUrl: `${window.location.origin}/booking?status=success&bookingId=${bookingId}`,
          backUrl: `${window.location.origin}/booking`
        });
        if (dlocalRes.data && dlocalRes.data.redirect_url) {
          sessionStorage.setItem('dlocal_booking_id', bookingId);
          sessionStorage.setItem('dlocal_payment_id', dlocalRes.data.id);
          sessionStorage.setItem('dlocal_link', dlocalRes.data.redirect_url);
          setDlocalgoLink(dlocalRes.data.redirect_url);
          setPaymentStatus(`PENDING_${dlocalRes.data.id}`);
          window.location.href = dlocalRes.data.redirect_url;
        } else {
          throw new Error('No redirect URL received from DLocal Go');
        }
      } else {
        const wompiRes = await axios.get(`${API_BASE_URL}/api/wompi/integrity-signature?reference=${reference}&amountInCents=${amountInCents}&currency=COP`);
        const { signature } = wompiRes.data;
        const checkout = new (window as any).WidgetCheckout({
          currency: 'COP',
          amountInCents: amountInCents,
          reference: reference,
          publicKey: import.meta.env.VITE_WOMPI_PUBLIC_KEY,
          signature: { integrity: signature },
        });
        checkout.open(async (result: any) => {
          const transaction = result.transaction;
          console.log('Transaction result: ', transaction);
          setPaymentStatus(transaction.status);
          if (transaction.status === 'APPROVED') {
            try {
              const confirmRes = await axios.post(`${API_BASE_URL}/api/bookings/${bookingId}/confirm-payment`, mediaPayload);
              setFinalResult(confirmRes.data);
            } catch (err) {
              console.error(err);
              alert(t('uploadErrorAlert'));
            }
          }
          setActiveStep(3);
          setIsUploadingPhoto(false);
        });
        return;
      }
    } catch (err) {
      console.error('Error al subir y pagar:', err);
      alert(t('paymentErrorAlert'));
    }
    setIsUploadingPhoto(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  // "Reserva un nuevo espacio": vuelve al paso 1 con todo el estado limpio.
  const resetBookingFlow = () => {
    setActiveStep(0);
    setSelectedFilter(null);
    setName('');
    setDocId('');
    setEmail('');
    setWhatsapp('');
    setCountry(null);
    setCity('');
    setBookingDate(new Date().toISOString().split('T')[0]);
    setTimeSlot(null);
    setUserPickedFranja(false);
    setHabeasData(false);
    setUseWebcam(false);
    setCapturedImage(null);
    setFileImageBase64(null);
    setFileMediaType('image');
    setRawImageForCrop(null);
    setImageCropModalOpened(false);
    setRawVideoFile(null);
    setVideoTrimModalOpened(false);
    setVideoTrim(null);
    setBookingId(null);
    setPaymentStatus(null);
    setFinalResult(null);
    setSelectedFranja(null);
    setDlocalgoLink('');
    sessionStorage.removeItem('dlocal_booking_id');
    sessionStorage.removeItem('dlocal_payment_id');
    sessionStorage.removeItem('dlocal_link');
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
          {t('homeTitle')}
        </Title>
        <Text ta="center" className="ledson-subtitle">
          {t('homeSubtitle')}
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
            <Text className="ledson-section-title">1. {t('step1Title')}</Text>
            <Text className="ledson-step-subtitle">{t('step1Subtitle')}</Text>
            {filters.length === 0 ? (
              <Text c="dimmed" ta="center" mb="md">{t('noFilters')}</Text>
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
              {t('nextStep')}
            </Button>
          </Box>
        )}

        {/* STEP 2: DATA */}
        {activeStep === 1 && (
          <Box component="form" onSubmit={handleDataSubmit} className="ledson-card">
            <Text className="ledson-section-title">{filtersEnabled ? 2 : 1}. {t('step2Title')}</Text>
            <Text className="ledson-step-subtitle">{t('step2Subtitle')}</Text>
            <Grid>
              <Grid.Col span={12}>
                <TextInput label={t('fullName')} placeholder={t('fullNamePlaceholder')} required value={name} onChange={(e) => setName(e.currentTarget.value)} />
              </Grid.Col>
              <Grid.Col span={12}>
                <Input.Wrapper label={t('docId')} required>
                  <Grid gap="xs" mt={4}>
                    <Grid.Col span={5}>
                      <Select placeholder={t('docTypePlaceholder')} data={documentTypeOptions} required value={docType} onChange={setDocType} />
                    </Grid.Col>
                    <Grid.Col span={7}>
                      <TextInput placeholder={t('docNumberPlaceholder')} required value={docId} onChange={(e) => setDocId(e.currentTarget.value)} />
                    </Grid.Col>
                  </Grid>
                </Input.Wrapper>
              </Grid.Col>
              <Grid.Col span={12}>
                <TextInput type="email" label={t('email')} placeholder={t('emailPlaceholder')} required value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
              </Grid.Col>
              <Grid.Col span={12}>
                <Input.Wrapper label={t('country')} required>
                  <Grid gap="xs" mt={4}>
                    <Grid.Col span={6}>
                      <Select placeholder={t('selectCountry')} data={countries} searchable required value={country} onChange={handleCountryChange} />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Select placeholder={t('selectCity')} data={cities} searchable disabled={!country || isFetchingCities} required value={city} onChange={(val) => setCity(val || '')} />
                    </Grid.Col>
                  </Grid>
                </Input.Wrapper>
              </Grid.Col>
              <Grid.Col span={12}>
                <TextInput label={t('whatsapp')} required placeholder="+573001234567" value={whatsapp} onChange={(e) => setWhatsapp(e.currentTarget.value)} />
              </Grid.Col>

              {bookingSystemType === 'slots' && (
                <>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput type="date" label={t('bookingDate')} required value={bookingDate} onChange={(e) => setBookingDate(e.currentTarget.value)} min={new Date().toISOString().split('T')[0]} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select label={t('timeSlot')} placeholder={t('selectTimeSlot')} data={availableSlots} required value={timeSlot} onChange={setTimeSlot} disabled={availableSlots.length === 0} />
                  </Grid.Col>
                </>
              )}

              <Grid.Col span={12} mt="sm">
                <Checkbox
                  label={<Text size="xs">{t('habeasDataPrefix')}<a href="#" target="_blank">{t('habeasDataLink1')}</a>{t('habeasDataMiddle')}<a href="#" target="_blank">{t('habeasDataLink2')}</a>{t('habeasDataSuffix')}</Text>}
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
                    aria-label={t('back')}
                  >
                    <IconArrowLeft size={18} />
                  </Button>
                  <Button
                    type="submit"
                    className="ledson-btn-primary"
                    style={{ flex: 1 }}
                    rightSection={<IconArrowRight size={20} />}
                    loading={isSubmittingForm}
                    disabled={isSubmittingForm}
                  >
                    {t('nextStep')}
                  </Button>
                </Group>
              </Grid.Col>
            </Grid>
          </Box>
        )}

        {/* STEP 3: PHOTO CAPTURE & PAYMENT */}
        {activeStep === 2 && (
          <Box className="ledson-card">
            <Text className="ledson-section-title">{t('uploadStepTitle')}</Text>
            <Text className="ledson-step-subtitle">{t('nowUploadPhoto')}</Text>

            {!((!useWebcam && fileImageBase64) || (useWebcam && capturedImage)) && (
              <Grid mb={20} gap={12}>
                <Grid.Col span={4}>
                  <UnstyledButton
                    className="ledson-upload-card"
                    onClick={() => { setUseWebcam(true); openCameraModal(); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}
                  >
                    <Box className="ledson-upload-icon"><IconCamera size={20} /></Box>
                    <Text size="sm" fw={500} style={{ color: '#33363b' }}>{t('takeSelfie')}</Text>
                  </UnstyledButton>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Box
                    className="ledson-upload-card"
                    style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Box className="ledson-upload-icon"><IconPhoto size={18} /></Box>
                    <Text size="sm" fw={500} style={{ color: '#33363b' }}>{t('uploadPhoto')}</Text>
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
                    <Text size="sm" fw={500} style={{ color: '#33363b' }}>{t('uploadVideo')}</Text>
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
                {t('verticalVideoHint')}
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
                  {t('removeImage')}
                </Button>
              </Box>
            )}

            {bookingSystemType === 'franjas' && (
              <Box mb="md">
                <Text size="sm" mb={4}>
                  {t('approxFranjaLabel')}{' '}
                  <Text span fw={700} style={{ color: '#0559A5' }}>
                    {timeSlot ? timeSlot.replace('-', ' - ') : '...'}
                  </Text>
                </Text>
                <Select
                  label={t('changeFranjaLabel')}
                  placeholder={t('selectFranja')}
                  data={(franjasAvailability?.franjas || [])
                    .filter((f: any) => f.available)
                    .map((f: any) => ({
                      value: f.timeSlot,
                      label: `${f.timeSlot.replace('-', ' - ')}${f.isCurrent ? ` (${t('currentFranjaTag')})` : ''} — ${f.spotsLeft} ${t('spotsLabel')}`,
                    }))}
                  value={timeSlot}
                  onChange={(val) => { setTimeSlot(val); setUserPickedFranja(true); }}
                  disabled={!franjasAvailability}
                />
              </Box>
            )}

            <Text size="sm" fw={500} mb="md" style={{ color: '#0559A5' }}>
              {isVideoSelected ? t('videoReady') : t('magicReady')}
            </Text>
            <Group gap={10}>
              <Button className="ledson-btn-outline ledson-btn-back" onClick={() => setActiveStep(1)} aria-label={t('back')}>
                <IconArrowLeft size={18} />
              </Button>
              {paymentGateway === 'dlocalgo' && dlocalgoLink && paymentStatus?.startsWith('PENDING_') ? (
                <Button
                  className="ledson-btn-primary"
                  style={{ flex: 1 }}
                  onClick={async () => {
                    try {
                      const pid = paymentStatus.split('_')[1];
                      const res = await axios.get(`${API_BASE_URL}/api/dlocalgo/status/${pid}`);
                      if (res.data && res.data.status === 'PAID') {
                        await finalizeBooking(bookingId as string);
                      } else {
                        alert(t('paymentProcessing'));
                      }
                    } catch (err) {
                      console.error('Error verifying DLocalGo payment', err);
                      alert(t('paymentErrorAlert'));
                    }
                  }}
                >
                  {t('alreadyPaid')}
                </Button>
              ) : (
                <Button
                  className="ledson-btn-primary"
                  style={{ flex: 1 }}
                  leftSection={<IconCreditCard size={20} />}
                  loading={isUploadingPhoto}
                  onClick={handleUploadAndPay}
                  disabled={isUploadingPhoto || (!useWebcam && !fileImageBase64) || (useWebcam && !capturedImage)}
                >
                  {t('payWith')} (${servicePrice.toLocaleString('es-CO')} COP)
                </Button>
              )}
            </Group>
          </Box>
        )}

        {/* STEP 4: FINAL RESULT / QR VIEW */}
        {activeStep === 3 && (
          <Box className="ledson-card ledson-card--center">
            {paymentStatus === 'APPROVED' && finalResult?.franjaFull ? (
              <>
                <Title order={3} mb="md" className="ledson-section-title" style={{ color: '#d97706' }}>{t('franjaFullTitle')}</Title>
                <Text size="lg" mb="md">
                  {t('franjaFullMsg')}
                </Text>
                <Box style={{ maxWidth: '340px', margin: '0 auto' }}>
                  <Select
                    label={t('selectFranja')}
                    placeholder={t('selectFranja')}
                    data={(finalResult?.availableFranjas?.franjas || [])
                      .filter((f: any) => f.available && !f.isCurrent)
                      .map((f: any) => ({
                        value: f.timeSlot,
                        label: `${f.timeSlot.replace('-', ' - ')} (${f.spotsLeft} ${t('spotsLabel')})`
                      }))}
                    value={selectedFranja}
                    onChange={setSelectedFranja}
                  />
                  <Button
                    fullWidth
                    mt="md"
                    className="ledson-btn-primary"
                    loading={isAssigningFranja}
                    disabled={!selectedFranja || isAssigningFranja}
                    onClick={handleAssignFranja}
                  >
                    {t('confirmFranjaBtn')}
                  </Button>
                </Box>
              </>
            ) : paymentStatus === 'APPROVED' ? (
              <>
                <Box className="ledson-result-icon"><IconCheck size={28} /></Box>
                <Title order={3} mb="md" className="ledson-section-title">{t('bookingCompleted')}</Title>
                {finalResult?.queuePosition && (
                  <Text size="xl" fw={700} style={{ color: '#0559A5' }} mb="xs">
                    {t('queueTurn')}{finalResult.queuePosition}
                  </Text>
                )}
                {finalResult?.timeSlot && (
                  <Text size="sm" mb="xs" style={{ color: '#33363b' }}>
                    {t('franjaAssigned')} <Text span fw={700} style={{ color: '#0559A5' }}>{finalResult.timeSlot.replace('-', ' - ')}</Text>
                  </Text>
                )}
                {finalResult?.exactTime && finalResult.exactTime !== 'Sin asignar' && finalResult.exactTime !== 'Agotado/Lleno' ? (
                  <Text size="sm" mb="lg" style={{ color: '#33363b' }}>
                    {t('assignedTime')} <Text span fw={700} style={{ color: '#0559A5' }}>~{finalResult.exactTime}</Text>
                  </Text>
                ) : (
                  <Text size="sm" mb="lg" style={{ color: '#33363b' }}>
                    {t('assignedTime')} <Text span fw={700} style={{ color: '#0559A5' }}>{t('unassigned')}</Text>
                  </Text>
                )}

                {finalResult?.code && (
                  <Box mb="lg">
                    <Text size="xs" c="dimmed" mb={6}>{t('bookingCodeLabel')}</Text>
                    <Group justify="center" gap={8} wrap="nowrap">
                      <Box className="ledson-code-box">{finalResult.code}</Box>
                      <ActionIcon
                        variant="light"
                        color="blue"
                        size={38}
                        radius="md"
                        onClick={() => handleCopyCode(finalResult.code)}
                        aria-label={t('copyCode')}
                      >
                        {codeCopied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                      </ActionIcon>
                    </Group>
                  </Box>
                )}

                <Text size="sm" c="dimmed" mb="xl">
                  {t('photoWillBeProjected')}
                </Text>

                <Text size="sm" fw={500} mb="xs" style={{ color: '#33363b' }}>
                  {t('newExperienceQuestion')}
                </Text>
                <Button
                  fullWidth
                  className="ledson-btn-primary"
                  leftSection={<IconArrowLeft size={18} />}
                  onClick={resetBookingFlow}
                >
                  {t('newReservationBtn')}
                </Button>
              </>
            ) : (
              <>
                <Title order={3} mb="md" className="ledson-section-title" style={{ color: '#d97706' }}>{t('paymentProcessing')}</Title>
                <Text size="sm" mb="xl" style={{ color: '#33363b' }}>
                  {t('dontWorry')}
                </Text>
                <Button fullWidth className="ledson-btn-primary" onClick={() => navigate('/my-bookings')}>
                  {t('goToMyBookings')}
                </Button>
              </>
            )}
          </Box>
        )}

        <Modal
          opened={cameraModalOpened}
          onClose={closeCameraModal}
          fullScreen={isMobile}
          size="xl"
          title={t('poseTitle')}
          className="ledson-modal"
          styles={{ body: { height: isMobile ? 'calc(100vh - 60px)' : 'auto', display: 'flex', flexDirection: 'column' } }}
        >
          <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Box style={{ width: '100%', maxWidth: '600px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000' }}>
              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: 'user', height: 720 }} style={{ width: '100%', height: '60vh', objectFit: 'cover', display: 'block' }} />
            </Box>
            <Button className="ledson-btn-primary" mt="xl" onClick={capture} leftSection={<IconCamera size={20} />}>
              {t('capture')}
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
      </Container>
    </Box>
  );
}