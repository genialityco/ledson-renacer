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
  const { t, language } = useLanguage();
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
  const groupMt = isVeryShort ? 6 : roomy ? 28 : 10;

  // Título de bienvenida partido en dos líneas fijas (en vez de dejar que
  // el texto haga wrap solo) para un balance visual prolijo en la tarjeta.
  const welcomeTitleLines = language === 'es'
    ? ["Bienvenido(a) a la", "Experiencia LED'S ON"]
    : ['Welcome to the', "LED'S ON Experience"];

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
    <Box className="ledson-bg-white ledson-home-wrap">
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
            {welcomeTitleLines[0]}
            <br />
            {welcomeTitleLines[1]}
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