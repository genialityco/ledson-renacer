import React, { useState, useRef, useEffect } from 'react';
import { Container, Title, TextInput, Select, Button, Box, Group, FileInput, Text, Grid, Modal, Checkbox, Card, Image, Badge, UnstyledButton } from '@mantine/core';
import { IconCamera, IconUpload, IconCreditCard, IconX, IconCheck, IconArrowLeft } from '@tabler/icons-react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { useLanguage } from './i18n';
import './graffiti.css';
import './ledson-clean.css';
import { API_BASE_URL } from './config';

interface FilterOption {
  id: string;
  name: string;
  url: string;
}

const STEP_CAPTIONS = [
  'PASO 1 DE 4 : ELEGIR ESTILO',
  'PASO 2 DE 4 : DATOS Y PAGO',
  'PASO 3 DE 4 : TU FOTO',
  'RESERVA CONFIRMADA',
];

function StepProgress({ active, onStepClick }: { active: number; onStepClick: (index: number) => void }) {
  return (
    <Box className="ledson-progress">
      <Box className="ledson-progress-bars">
        {STEP_CAPTIONS.map((_, index) => (
          <span
            key={index}
            className="ledson-progress-seg"
            data-state={index < active ? 'done' : index === active ? 'active' : undefined}
            onClick={() => { if (index < active) onStepClick(index); }}
          />
        ))}
      </Box>
      <Text component="span" className="ledson-progress-caption">
        {STEP_CAPTIONS[active]}
      </Text>
    </Box>
  );
}

