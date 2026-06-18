import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Container, Title, Box, Text, Transition as MantineTransition } from '@mantine/core';
import { TransitionGroup, CSSTransition } from 'react-transition-group';
import axios from 'axios';
import './falling.css';

const CarouselItem = ({ item, transitionClass, onEnded, ...props }: any) => {
  const nodeRef = useRef(null);
  if (!item) return null;

  return (
    <CSSTransition {...props} nodeRef={nodeRef} timeout={1000} classNames={transitionClass}>
      <Box ref={nodeRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: item.type === 'video' ? '#000' : 'transparent', zIndex: item.type === 'video' ? 1000 : 1 }}>
        {item.type === 'video' ? (
          <video 
            src={item.url} 
            autoPlay={props.in}
            muted 
            playsInline
            onEnded={() => {
              if(props.in) onEnded();
            }}
            style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: props.in ? 1 : 0, transition: 'opacity 0.5s' }}
          />
        ) : (
          <img 
            src={item.url} 
            alt="Carousel" 
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
          />
        )}
      </Box>
    </CSSTransition>
  );
};

export function BigScreenView() {
  const [settings, setSettings] = useState<any>({
    backgroundUrl: '',
    headerUrl: '',
    footerUrl: '',
    carouselImages: [],
    contentGrid: [],
    currentProjection: null
  });
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [currentTimeStr, setCurrentTimeString] = useState('');
  const prevItemsKeyRef = useRef('');

  const fetchSettings = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/bookings/screen-settings');
      if (res.data) {
        setSettings(res.data);
      }
    } catch (e) {
      console.error('Error fetching projections:', e);
    }
  };

  useEffect(() => {
    fetchSettings();
    const interval = setInterval(fetchSettings, 3000);
    
    const clockInterval = setInterval(() => {
      const d = new Date();
      setCurrentTimeString(d.toTimeString().slice(0, 8)); // HH:mm:ss
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, []);

  const effectiveCarouselItems = useMemo(() => {
    if (!settings.contentGrid || settings.contentGrid.length === 0) {
      return (settings.carouselImages || []).map((url: string, idx: number) => ({ id: `carousel-${idx}`, url, type: 'image', duration: settings.carouselDuration || 5 }));
    }
    
    const activeItems = settings.contentGrid.filter((item: any) => {
      if (!item.active) return false;
      if (item.type === 'video') {
        return currentTimeStr >= item.startTime && (!item.endTime || currentTimeStr <= item.endTime);
      }
      return currentTimeStr >= item.startTime && currentTimeStr <= item.endTime;
    });

    if (activeItems.length === 0) {
      return (settings.carouselImages || []).map((url: string, idx: number) => ({ id: `carousel-${idx}`, url, type: 'image', duration: settings.carouselDuration || 5 }));
    }

    activeItems.sort((a: any, b: any) => b.priority - a.priority);
    const maxPriority = activeItems[0].priority;
    const topPriorityItems = activeItems.filter((item: any) => item.priority === maxPriority);
    
    return topPriorityItems.map((item: any, idx: number) => ({
      id: item.id || `grid-${idx}`,
      url: item.url,
      type: item.type || 'image',
      duration: item.duration || 5
    }));
  }, [settings.contentGrid, settings.carouselImages, currentTimeStr, settings.carouselDuration]);

  // Reset índice solo cuando cambia el contenido real (comparando URLs)
  useEffect(() => {
    const key = effectiveCarouselItems.map((i: any) => i.url).join(',');
    if (key !== prevItemsKeyRef.current) {
      prevItemsKeyRef.current = key;
      setCarouselIndex(0);
    }
  });

  // Lógica de expiración de la proyección
  useEffect(() => {
    if (settings.currentProjection && settings.currentProjection.timestamp) {
      const timeElapsed = Date.now() - settings.currentProjection.timestamp;
      const PROJECTION_DURATION = (settings.projectionDuration || 15) * 1000;
      const timeRemaining = PROJECTION_DURATION - timeElapsed;
      
      if (timeRemaining > 0) {
        const timer = setTimeout(() => {
          axios.post(`http://localhost:5000/api/bookings/${settings.currentProjection.id}/complete`);
        }, timeRemaining);
        return () => clearTimeout(timer);
      } else {
        axios.post(`http://localhost:5000/api/bookings/${settings.currentProjection.id}/complete`);
      }
    }
  }, [settings.currentProjection]);

  const numItems = effectiveCarouselItems?.length || 0;
  const currentItem = numItems > 0 ? effectiveCarouselItems[carouselIndex % numItems] : null;

  // Rotación del carrusel
  useEffect(() => {
    if (numItems === 0 || settings.currentProjection) return;
    if (currentItem?.type === 'video') return;

    const durationMs = (currentItem?.duration || 5) * 1000;

    const timer = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % numItems);
    }, durationMs);

    return () => clearInterval(timer);
  }, [numItems, currentItem?.type, currentItem?.duration, settings.currentProjection]);

  const handleVideoEnded = () => {
    setCarouselIndex(prev => (prev + 1) % numItems);
  };

  const hasCarousel = numItems > 0;
  const transitionClass = `carousel-${settings.carouselTransitionDirection || 'fade'}`;

  // Guardar la última proyección para que la animación de salida sepa qué renderizar
  const [displayProjection, setDisplayProjection] = useState<any>(null);
  useEffect(() => {
    if (settings.currentProjection) {
      setDisplayProjection(settings.currentProjection);
    }
  }, [settings.currentProjection]);

  const particleTransition = {
    in: { opacity: 1, WebkitMaskSize: '200px 200px', transform: 'scale(1)', filter: 'blur(0px)' },
    out: { opacity: 0, WebkitMaskSize: '2px 2px', transform: 'scale(1.2)', filter: 'blur(10px)' },
    transitionProperty: 'opacity, -webkit-mask-size, transform, filter',
  };

  const currentTransition = displayProjection?.transitionEffect === 'particles' 
    ? particleTransition 
    : (displayProjection?.transitionEffect || 'fade');

  return (
    <Box style={{ 
      width: '100vw', 
      height: '100vh', 
      backgroundColor: '#000', 
      backgroundImage: settings.backgroundUrl ? `url(${settings.backgroundUrl})` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* HEADER */}
      {settings.headerUrl && (
        <Box style={{ width: '100%', height: '15vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <img src={settings.headerUrl} alt="Header" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
        </Box>
      )}

      {/* CONTENIDO CENTRAL */}
      <Box style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        
        {/* El carrusel siempre está renderizado debajo */}
        <Box style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'absolute', overflow: 'hidden', zIndex: 10 }}>
          {hasCarousel ? (
            <TransitionGroup style={{ width: '100%', height: '100%', position: 'relative' }} childFactory={(child) => React.cloneElement(child as React.ReactElement<any>, { classNames: transitionClass })}>
              <CarouselItem 
                key={currentItem?.id + '-' + carouselIndex} 
                item={currentItem} 
                transitionClass={transitionClass} 
                onEnded={handleVideoEnded}
              />
            </TransitionGroup>
          ) : (
            <Container style={{ textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: '2rem', borderRadius: '16px' }}>
              <Title order={1} size="4rem" c="white">Led's on Renacer Photobooth</Title>
              <Text size="xl" c="gray.3" mt="md">¡Escanea el QR y aparece aquí!</Text>
            </Container>
          )}
        </Box>

        <MantineTransition 
          mounted={!!settings.currentProjection} 
          transition={currentTransition} 
          duration={displayProjection?.transitionEffect === 'particles' ? 2000 : 1000} 
          timingFunction="ease"
        >
          {(styles) => (
            <div style={{ ...styles, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'absolute', top: 0, left: 0, zIndex: 20 }}>
              <Box style={{ 
                flex: 1, 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                position: 'relative', 
                overflow: 'hidden',
                WebkitMaskImage: displayProjection?.transitionEffect === 'particles' ? 'radial-gradient(circle, black 60%, transparent 70%)' : 'none',
                WebkitMaskRepeat: 'repeat',
                WebkitMaskPosition: 'center'
              }}>
                <Box style={{ position: 'relative', height: '100%', aspectRatio: '1 / 1', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <img 
                    src={displayProjection?.imageUrl} 
                    alt="Proyección" 
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} 
                  />
                  {displayProjection?.frameUrl && (
                    <img 
                      src={displayProjection?.frameUrl} 
                      alt="Marco" 
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} 
                    />
                  )}
                </Box>
              </Box>
            </div>
          )}
        </MantineTransition>

      </Box>

      {/* FOOTER */}
      {settings.footerUrl && (
        <Box style={{ width: '100%', height: '15vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 30 }}>
          <img src={settings.footerUrl} alt="Footer" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
        </Box>
      )}
    </Box>
  );
}