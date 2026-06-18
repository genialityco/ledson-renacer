import React, { useState, useRef, useEffect } from 'react';
import { Container, Title, TextInput, Select, Button, Box, Group, FileInput, Text, Grid, Radio, Checkbox } from '@mantine/core';
import { IconCamera, IconUpload, IconDeviceFloppy } from '@tabler/icons-react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface FilterOption {
  id: string;
  name: string;
  url: string;
}

export function AssistedBookingForm() {
  const navigate = useNavigate();
  const [countries, setCountries] = useState<{ value: string; label: string }[]>([]);
  const [cities, setCities] = useState<{ value: string; label: string }[]>([]);
  const [isFetchingCities, setIsFetchingCities] = useState(false);
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
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [requiresInvoice, setRequiresInvoice] = useState('NO');
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
    if (imageSrc) setCapturedImage(imageSrc);
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

  const saveBooking = async (e: React.FormEvent) => {
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

    finalImage = await resizeImage(finalImage);

    try {
      const res = await axios.post('http://localhost:5000/api/bookings', {
        name, docId, email, whatsapp, country, city, selectedFilter, timeSlot, bookingDate,
        imageBase64: finalImage,
        paymentMethod,
        requiresInvoice: requiresInvoice === 'SI'
      });
      const exactTime = res.data?.exactTime || 'Sin asignar';
      alert(`¡Reserva asistida creada exitosamente! Tu tiempo exacto de proyección asignado es a las: ${exactTime}`);
      navigate('/');
    } catch (error) {
      console.error('Error al guardar la reserva', error);
      alert('Hubo un error guardando tus datos.');
    }
  }

  return (
    <Container size="sm" py="xl">
      <Title order={2} ta="center" mb="sm" c="blue.7">
        Reserva Asistida
      </Title>
      <Text ta="center" c="dimmed" mb="xl">
        Punto de venta físico - Galería Renacer (Piso 1)
      </Text>

      <Box component="form" onSubmit={saveBooking} style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
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
            <Text fw={500} size="sm" mb="xs">5. Sube aquí tu foto / Tomar foto</Text>
            <Group mb="sm">
              <Button variant={useWebcam ? 'default' : 'filled'} onClick={() => setUseWebcam(false)} leftSection={<IconUpload size={16}/>}>Subir Archivo</Button>
              <Button variant={useWebcam ? 'filled' : 'default'} onClick={() => setUseWebcam(true)} leftSection={<IconCamera size={16}/>}>Usar Cámara</Button>
            </Group>
            
            {!useWebcam ? (
              <FileInput 
                placeholder="Selecciona una imagen..." 
                accept="image/*" 
                onChange={handleFileChange}
              />
            ) : (
              <Box>
                {!capturedImage ? (
                  <Box style={{ position: 'relative', width: '100%', maxWidth: '300px', margin: '0 auto' }}>
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      style={{ width: '100%', borderRadius: '8px' }}
                    />
                    <Button fullWidth mt="sm" onClick={capture}>Capturar Foto</Button>
                  </Box>
                ) : (
                  <Box ta="center">
                    <img src={capturedImage} alt="Captura" style={{ width: '100%', maxWidth: '300px', borderRadius: '8px' }} />
                    <Button fullWidth mt="sm" color="red" variant="light" onClick={() => setCapturedImage(null)}>Tomar de nuevo</Button>
                  </Box>
                )}
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

          <Grid.Col span={12}>
            <Select 
              label="8. Método de pago físico" 
              placeholder="Efectivo, Datáfono o QR" 
              data={['Efectivo', 'Datáfono', 'QR']}
              required
              value={paymentMethod}
              onChange={(val) => val && setPaymentMethod(val)}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Radio.Group
              label="9. ¿Requiere factura electrónica?"
              withAsterisk
              value={requiresInvoice}
              onChange={setRequiresInvoice}
            >
              <Group mt="xs">
                <Radio value="SI" label="Sí" />
                <Radio value="NO" label="No" />
              </Group>
            </Radio.Group>
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
              color="teal" 
              mt="md" 
              leftSection={<IconDeviceFloppy size={24} />}
            >
              Confirmar y Guardar Reserva
            </Button>
          </Grid.Col>
        </Grid>
      </Box>
    </Container>
  );
}
