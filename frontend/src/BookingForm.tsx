import React, { useState, useRef, useEffect } from 'react';
import { Container, Title, TextInput, Select, Button, Box, Group, FileInput, Text, Grid, Modal, Checkbox } from '@mantine/core';
import { IconCamera, IconUpload, IconCreditCard, IconX } from '@tabler/icons-react';
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
      const img = new Image();
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

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalImage = useWebcam ? capturedImage : fileImageBase64;
    if (!finalImage) {
      alert('Por favor, tómate una foto o sube un archivo.');
      return;
    }

    if (!habeasData) {
      alert('Debes aceptar la política de tratamiento de datos personales para continuar.');
      return;
    }

    try {
      if (finalImage) {
        finalImage = await resizeImage(finalImage);
      }
      
      // 1. Inicializar la reserva como pendiente ANTES de abrir Wompi
      const initRes = await axios.post('http://localhost:5000/api/bookings/init', {
        name, docId, email, whatsapp, country, city, selectedFilter, timeSlot, bookingDate,
        imageBase64: finalImage
      });
      const bookingId = initRes.data.id;

      // Parametros para pago
      const amountInCents = 1500000; // Ej: $15.000 COP
      const reference = `booking-${bookingId}`;

      const wompiRes = await axios.get(`http://localhost:5000/api/wompi/integrity-signature?reference=${reference}&amountInCents=${amountInCents}&currency=COP`);
      const { signature } = wompiRes.data;

      const checkout = new (window as any).WidgetCheckout({
        currency: 'COP',
        amountInCents: amountInCents,
        reference: reference,
        publicKey: 'pub_test_Q5yDA9xoKdePzhSGeVe9HAez7HgGORGf', // Test public key
        signature: { integrity: signature },
      });

      checkout.open(async (result: any) => {
        const transaction = result.transaction;
        console.log('Transaction result: ', transaction);
        if(transaction.status === 'APPROVED') {
          // 2. Confirmar la reserva si el pago fue aprobado
          try {
            const confirmRes = await axios.post(`http://localhost:5000/api/bookings/${bookingId}/confirm-payment`);
            const exactTime = confirmRes.data?.exactTime || 'Sin asignar';
            alert(`¡Reserva creada exitosamente! Tu tiempo exacto de proyección será a las: ${exactTime}`);
            navigate('/');
          } catch(err) {
             alert('El pago fue aprobado pero hubo un error confirmando tus datos.');
          }
        } else {
          alert('Estado del pago: ' + transaction.status);
          // Si falló o declinó, se queda en PENDING en backend,
          // y el cron se encargará de enviarle el correo.
        }
      });
    } catch (error) {
      console.error('Error iniciando pago con Wompi:', error);
      alert('Error al iniciar el pago.');
    }
  };

  return (
    <Container size="sm" py={{ base: 'md', sm: 'xl' }} px={{ base: 'xs', sm: 'md' }}>
      <Title order={2} ta="center" mb="xl" c="blue.7">
        Reserva tu Photobooth
      </Title>

      <Box component="form" onSubmit={handlePayment} style={{ backgroundColor: 'white', padding: isMobile ? '1rem' : '2rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <Grid>
          <Grid.Col span={12}>
            <TextInput label="1. Nombre" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
          </Grid.Col>
          <Grid.Col span={12}>
            <TextInput label="2. ID / Cédula" required value={docId} onChange={(e) => setDocId(e.currentTarget.value)} />
          </Grid.Col>
          <Grid.Col span={12}>
            <TextInput type="email" label="3. Correo Electrónico" required value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          </Grid.Col>
          <Grid.Col span={12}>
            <TextInput label="WhatsApp (Celular)" required placeholder="Ej: +573001234567" value={whatsapp} onChange={(e) => setWhatsapp(e.currentTarget.value)} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select 
              label="4. Nacionalidad (País)" 
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

          <Grid.Col span={12}>
            <Text fw={500} size="sm" mb="xs">5. Sube aquí tu foto</Text>
            <Group grow mb="sm">
              <FileInput 
                key={fileImageBase64 ? 'loaded' : 'empty'}
                placeholder="Galería" 
                accept="image/*" 
                onChange={(file) => { setUseWebcam(false); handleFileChange(file); }}
                leftSection={<IconUpload size={16}/>}
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
              <Box ta="center" mt="md" p="sm" style={{ border: '1px dashed #ccc', borderRadius: '8px' }}>
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
          </Grid.Col>

          <Grid.Col span={12}>
            <Select 
              label="6. Filtro a elegir" 
              placeholder="Selecciona un estilo" 
              data={filters.map(f => ({ value: f.id, label: f.name }))}
              required
              value={selectedFilter}
              onChange={setSelectedFilter}
            />
            {selectedFilter && (
              <Box mt="xs">
                <Text size="xs" c="dimmed">Muestra del filtro:</Text>
                <img 
                  src={filters.find(f => f.id === selectedFilter)?.url} 
                  alt="Muestra de filtro" 
                  style={{ height: '80px', borderRadius: '8px', marginTop: '4px' }} 
                />
              </Box>
            )}
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput 
              type="date" 
              label="7. Fecha de reserva" 
              required 
              value={bookingDate} 
              onChange={(e) => setBookingDate(e.currentTarget.value)} 
              min={new Date().toISOString().split('T')[0]}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select 
              label="8. Franja horaria a elegir" 
              placeholder="Selecciona la hora de proyección" 
              data={availableSlots}
              required
              value={timeSlot}
              onChange={setTimeSlot}
              disabled={availableSlots.length === 0}
            />
          </Grid.Col>

          <Grid.Col span={12} mt="sm">
            <Checkbox
              label={<Text size="sm">Acepto la <a href="#" target="_blank" style={{color: '#228be6'}}>política de tratamiento de datos personales (Habeas Data)</a>.</Text>}
              checked={habeasData}
              onChange={(event) => setHabeasData(event.currentTarget.checked)}
              required
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Button 
              type="submit" 
              fullWidth 
              size="lg" 
              color="indigo" 
              mt="md" 
              leftSection={<IconCreditCard size={24} />}
            >
              Pagar con Wompi ($15.000 COP)
            </Button>
          </Grid.Col>
        </Grid>
      </Box>

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
