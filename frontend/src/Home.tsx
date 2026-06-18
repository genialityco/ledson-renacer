import { useEffect, useState } from 'react';
import { Container, Title, Text, Button, Box, Group } from '@mantine/core';
import { IconCamera, IconSearch } from '@tabler/icons-react';
import QRCode from 'react-qr-code';
import { useNavigate } from 'react-router-dom';
import './falling.css';

interface PhotoboothImage {
  _id: string;
  imageUrl: string;
  altText: string;
}

export function Home() {
  const [images, setImages] = useState<PhotoboothImage[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Inicializar la DB con datos semilla (solo para desarrollo)
    fetch('http://localhost:5000/api/images/seed', { method: 'POST' })
      .then(() => {
        // 2. Obtener las imágenes desde el backend
        return fetch('http://localhost:5000/api/images');
      })
      .then((res) => res.json())
      .then((data) => {
        setImages(data);
      })
      .catch((err) => console.error('Error fetching images:', err));
  }, []);

  return (
    <Box style={{ position: 'relative', minHeight: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      
      {/* Contenedor de Animación de Imágenes Cayendo */}
      <div className="falling-container">
        {images.map((img) => {
          // Aleatorizar la posición, duración y retardo para un efecto más natural
          const leftPosition = Math.random() * 80 + 10; // Entre 10% y 90%
          const animationDuration = Math.random() * 5 + 8; // Entre 8s y 13s
          const animationDelay = Math.random() * 5; // Retardo inicial
          
          return (
            <img
              key={img._id}
              src={img.imageUrl}
              alt={img.altText}
              className="falling-image"
              style={{
                left: `${leftPosition}%`,
                animationDuration: `${animationDuration}s`,
                animationDelay: `${animationDelay}s`,
                width: '180px',
                height: 'auto',
              }}
            />
          );
        })}
      </div>

      {/* Contenido Principal */}
      <Container size="md" style={{ position: 'relative', zIndex: 1, paddingTop: '10vh' }}>
        <Box style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.85)', 
          padding: '3rem', 
          borderRadius: '16px',
          backdropFilter: 'blur(8px)',
          textAlign: 'center',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <Title order={1} size="3.5rem" mb="md" c="blue.7">
            Captura el Momento
          </Title>
          <Text size="xl" c="dimmed" mb="xl">
            Escanea el código QR con tu teléfono para reservar, tomarte tu foto y aparecer en la pantalla gigante.
          </Text>
          
          <Box style={{ background: 'white', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '2rem' }}>
            <QRCode value={`${window.location.origin}/booking`} size={200} />
          </Box>

          <Group justify="center" align="center" gap="md">
            <Button size="xl" leftSection={<IconCamera size={24} />} radius="xl" onClick={() => navigate('/booking')}>
              Simular Escaneo (Ir al Formulario)
            </Button>
            <Button size="xl" variant="outline" leftSection={<IconSearch size={24} />} radius="xl" onClick={() => navigate('/my-bookings')}>
              Mis Reservas
            </Button>
          </Group>
        </Box>
      </Container>
    </Box>
  );
}