export function BookingForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [countries, setCountries] = useState<{ value: string; label: string }[]>([]);
  const [cities, setCities] = useState<{ value: string; label: string }[]>([]);
  const [isFetchingCities, setIsFetchingCities] = useState(false);
  const [cameraModalOpened, { open: openCameraModal, close: closeCameraModal }] = useDisclosure(false);
  const isMobile = useMediaQuery('(max-width: 50em)');
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
  const { t } = useLanguage();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const statusParam = searchParams.get('status');
    const bookingIdParam = searchParams.get('bookingId');
    const dlocalBookingId = sessionStorage.getItem('dlocal_booking_id');
    const dlocalPaymentId = sessionStorage.getItem('dlocal_payment_id');

    if (statusParam === 'success' && bookingIdParam) {
      setBookingId(bookingIdParam);
      setPaymentStatus('APPROVED');
      setActiveStep(2);
    } else if (dlocalBookingId && dlocalPaymentId) {
      setActiveStep(2);
      setBookingId(dlocalBookingId);
      axios.get(`${API_BASE_URL}/api/dlocalgo/status/${dlocalPaymentId}`)
        .then(res => {
          if (res.data && (res.data.status === 'PAID' || res.data.status === 'APPROVED' || res.data.status === 'COMPLETED' || res.data.status === 'AUTHORIZED')) {
            setPaymentStatus('APPROVED');
          } else {
            setPaymentStatus(`PENDING_${dlocalPaymentId}`);
            setActiveStep(1);
          }
          sessionStorage.removeItem('dlocal_booking_id');
          sessionStorage.removeItem('dlocal_payment_id');
        })
        .catch(err => {
          console.error('Error verifying DLocal status', err);
          setActiveStep(1);
        });
    }

    axios.get('https://countriesnow.space/api/v0.1/countries')
      .then((res) => {
        if (!res.data.error) {
          setCountries(res.data.data.map((item: any) => ({ value: item.country, label: item.country })));
        }
      })
      .catch((err) => console.error("Error fetching countries", err));

    axios.get(`${API_BASE_URL}/api/images`)
      .then((res) => {
        setFilters(res.data.map((img: any) => ({ id: img._id, name: img.label || img.altText, url: img.imageUrl })));
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

  // En modo "franjas", antes de pagar se le muestra al usuario la franja actual
  // (aproximada) y se refresca periódicamente mientras no elija otra manualmente.
  useEffect(() => {
    if (bookingSystemType !== 'franjas' || activeStep >= 2) return;

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
      setCapturedImage(imageSrc);
      closeCameraModal();
    }
  };

  const handleFileChange = (file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFileImageBase64(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFileImageBase64(null);
    }
  };

  const resizeImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const size = Math.min(img.width, img.height);
          const x = (img.width - size) / 2;
          const y = 0;
          ctx.drawImage(img, x, y, size, size, 0, 0, 512, 512);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handleDataSubmitAndPay = async (e: React.FormEvent) => {
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
      const generatedBookingId = initRes.data.id;
      setBookingId(generatedBookingId);

      const amountInCents = servicePrice * 100;
      const reference = `booking-${generatedBookingId}`;

      if (paymentGateway === 'dlocalgo') {
        const dlocalRes = await axios.post(`${API_BASE_URL}/api/dlocalgo/create-link`, {
          amount: servicePrice,
          currency: 'COP',
          reference: reference,
          successUrl: `${window.location.origin}/booking?status=success&bookingId=${generatedBookingId}`,
          backUrl: `${window.location.origin}/booking`
        });
        if (dlocalRes.data && dlocalRes.data.redirect_url) {
          sessionStorage.setItem('dlocal_booking_id', generatedBookingId);
          sessionStorage.setItem('dlocal_payment_id', dlocalRes.data.id);
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
        checkout.open((result: any) => {
          const transaction = result.transaction;
          console.log('Transaction result: ', transaction);
          setPaymentStatus(transaction.status);
          if (transaction.status === 'APPROVED') setActiveStep(2);
          else setActiveStep(3);
        });
      }
    } catch (error) {
      console.error('Error iniciando pago:', error);
      alert(t('paymentErrorAlert'));
    } finally {
      setIsSubmittingForm(false);
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
        setFinalResult({ ...res.data, franjaFull: false });
      }
    } catch (err) {
      console.error('Error asignando franja:', err);
      alert(t('assignFranjaError'));
    } finally {
      setIsAssigningFranja(false);
    }
  };

  const submitPhotoAndConfirm = async () => {
    let finalImage = useWebcam ? capturedImage : fileImageBase64;
    if (!finalImage || !bookingId) { alert(t('takeOrUploadAlert')); return; }
    setIsUploadingPhoto(true);
    try {
      finalImage = await resizeImage(finalImage);
      const confirmRes = await axios.post(`${API_BASE_URL}/api/bookings/${bookingId}/confirm-payment`, {
        imageBase64: finalImage
      });
      setFinalResult(confirmRes.data);
      setActiveStep(3);
    } catch (err) {
      console.error(err);
      alert(t('uploadErrorAlert'));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <Box className="graffiti-wall" style={{ position: 'relative', minHeight: 'calc(100vh - var(--ledson-header-h) - var(--ledson-footer-h))', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

 <div className="paint-particles">
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
      {/* Decoración spray de fondo */}
      <div className="spray-cloud spray-cloud--pink" />
      <div className="spray-cloud spray-cloud--cyan" />
      <div className="spray-cloud spray-cloud--yellow" />
      <div className="drip drip--1" />
      <div className="drip drip--2" />
      <div className="drip drip--3" />

      <Container size="md" py={{ base: 'md', sm: 'xl' }} px={{ base: 'xs', sm: 'md' }} style={{ position: 'relative', zIndex: 2 }}>
        <Title order={2} ta="center" className="ledson-title">
          {t('bookPhotobooth')}
        </Title>

        <StepProgress active={activeStep} onStepClick={setActiveStep} />

        {/* STEP 1: FILTERS */}
        {activeStep === 0 && (
          <Box className="ledson-card">
            <Text className="ledson-section-title">{t('step1Title')}</Text>
            <Text className="ledson-step-subtitle">{t('step1Subtitle')}</Text>
            {filters.length === 0 ? (
              <Text c="dimmed" ta="center" mb="md">{t('noFilters')}</Text>
            ) : (
              <Grid gutter={12} mb={22}>
                {filters.map(f => (
                  <Grid.Col span={6} key={f.id}>
                    <Card
                      className="ledson-filter-card"
                      data-selected={selectedFilter === f.id}
                      onClick={() => setSelectedFilter(f.id)}
                    >
                      <Card.Section>
                        <Image src={f.url} height={90} alt={f.name} />
                      </Card.Section>
                      <Text>{f.name}</Text>
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
              onClick={() => {
                if (filtersEnabled && filters.length > 0 && !selectedFilter) return alert(t('selectFilterAlert'));
                setActiveStep(1);
              }}
            >
              {t('nextStep')}
            </Button>
          </Box>
        )}

        {/* STEP 2: DATA & PAYMENT */}
        {activeStep === 1 && (
          <Box component="form" onSubmit={handleDataSubmitAndPay} className="ledson-card">
            <Text className="ledson-section-title">{t('step2Title')}</Text>
            <Text className="ledson-step-subtitle">{t('step2Subtitle')}</Text>
            <Grid>
              <Grid.Col span={12}>
                <TextInput label={t('fullName')} required value={name} onChange={(e) => setName(e.currentTarget.value)} />
              </Grid.Col>
              <Grid.Col span={12}>
                <TextInput label={t('docId')} required value={docId} onChange={(e) => setDocId(e.currentTarget.value)} />
              </Grid.Col>
              <Grid.Col span={12}>
                <TextInput type="email" label={t('email')} required value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
              </Grid.Col>
              <Grid.Col span={12}>
                <TextInput label={t('whatsapp')} required placeholder="Ej: +573001234567" value={whatsapp} onChange={(e) => setWhatsapp(e.currentTarget.value)} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select label={t('country')} placeholder={t('selectCountry')} data={countries} searchable required value={country} onChange={handleCountryChange} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select label={t('city')} placeholder={country ? t('selectCity') : t('selectCountryFirst')} data={cities} searchable disabled={!country || isFetchingCities} required value={city} onChange={(val) => setCity(val || '')} />
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

              {bookingSystemType === 'franjas' && (
                <Grid.Col span={12}>
                  <Text size="sm" mb={4}>
                    {t('approxFranjaLabel')}{' '}
                    <Text span fw={700} style={{ color: '#1c5cab' }}>
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
                </Grid.Col>
              )}

              <Grid.Col span={12} mt="sm">
                <Checkbox
                  label={<Text size="sm">{t('habeasDataText1')}<a href="#" target="_blank">{t('habeasDataText2')}</a>.</Text>}
                  checked={habeasData}
                  onChange={(event) => setHabeasData(event.currentTarget.checked)}
                  required
                />
              </Grid.Col>

              <Grid.Col span={12}>
                <Group justify="space-between" mt="md">
                  <Button className="ledson-btn-outline ledson-btn-back" onClick={() => setActiveStep(0)} aria-label={t('back')}>
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
                            setPaymentStatus('APPROVED');
                            setActiveStep(2);
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
                      type="submit"
                      className="ledson-btn-primary"
                      style={{ flex: 1 }}
                      leftSection={<IconCreditCard size={20} />}
                      loading={isSubmittingForm}
                      disabled={isSubmittingForm}
                    >
                      {t('payWith')} {paymentGateway === 'dlocalgo' ? 'DLocal Go' : 'Wompi'} (${servicePrice.toLocaleString('es-CO')} COP)
                    </Button>
                  )}
                </Group>
              </Grid.Col>
            </Grid>
          </Box>
        )}

        {/* STEP 3: PHOTO CAPTURE */}
        {activeStep === 2 && (
          <Box className="ledson-card">
            <Text className="ledson-section-title">{t('paymentApproved')}</Text>
            <Text className="ledson-step-subtitle">{t('nowUploadPhoto')}</Text>

            {!((!useWebcam && fileImageBase64) || (useWebcam && capturedImage)) && (
              <Grid mb={20} gutter={12}>
                <Grid.Col span={6}>
                  <UnstyledButton
                    className="ledson-upload-card"
                    onClick={() => { setUseWebcam(true); openCameraModal(); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}
                  >
                    <Box className="ledson-upload-icon"><IconCamera size={20} /></Box>
                    <Text size="sm" fw={500} style={{ color: '#33363b' }}>{t('takeSelfie')}</Text>
                  </UnstyledButton>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Box
                    className="ledson-upload-card"
                    style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Box className="ledson-upload-icon"><IconUpload size={18} /></Box>
                    <Text size="sm" fw={500} style={{ color: '#33363b' }}>{t('gallery')}</Text>
                    <FileInput
                      key={fileImageBase64 ? 'loaded' : 'empty'}
                      accept="image/*"
                      onChange={(file) => { setUseWebcam(false); handleFileChange(file); }}
                      variant="unstyled"
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    />
                  </Box>
                </Grid.Col>
              </Grid>
            )}

            {((!useWebcam && fileImageBase64) || (useWebcam && capturedImage)) && (
              <Box mb={18}>
                <Box className="ledson-preview-wrap">
                  <img src={(useWebcam ? capturedImage : fileImageBase64) as string} alt="Preview" />
                </Box>
                <Button
                  className="ledson-preview-remove-btn"
                  leftSection={<IconX size={14} />}
                  onClick={() => { setCapturedImage(null); setFileImageBase64(null); setUseWebcam(false); }}
                >
                  {t('removeImage')}
                </Button>
              </Box>
            )}

            <Text size="sm" fw={500} mb="md" style={{ color: '#1c5cab' }}>
              {t('magicReady')}
            </Text>
            <Group gap={10}>
              <Button className="ledson-btn-outline ledson-btn-back" onClick={() => setActiveStep(1)} aria-label={t('back')}>
                <IconArrowLeft size={18} />
              </Button>
              <Button
                className="ledson-btn-primary"
                style={{ flex: 1 }}
                loading={isUploadingPhoto}
                onClick={submitPhotoAndConfirm}
                disabled={(!useWebcam && !fileImageBase64) || (useWebcam && !capturedImage)}
              >
                {t('next')}
              </Button>
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
                  <Text size="xl" fw={700} style={{ color: '#1c5cab' }} mb="xs">
                    {t('queueTurn')}{finalResult.queuePosition}
                  </Text>
                )}
                {finalResult?.timeSlot && (
                  <Text size="sm" mb="xs" style={{ color: '#33363b' }}>
                    {t('franjaAssigned')} <Text span fw={700} style={{ color: '#1c5cab' }}>{finalResult.timeSlot.replace('-', ' - ')}</Text>
                  </Text>
                )}
                <Text size="sm" mb="xl" style={{ color: '#33363b' }}>
                  {t('assignedTime')} <Text span fw={700} style={{ color: '#1c5cab' }}>{finalResult?.exactTime || t('unassigned')}</Text>.
                </Text>
                <Box mb="xl">
                  <Text size="sm" c="dimmed" mb="xs">{t('yourPhotoReady')}</Text>
                  <Box className="ledson-preview-wrap">
                    <img src={(useWebcam ? capturedImage : fileImageBase64) as string} alt="Tu Foto" />
                  </Box>
                </Box>
                <Text size="sm" c="dimmed" mb="md">
                  {t('searchBookingText')}
                </Text>
                <Button fullWidth className="ledson-btn-primary" onClick={() => navigate('/my-bookings')}>
                  {t('goToMyBookings')}
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
      </Container>
    </Box>
  );
}