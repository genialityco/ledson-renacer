import React, { useState, useRef, useEffect } from 'react';
import { Container, Title, TextInput, Select, Button, Box, Group, FileInput, Text, Grid, Modal, Checkbox, Card, Image, Stepper, Badge } from '@mantine/core';
import { IconCamera, IconUpload, IconCreditCard, IconX, IconCheck } from '@tabler/icons-react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { useLanguage } from './i18n';
import './graffiti.css';

interface FilterOption {
  id: string;
  name: string;
  url: string;
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
  const [habeasData, setHabeasData] = useState(false);
  const [bookingSystemType, setBookingSystemType] = useState('slots');
  const [paymentGateway, setPaymentGateway] = useState('wompi');
  const [dlocalgoLink, setDlocalgoLink] = useState('');

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
      axios.get(`http://localhost:5000/api/dlocalgo/status/${dlocalPaymentId}`)
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

    axios.get('http://localhost:5000/api/images')
      .then((res) => {
        setFilters(res.data.map((img: any) => ({ id: img._id, name: img.label || img.altText, url: img.imageUrl })));
      });

    axios.get('http://localhost:5000/api/schedules/settings')
      .then((res) => {
        if (res.data && res.data.bookingSystemType) setBookingSystemType(res.data.bookingSystemType);
        if (res.data && res.data.paymentGateway) setPaymentGateway(res.data.paymentGateway);
      })
      .catch((err) => console.error("Error fetching settings", err));
  }, []);

  useEffect(() => {
    if (bookingDate) {
      axios.get(`http://localhost:5000/api/schedules/daily?date=${bookingDate}`)
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
    if (!selectedFilter) { alert('Debes seleccionar un filtro primero.'); return; }
    if (!habeasData) { alert('Debes aceptar la política de tratamiento de datos personales para continuar.'); return; }

    setIsSubmittingForm(true);
    try {
      const initRes = await axios.post('http://localhost:5000/api/bookings/init', {
        name, docId, email, whatsapp, country, city, selectedFilter, timeSlot, bookingDate,
        imageBase64: '',
        paymentMethod: paymentGateway === 'dlocalgo' ? 'DLocal Go' : 'Wompi'
      });
      const generatedBookingId = initRes.data.id;
      setBookingId(generatedBookingId);

      const amountInCents = 1500000;
      const amountInDollars = 15000;
      const reference = `booking-${generatedBookingId}`;

      if (paymentGateway === 'dlocalgo') {
        const dlocalRes = await axios.post('http://localhost:5000/api/dlocalgo/create-link', {
          amount: amountInDollars,
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
        const wompiRes = await axios.get(`http://localhost:5000/api/wompi/integrity-signature?reference=${reference}&amountInCents=${amountInCents}&currency=COP`);
        const { signature } = wompiRes.data;
        const checkout = new (window as any).WidgetCheckout({
          currency: 'COP',
          amountInCents: amountInCents,
          reference: reference,
          publicKey: import.meta.env.VITE_WOMPI_PUBLIC_KEY || 'pub_test_Q5yDA9xoKdePzhSGeVe9HAez7HgGORGf',
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
      const res = await axios.post(`http://localhost:5000/api/bookings/${bookingId}/assign-franja`, {
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
      const confirmRes = await axios.post(`http://localhost:5000/api/bookings/${bookingId}/confirm-payment`, {
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
    <Box className="graffiti-wall" style={{ position: 'relative', minHeight: 'calc(100vh - 60px)', overflow: 'hidden' }}>

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
        <Title order={2} ta="center" mb="xl" className="graffiti-section-title">
          {t('bookPhotobooth')}
        </Title>

        <Stepper
          className="graffiti-stepper"
          active={activeStep}
          onStepClick={setActiveStep}
          allowNextStepsSelect={false}
          mb="xl"
          size={isMobile ? 'sm' : 'md'}
        >
          <Stepper.Step label={isMobile ? null : "Elegir Estilo"} description={isMobile ? null : "Selecciona el filtro"} />
          <Stepper.Step label={isMobile ? null : "Pago"} description={isMobile ? null : "Ingresa datos y paga"} />
          <Stepper.Step label={isMobile ? null : "Foto"} description={isMobile ? null : "Tómate la foto"} />
          <Stepper.Step label={isMobile ? null : "Resultado"} description={isMobile ? null : "Tu turno"} />
        </Stepper>

        {/* STEP 1: FILTERS */}
        {activeStep === 0 && (
          <Box className="graffiti-panel">
            <Text ta="center" size="lg" mb="md" fw={500}>{t('step1Title')}</Text>
            {filters.length === 0 ? (
              <Text c="dimmed" ta="center">{t('noFilters')}</Text>
            ) : (
              <Grid>
                {filters.map(f => (
                  <Grid.Col span={{ base: 6, sm: 4 }} key={f.id}>
                    <Card
                      className="graffiti-filter-card"
                      data-selected={selectedFilter === f.id}
                      shadow="sm"
                      padding="sm"
                      radius="md"
                      onClick={() => setSelectedFilter(f.id)}
                    >
                      <Card.Section>
                        <Image src={f.url} height={160} alt={f.name} />
                      </Card.Section>
                      <Text fw={500} ta="center" mt="md">{f.name}</Text>
                      {selectedFilter === f.id && (
                        <Badge className="graffiti-badge" variant="filled" style={{ position: 'absolute', top: 10, right: 10 }}>
                          <IconCheck size={14} />
                        </Badge>
                      )}
                    </Card>
                  </Grid.Col>
                ))}
              </Grid>
            )}
            <Group justify="center" mt="xl">
              <Button
                size="lg"
                className="graffiti-btn"
                onClick={() => {
                  if (!selectedFilter) return alert(t('selectFilterAlert'));
                  setActiveStep(1);
                }}
              >
                {t('nextStep')}
              </Button>
            </Group>
          </Box>
        )}

        {/* STEP 2: DATA & PAYMENT */}
        {activeStep === 1 && (
          <Box component="form" onSubmit={handleDataSubmitAndPay} className="graffiti-panel">
            <Text fw={500} size="lg" mb="md">{t('step2Title')}</Text>
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

              <Grid.Col span={12} mt="sm">
                <Checkbox
                  label={<Text size="sm">{t('habeasDataText1')}<a href="#" target="_blank" style={{ color: '#ffd23f' }}>{t('habeasDataText2')}</a>.</Text>}
                  checked={habeasData}
                  onChange={(event) => setHabeasData(event.currentTarget.checked)}
                  required
                />
              </Grid.Col>

              <Grid.Col span={12}>
                <Group justify="space-between" mt="md">
                  <Button className="graffiti-btn-ghost" onClick={() => setActiveStep(0)}>{t('back')}</Button>
                  {paymentGateway === 'dlocalgo' && dlocalgoLink && paymentStatus?.startsWith('PENDING_') ? (
                    <Button
                      size="lg"
                      className="graffiti-btn"
                      onClick={async () => {
                        try {
                          const pid = paymentStatus.split('_')[1];
                          const res = await axios.get(`http://localhost:5000/api/dlocalgo/status/${pid}`);
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
                      size="lg"
                      className="graffiti-btn"
                      leftSection={<IconCreditCard size={24} />}
                      loading={isSubmittingForm}
                      disabled={isSubmittingForm}
                    >
                      {t('payWith')} {paymentGateway === 'dlocalgo' ? 'DLocal Go' : 'Wompi'} ($15.000 COP)
                    </Button>
                  )}
                </Group>
              </Grid.Col>
            </Grid>
          </Box>
        )}

        {/* STEP 3: PHOTO CAPTURE */}
        {activeStep === 2 && (
          <Box className="graffiti-panel" style={{ textAlign: 'center' }}>
            <Title order={3} mb="sm" className="graffiti-section-title">{t('paymentApproved')}</Title>
            <Text fw={500} size="lg" mb="xl">{t('nowUploadPhoto')}</Text>

            <Group justify="center" mb="md">
              <FileInput
                key={fileImageBase64 ? 'loaded' : 'empty'}
                placeholder={t('gallery')}
                accept="image/*"
                onChange={(file) => { setUseWebcam(false); handleFileChange(file); }}
                leftSection={<IconUpload size={16} />}
                style={{ flex: 1, maxWidth: '200px' }}
              />
              <Button className="graffiti-btn-ghost" onClick={() => { setUseWebcam(true); openCameraModal(); }} leftSection={<IconCamera size={16} />}>
                {t('takeSelfie')}
              </Button>
            </Group>

            {((!useWebcam && fileImageBase64) || (useWebcam && capturedImage)) && (
              <Box ta="center" mt="md" p="sm" style={{ maxWidth: '300px', margin: '0 auto' }}>
                <Text size="xs" c="dimmed" mb="xs">{t('selectedImage')}</Text>
                <img src={(useWebcam ? capturedImage : fileImageBase64) as string} alt="Preview" className="graffiti-preview" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'cover' }} />
                <Button fullWidth variant="light" color="red" mt="sm" leftSection={<IconX size={16} />} onClick={() => { setCapturedImage(null); setFileImageBase64(null); setUseWebcam(false); }}>
                  {t('removeImage')}
                </Button>
              </Box>
            )}

            <Box mt="xl" ta="center">
              <Text fw={600} size="md" mb="md" style={{ color: '#ffd23f' }}>
                {t('magicReady')}
              </Text>
              <Group justify="center">
                <Button
                  size="lg"
                  className="graffiti-btn"
                  loading={isUploadingPhoto}
                  onClick={submitPhotoAndConfirm}
                  disabled={(!useWebcam && !fileImageBase64) || (useWebcam && !capturedImage)}
                >
                  {t('next')}
                </Button>
              </Group>
            </Box>
          </Box>
        )}

        {/* STEP 4: FINAL RESULT / QR VIEW */}
        {activeStep === 3 && (
          <Box className="graffiti-panel" style={{ textAlign: 'center' }}>
            {paymentStatus === 'APPROVED' && finalResult?.franjaFull ? (
              <>
                <Title order={3} mb="md" className="graffiti-section-title" style={{ color: '#ff8c1e' }}>{t('franjaFullTitle')}</Title>
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
                    size="lg"
                    className="graffiti-btn"
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
                <Title order={3} mb="md" className="graffiti-section-title">{t('bookingCompleted')}</Title>
                {finalResult?.queuePosition && (
                  <Text size="xl" fw={700} style={{ color: '#29c5ff' }} mb="xs">
                    {t('queueTurn')}{finalResult.queuePosition}
                  </Text>
                )}
                {finalResult?.timeSlot && (
                  <Text size="lg" mb="xs">
                    {t('franjaAssigned')} <Text span fw={700} style={{ color: '#29c5ff' }}>{finalResult.timeSlot.replace('-', ' - ')}</Text>
                  </Text>
                )}
                <Text size="lg" mb="xl">
                  {t('assignedTime')} <Text span fw={700} style={{ color: '#ffd23f' }}>{finalResult?.exactTime || t('unassigned')}</Text>.
                </Text>
                <Box ta="center" mt="md" p="sm" mb="xl">
                  <Text size="sm" c="dimmed" mb="xs">{t('yourPhotoReady')}</Text>
                  <img src={(useWebcam ? capturedImage : fileImageBase64) as string} alt="Tu Foto" className="graffiti-preview" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'cover' }} />
                </Box>
                <Text c="dimmed" mb="md">
                  {t('searchBookingText')}
                </Text>
                <Button size="lg" className="graffiti-btn" onClick={() => navigate('/my-bookings')}>
                  {t('goToMyBookings')}
                </Button>
              </>
            ) : (
              <>
                <Title order={3} mb="md" className="graffiti-section-title" style={{ color: '#ff8c1e' }}>{t('paymentProcessing')}</Title>
                <Text size="lg" mb="xl">
                  {t('dontWorry')}
                </Text>
                <Button size="lg" className="graffiti-btn" onClick={() => navigate('/my-bookings')}>
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
          styles={{ body: { height: isMobile ? 'calc(100vh - 60px)' : 'auto', display: 'flex', flexDirection: 'column' } }}
        >
          <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Box style={{ width: '100%', maxWidth: '600px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000' }}>
              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: 'user', height: 720 }} style={{ width: '100%', height: '60vh', objectFit: 'cover', display: 'block' }} />
            </Box>
            <Button size="xl" radius="xl" className="graffiti-btn" mt="xl" onClick={capture} leftSection={<IconCamera size={24} />}>
              {t('capture')}
            </Button>
          </Box>
        </Modal>
      </Container>
    </Box>
  );
}