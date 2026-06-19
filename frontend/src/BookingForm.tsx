import React, { useState, useRef, useEffect } from 'react';
import { Container, Title, TextInput, Select, Button, Box, Group, FileInput, Text, Grid, Modal, Checkbox, Card, Image, Stepper, Loader, Badge } from '@mantine/core';
import { IconCamera, IconUpload, IconCreditCard, IconX, IconCheck, IconSearch } from '@tabler/icons-react';
import QRCode from 'react-qr-code';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';

interface FilterOption {
  id: string;
  name: string;
  url: string;
}

export function BookingForm() {
  const navigate = useNavigate();
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

  // Form states
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

  // Multi-step states
  const [activeStep, setActiveStep] = useState(0);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    // Fetch countries using CountriesNow API
    axios.get('https://countriesnow.space/api/v0.1/countries')
      .then((res) => {
        if (!res.data.error) {
          const countryOptions = res.data.data.map((item: any) => ({
            value: item.country,
            label: item.country
          }));
          setCountries(countryOptions);
        }
      })
      .catch((err) => console.error("Error fetching countries", err));

    // Fetch filters
    axios.get('http://localhost:5000/api/images')
      .then((res) => {
        setFilters(res.data.map((img: any) => ({
          id: img._id,
          name: img.label || img.altText,
          url: img.imageUrl,
        })));
      });

    // Fetch system settings
    axios.get('http://localhost:5000/api/schedules/settings')
      .then((res) => {
        if (res.data && res.data.bookingSystemType) {
          setBookingSystemType(res.data.bookingSystemType);
        }
      })
      .catch((err) => console.error("Error fetching settings", err));
  }, []);

  useEffect(() => {
    // Fetch slots for the selected date
    if (bookingDate) {
      axios.get(`http://localhost:5000/api/schedules/daily?date=${bookingDate}`)
        .then((res) => {
          let slots = res.data.slots || [];
          if (slots.length === 0) {
            // Default slots si no hay plantilla aplicada
            slots = [
              { startTime: '20:00', endTime: '21:00' },
              { startTime: '21:00', endTime: '22:00' },
              { startTime: '22:00', endTime: '23:00' },
              { startTime: '23:00', endTime: '00:00' },
            ];
          }

          // Filtrar franjas que ya pasaron
          const today = new Date();
          // Ajustar zona horaria local para comparar correctamente
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

          setAvailableSlots(slots.map((s: any) => ({
            value: `${s.startTime}-${s.endTime}`,
            label: `${s.startTime} - ${s.endTime}`
          })));
          setTimeSlot(null); // reset selected slot
        })
        .catch(() => {
          setAvailableSlots([]);
        });
    }
  }, [bookingDate]);

  const handleCountryChange = (selectedCountry: string | null) => {
    setCountry(selectedCountry);
    setCity(''); // Reset city when country changes
    setCities([]);
    
    if (selectedCountry) {
      setIsFetchingCities(true);
      axios.post('https://countriesnow.space/api/v0.1/countries/cities', { country: selectedCountry })
        .then((res) => {
          if (!res.data.error) {
            const cityOptions = res.data.data.map((cityName: string) => ({
              value: cityName,
              label: cityName
            }));
            setCities(cityOptions);
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
      reader.onloadend = () => {
        setFileImageBase64(reader.result as string);
      };
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
          const y = (img.height - size) / 2;
          ctx.drawImage(img, x, y, size, size, 0, 0, 512, 512);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handleDataSubmitAndPay = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFilter) {
      alert('Debes seleccionar un filtro primero.');
      return;
    }

    if (!habeasData) {
      alert('Debes aceptar la política de tratamiento de datos personales para continuar.');
      return;
    }

    try {
      // 1. Inicializar la reserva como pendiente sin foto todavía
      const initRes = await axios.post('http://localhost:5000/api/bookings/init', {
        name, docId, email, whatsapp, country, city, selectedFilter, timeSlot, bookingDate,
        imageBase64: '' // No photo yet
      });
      const generatedBookingId = initRes.data.id;
      setBookingId(generatedBookingId);

      // Parametros para pago
      const amountInCents = 1500000; // Ej: $15.000 COP
      const reference = `booking-${generatedBookingId}`;

      const wompiRes = await axios.get(`http://localhost:5000/api/wompi/integrity-signature?reference=${reference}&amountInCents=${amountInCents}&currency=COP`);
      const { signature } = wompiRes.data;

      const checkout = new (window as any).WidgetCheckout({
        currency: 'COP',
        amountInCents: amountInCents,
        reference: reference,
        publicKey: 'pub_test_Q5yDA9xoKdePzhSGeVe9HAez7HgGORGf', // Test public key
        signature: { integrity: signature },
      });

      checkout.open((result: any) => {
        const transaction = result.transaction;
        console.log('Transaction result: ', transaction);
        setPaymentStatus(transaction.status);

        if(transaction.status === 'APPROVED') {
          // Go to step 3 (Photo)
          setActiveStep(2);
        } else {
          // Go to step 4 (Failed/Pending Payment QR view)
          setActiveStep(3);
        }
      });
    } catch (error) {
      console.error('Error iniciando pago con Wompi:', error);
      alert('Error al iniciar el pago.');
    }
  };

  const submitPhotoAndConfirm = async () => {
    let finalImage = useWebcam ? capturedImage : fileImageBase64;
    if (!finalImage || !bookingId) {
      alert('Por favor, tómate una foto o sube un archivo.');
      return;
    }

    setIsUploadingPhoto(true);

    try {
      finalImage = await resizeImage(finalImage);
      
      const confirmRes = await axios.post(`http://localhost:5000/api/bookings/${bookingId}/confirm-payment`, {
        imageBase64: finalImage
      });
      
      setFinalResult(confirmRes.data);
      setActiveStep(3); // Go to final result screen
    } catch (err) {
      console.error(err);
      alert('Hubo un error subiendo tu foto.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <Container size="md" py={{ base: 'md', sm: 'xl' }} px={{ base: 'xs', sm: 'md' }}>
      <Title order={2} ta="center" mb="xl" c="blue.7">
        Reserva tu Photobooth
      </Title>

      <Stepper active={activeStep} onStepClick={setActiveStep} allowNextStepsSelect={false} mb="xl">
        <Stepper.Step label="Elegir Estilo" description="Selecciona el filtro" />
        <Stepper.Step label="Pago" description="Ingresa datos y paga" />
        <Stepper.Step label="Foto" description="Tómate la foto" />
        <Stepper.Step label="Resultado" description="Tu turno" />
      </Stepper>

      {/* STEP 1: FILTERS */}
      {activeStep === 0 && (
        <Box>
          <Text ta="center" size="lg" mb="md" fw={500}>1. Selecciona el estilo que deseas para tu proyección</Text>
          {filters.length === 0 ? (
            <Text c="dimmed" ta="center">No hay filtros activos en este momento.</Text>
          ) : (
            <Grid>
              {filters.map(f => (
                <Grid.Col span={{ base: 6, sm: 4 }} key={f.id}>
                  <Card 
                    shadow="sm" 
                    padding="sm" 
                    radius="md" 
                    withBorder 
                    style={{ 
                      cursor: 'pointer', 
                      borderColor: selectedFilter === f.id ? '#228be6' : '#e9ecef',
                      borderWidth: selectedFilter === f.id ? '2px' : '1px',
                      transform: selectedFilter === f.id ? 'scale(1.02)' : 'scale(1)',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => setSelectedFilter(f.id)}
                  >
                    <Card.Section>
                      <Image src={f.url} height={160} alt={f.name} />
                    </Card.Section>
                    <Text fw={500} ta="center" mt="md">{f.name}</Text>
                    {selectedFilter === f.id && (
                      <Badge color="blue" variant="filled" style={{ position: 'absolute', top: 10, right: 10 }}>
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
              onClick={() => {
                if(!selectedFilter) return alert('Selecciona un filtro para continuar');
                setActiveStep(1);
              }}
            >
              Siguiente Paso
            </Button>
          </Group>
        </Box>
      )}

      {/* STEP 2: DATA & PAYMENT */}
      {activeStep === 1 && (
        <Box component="form" onSubmit={handleDataSubmitAndPay} style={{ backgroundColor: 'white', padding: isMobile ? '1rem' : '2rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <Text fw={500} size="lg" mb="md">2. Llena tus datos para realizar el pago</Text>
          <Grid>
            <Grid.Col span={12}>
              <TextInput label="Nombre completo" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
            </Grid.Col>
            <Grid.Col span={12}>
              <TextInput label="ID / Cédula" required value={docId} onChange={(e) => setDocId(e.currentTarget.value)} />
            </Grid.Col>
            <Grid.Col span={12}>
              <TextInput type="email" label="Correo Electrónico" required value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
            </Grid.Col>
            <Grid.Col span={12}>
              <TextInput label="WhatsApp (Celular)" required placeholder="Ej: +573001234567" value={whatsapp} onChange={(e) => setWhatsapp(e.currentTarget.value)} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select 
                label="Nacionalidad (País)" 
                placeholder="Selecciona tu país" 
                data={countries} 
                searchable 
                required
                value={country}
                onChange={handleCountryChange}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select 
                label="Ciudad" 
                placeholder={country ? "Selecciona tu ciudad" : "Primero selecciona un país"} 
                data={cities}
                searchable
                disabled={!country || isFetchingCities}
                required 
                value={city} 
                onChange={(val) => setCity(val || '')} 
              />
            </Grid.Col>

            {bookingSystemType === 'slots' && (
              <>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput 
                    type="date" 
                    label="Fecha de reserva" 
                    required 
                    value={bookingDate} 
                    onChange={(e) => setBookingDate(e.currentTarget.value)} 
                    min={new Date().toISOString().split('T')[0]}
                  />
                </Grid.Col>

                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select 
                    label="Franja horaria a elegir" 
                    placeholder="Selecciona la hora de proyección" 
                    data={availableSlots}
                    required
                    value={timeSlot}
                    onChange={setTimeSlot}
                    disabled={availableSlots.length === 0}
                  />
                </Grid.Col>
              </>
            )}

            <Grid.Col span={12} mt="sm">
              <Checkbox
                label={<Text size="sm">Acepto la <a href="#" target="_blank" style={{color: '#228be6'}}>política de tratamiento de datos personales (Habeas Data)</a>.</Text>}
                checked={habeasData}
                onChange={(event) => setHabeasData(event.currentTarget.checked)}
                required
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <Group justify="space-between" mt="md">
                <Button variant="default" onClick={() => setActiveStep(0)}>Volver</Button>
                <Button 
                  type="submit" 
                  size="lg" 
                  color="indigo" 
                  leftSection={<IconCreditCard size={24} />}
                >
                  Pagar con Wompi ($15.000 COP)
                </Button>
              </Group>
            </Grid.Col>
          </Grid>
        </Box>
      )}

      {/* STEP 3: PHOTO CAPTURE */}
      {activeStep === 2 && (
        <Box style={{ backgroundColor: 'white', padding: isMobile ? '1rem' : '2rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <Title order={3} mb="sm" c="teal.7">¡Pago Aprobado!</Title>
          <Text fw={500} size="lg" mb="xl">Ahora, sube tu foto o tómate una selfie para la proyección.</Text>

          <Group justify="center" mb="md">
            <FileInput 
              key={fileImageBase64 ? 'loaded' : 'empty'}
              placeholder="Galería" 
              accept="image/*" 
              onChange={(file) => { setUseWebcam(false); handleFileChange(file); }}
              leftSection={<IconUpload size={16}/>}
              style={{ flex: 1, maxWidth: '200px' }}
            />
            <Button 
              variant="outline" 
              onClick={() => { setUseWebcam(true); openCameraModal(); }} 
              leftSection={<IconCamera size={16}/>}
            >
              Tomar Selfie
            </Button>
          </Group>

          {((!useWebcam && fileImageBase64) || (useWebcam && capturedImage)) && (
            <Box ta="center" mt="md" p="sm" style={{ border: '1px dashed #ccc', borderRadius: '8px', maxWidth: '300px', margin: '0 auto' }}>
              <Text size="xs" c="dimmed" mb="xs">Imagen seleccionada:</Text>
              <img 
                src={(useWebcam ? capturedImage : fileImageBase64) as string} 
                alt="Preview" 
                style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', objectFit: 'cover' }} 
              />
              <Button 
                fullWidth 
                variant="light" 
                color="red" 
                mt="sm" 
                leftSection={<IconX size={16} />} 
                onClick={() => { setCapturedImage(null); setFileImageBase64(null); setUseWebcam(false); }}
              >
                Quitar imagen
              </Button>
            </Box>
          )}

          <Group justify="center" mt="xl">
            <Button 
              size="lg" 
              color="teal"
              loading={isUploadingPhoto}
              onClick={submitPhotoAndConfirm}
              disabled={(!useWebcam && !fileImageBase64) || (useWebcam && !capturedImage)}
            >
              Finalizar y Reservar Turno
            </Button>
          </Group>
        </Box>
      )}

      {/* STEP 4: FINAL RESULT / QR VIEW */}
      {activeStep === 3 && (
        <Box style={{ backgroundColor: 'white', padding: isMobile ? '1rem' : '2rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          {paymentStatus === 'APPROVED' ? (
            <>
              <Title order={3} mb="md" c="blue.7">¡Reserva Completada Exitosamente!</Title>
              
              {finalResult?.queuePosition && (
                <Text size="xl" fw={700} c="dimmed" mb="xs">
                  Tu turno en la fila es el #{finalResult.queuePosition}
                </Text>
              )}
              <Text size="lg" mb="xl">
                La hora asignada para tu proyección es a las <Text span fw={700} c="blue">{finalResult?.exactTime || 'Sin asignar'}</Text>.
              </Text>
              
              <Text c="dimmed" mb="md">
                Guarda este QR o busca tu reserva con tu cédula en el portal para ver su estado en tiempo real.
              </Text>
              
              <Box style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '2rem' }}>
                <QRCode value={`${window.location.origin}/my-bookings`} size={150} />
              </Box>
            </>
          ) : (
            <>
              <Title order={3} mb="md" c="orange.7">Tu pago está procesándose o no fue aprobado</Title>
              <Text size="lg" mb="xl">
                No te preocupes. Escanea el código QR a continuación para acceder a nuestro portal. 
                Si tu pago se aprueba, podrás completar tu reserva o revisar el estado desde allí ingresando tu cédula o email.
              </Text>
              
              <Box style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '2rem' }}>
                <QRCode value={`${window.location.origin}/my-bookings`} size={150} />
              </Box>
            </>
          )}

          <Group justify="center">
            <Button size="lg" leftSection={<IconSearch size={20} />} onClick={() => navigate('/my-bookings')}>
              Ir a Mis Proyecciones
            </Button>
          </Group>
        </Box>
      )}

      <Modal 
        opened={cameraModalOpened} 
        onClose={closeCameraModal} 
        fullScreen={isMobile} 
        size="xl"
        title="Acomoda tu mejor pose"
        styles={{
          body: { height: isMobile ? 'calc(100vh - 60px)' : 'auto', display: 'flex', flexDirection: 'column' }
        }}
      >
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Box style={{ width: '100%', maxWidth: '600px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000' }}>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: 'user', height: 720 }}
              style={{ width: '100%', height: '60vh', objectFit: 'cover', display: 'block' }}
            />
          </Box>
          <Button 
            size="xl" 
            radius="xl" 
            color="blue" 
            mt="xl" 
            onClick={capture} 
            leftSection={<IconCamera size={24}/>}
          >
            Capturar Foto
          </Button>
        </Box>
      </Modal>

    </Container>
  );
}
