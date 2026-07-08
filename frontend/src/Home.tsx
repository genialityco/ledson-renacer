import { useEffect, useState } from 'react';
import { Container, Title, Text, Button, Box, Group } from '@mantine/core';
import { IconCamera } from '@tabler/icons-react';
import QRCode from 'react-qr-code';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from './i18n';
import './falling.css';
import './graffiti.css';
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

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/images/seed`, { method: 'POST' })
      .then(() => fetch(`${API_BASE_URL}/api/images`))
      .then((res) => res.json())
      .then((data) => setImages(data))
      .catch((err) => console.error('Error fetching images:', err));
  }, []);

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
      <Container size="md" style={{ position: 'relative', zIndex: 2, paddingTop: '8vh' }}>
        <Box className="graffiti-card">
          <span className="tag-corner tag-corner--tl">★</span>
          <span className="tag-corner tag-corner--br">✦</span>

          <Title order={1} className="graffiti-title">
            {t('captureMoment')}
          </Title>

          <Text className="graffiti-sub">
            {t('scanQR')}
          </Text>

          <Box className="qr-frame">
            <QRCode value={`${window.location.origin}/booking`} size={200} />
          </Box>

          <Group justify="center" align="center" gap="md">
            <Button
              size="xl"
              className="graffiti-btn"
              leftSection={<IconCamera size={24} />}
              radius="md"
              onClick={() => navigate('/booking')}
            >
              {t('simulateScan')}
            </Button>
          </Group>
        </Box>
      </Container>
    </Box>
  );
}