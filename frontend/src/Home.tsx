import { useEffect, useState } from 'react';
import { Container, Title, Text, Button, Box, Group } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mantine/hooks';
import { useLanguage } from './i18n';
import './falling.css';
import './graffiti.css';
import './ledson-clean.css';
import { API_BASE_URL } from './config';

interface PhotoboothImage {
  _id: string;
  imageUrl: string;
  altText: string;
}

export function Home() {
  const [images, setImages] = useState<PhotoboothImage[]>([]);
  const navigate = useNavigate();
  const { t } = useLanguage();
  // Mismos puntos de quiebre que ledson-clean.css (700 de ancho,
  // 800 / 560 de alto) para que los espaciados queden proporcionales
  // en cada tamaño. El alto manda sobre el ancho: una pantalla ancha pero
  // baja (tablet/laptop en horizontal) debe compactarse igual que un
  // celular bajito, para nunca generar scroll vertical.
  const isDesktop = useMediaQuery('(min-width: 700px)');
  const isShort = useMediaQuery('(max-height: 800px)');
  const isVeryShort = useMediaQuery('(max-height: 560px)');
  // Modo "amplio": solo cuando hay ancho Y alto de sobra (desktop/demo real).
  const roomy = isDesktop && !isShort;

  const containerPy = isVeryShort ? 2 : roomy ? 40 : 6;
  const groupMt = isVeryShort ? 6 : roomy ? 20 : 10;

  useEffect(() => {
    // El backend ya siembra los filtros de ejemplo una sola vez al arrancar
    // (ver ImagesService.onModuleInit) — llamar a /seed acá en cada carga era
    // un viaje redundante a Firestore, y además bloqueaba secuencialmente la
    // carga real de los filtros.
    fetch(`${API_BASE_URL}/api/images`)
      .then((res) => res.json())
      .then((data) => setImages(data))
      .catch((err) => console.error('Error fetching images:', err));
  }, []);

  return (
    <Box className="graffiti-wall ledson-home-wrap">
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
      {/* Splatters decorativos de fondo */}
       <div className="spray-cloud spray-cloud--pink" />
      <div className="spray-cloud spray-cloud--cyan" />
      <div className="spray-cloud spray-cloud--yellow" />

      {/* Salpicaduras irregulares de pintura */}
      <svg className="splat splat--1" viewBox="0 0 200 200" fill="#ff3399">
        <path d="M100 20c18 8 22 30 40 30s30-18 40 4-6 38-2 54 18 30 0 42-40-2-54 8-22 34-44 30-26-26-44-32-40 6-50-14 8-36 4-54-18-30 0-44 38 4 54-6 28-36 60-28z" />
        <circle cx="30" cy="40" r="6" /><circle cx="175" cy="150" r="5" /><circle cx="60" cy="180" r="4" />
      </svg>
      <svg className="splat splat--2" viewBox="0 0 200 200" fill="#29c5ff">
        <path d="M96 24c20 4 18 28 38 32s34-12 42 10-10 36-4 52 16 34-4 44-38-6-52 4-26 30-46 24-20-30-38-38-38 10-48-12 12-34 8-52-16-32 4-44 36 8 52-2 22-30 62-22z" />
        <circle cx="40" cy="60" r="5" /><circle cx="160" cy="40" r="4" /><circle cx="150" cy="170" r="6" />
      </svg>
      <svg className="splat splat--3" viewBox="0 0 200 200" fill="#ffbe1e">
        <path d="M100 16c16 10 26 26 44 28s28-16 38 6-8 38 0 54 16 28-2 42-36 0-50 12-24 32-46 26-22-28-40-34-36 12-48-8 10-38 4-56-14-28 6-42 36 6 50-4 26-34 64-24z" />
        <circle cx="34" cy="48" r="5" /><circle cx="168" cy="130" r="6" /><circle cx="70" cy="172" r="4" />
      </svg>

      {/* Imágenes cayendo */}
      <div className="falling-container">
        {images.map((img) => {
          const leftPosition = Math.random() * 80 + 10;
          const animationDuration = Math.random() * 5 + 8;
          const animationDelay = Math.random() * 5;
          return (
            <img
              key={img._id}
              src={img.imageUrl}
              alt={img.altText}
              className="falling-image graffiti-photo"
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

      {/* Contenido principal */}
      <Container size="md" py={containerPy} px={{ base: 'xs', sm: 'md' }} style={{ position: 'relative', zIndex: 2 }}>
        <Title order={1} ta="center" className="ledson-title">
          {t('homeTitle')}
        </Title>
        <Text ta="center" className="ledson-subtitle">
          {t('homeSubtitle')}
        </Text>

        <Box className="ledson-progress">
          <Box className="ledson-progress-bars">
            <span className="ledson-progress-seg" data-state="active" />
            <span className="ledson-progress-seg" />
            <span className="ledson-progress-seg" />
            <span className="ledson-progress-seg" />
            <span className="ledson-progress-seg" />
          </Box>
          <Text component="span" className="ledson-progress-caption">INICIO</Text>
        </Box>

        <Box className="ledson-card ledson-card--center">
          <Box className="ledson-card-bleed-top">
            <img src="/imagenes/inicioc13.png" alt="Comuna 13, Medellín" />
          </Box>

          <Title order={2} className="ledson-welcome-title">
            {t('welcomeTitle')}
          </Title>
          <Text className="ledson-body-text">{t('welcomeText1')}</Text>
          <Text className="ledson-body-text">{t('welcomeText2')}</Text>

          <Group justify="center" align="center" gap="md" mt={groupMt}>
            <Button
              fullWidth
              size="lg"
              className="ledson-btn-primary"
              rightSection={<IconArrowRight size={20} />}
              onClick={() => navigate('/booking')}
            >
              {t('startBtn')}
            </Button>
          </Group>
        </Box>
      </Container>
    </Box>
  );
}