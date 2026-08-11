import React, { useEffect, useState, useRef } from 'react';
import { Title, Box, Text, Transition as MantineTransition } from '@mantine/core';
import { TransitionGroup, CSSTransition } from 'react-transition-group';
import axios from 'axios';
import './falling.css';
import './graffiti.css';
import './ledson-clean.css';
import { SprayEffect } from './SprayEffect';
import QRCode from 'react-qr-code';
import { useLanguage } from './i18n';
import { API_BASE_URL } from './config';

const CarouselItem = ({ item, transitionClass, onEnded, classNames, ...props }: any) => {
  const nodeRef = useRef(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  if (!item) return null;

  // Tramo elegido por el admin (selector estilo Stories, máx. 15s) para este
  // ítem de la parrilla: no se recorta el archivo, solo se arranca y se
  // corta la reproducción en esos segundos.
  const trimStart = item.trimStart || 0;
  const trimEnd = item.trimEnd;

  const seekToTrimStart = () => {
    if (videoRef.current && trimStart > 0) videoRef.current.currentTime = trimStart;
  };

  const handleTimeUpdate = () => {
    if (trimEnd && videoRef.current && videoRef.current.currentTime >= trimEnd && props.in) {
      onEnded();
    }
  };

  return (
    <CSSTransition {...props} appear={true} nodeRef={nodeRef} timeout={1000} classNames={classNames || transitionClass}>
      <Box ref={nodeRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: item.type === 'video' ? '#000' : 'transparent', zIndex: item.type === 'video' ? 1000 : 1 }}>
        {item.type === 'video' ? (
          <video
            ref={videoRef}
            src={item.url}
            autoPlay={props.in}
            muted
            playsInline
            onLoadedMetadata={seekToTrimStart}
            onTimeUpdate={handleTimeUpdate}
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
  const [, setCurrentTimeString] = useState('');
  
  const [currentItem, setCurrentItem] = useState<any>(null);
  const lastGridItemIdRef = useRef<string | null>(null);
  const timerRef = useRef<any>(null);

  const settingsRef = useRef<any>(settings);
  const fallbackNodeRef = useRef(null);
  const projectionVideoRef = useRef<HTMLVideoElement>(null);
  const { t } = useLanguage();
  
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/bookings/screen-settings`);
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

  const advanceCarousel = () => {
    // Si hay una proyección activa, no queremos iterar y gastar "apariciones" o interrumpir.
    if (settingsRef.current.currentProjection) return;

    // Calculate current time explicitly to avoid stale closures
    const d = new Date();
    const currentStr = d.toTimeString().slice(0, 8);
    let nextItem = null;
    
    const currentSettings = settingsRef.current;
    const grid = currentSettings.contentGrid || [];
    let eligibleGridItems = grid.filter((item: any) => {
      if (!item.active) return false;
      
      if (currentSettings.globalGridStartTime && currentSettings.globalGridEndTime) {
        if (currentStr < currentSettings.globalGridStartTime || currentStr > currentSettings.globalGridEndTime) {
          return false;
        }
      }

      if (item.exclusionWindows && item.exclusionWindows.length > 0) {
        for (const w of item.exclusionWindows) {
          if (currentStr >= w.start && currentStr <= w.end) return false;
        }
      }

      const target = item.targetAppearances || 0;
      const current = item.currentAppearances || 0;
      if (target > 0 && current >= target) return false;

      const cooldownMs = (item.cooldownPeriod || 0) * 60 * 1000;
      if (item.lastShown && cooldownMs > 0) {
        if (Date.now() - item.lastShown < cooldownMs) return false;
      }

      return true;
    });

    if (eligibleGridItems.length > 0) {
      eligibleGridItems.sort((a: any, b: any) => b.priority - a.priority);
      const maxPriority = eligibleGridItems[0].priority;
      let topPriorityItems = eligibleGridItems.filter((i: any) => i.priority === maxPriority);

      if (topPriorityItems.length > 1 && lastGridItemIdRef.current) {
        const filtered = topPriorityItems.filter((i: any) => i.id !== lastGridItemIdRef.current);
        if (filtered.length > 0) topPriorityItems = filtered;
      }

      const randomIndex = Math.floor(Math.random() * topPriorityItems.length);
      const selected = topPriorityItems[randomIndex];

      nextItem = {
        id: selected.id,
        isGrid: true,
        url: selected.url,
        type: selected.type || 'image',
        duration: selected.duration || 10,
        transition: selected.transition || 'fade', // Usar transición individual
        renderKey: `grid-${selected.id}-${Date.now()}` // For TransitionGroup uniqueness
      };
      
      lastGridItemIdRef.current = selected.id;
      axios.post(`${API_BASE_URL}/api/bookings/screen-settings/grid-item-shown/${selected.id}`).catch(console.error);
    } else {
      nextItem = null;
    }

    setCurrentItem(nextItem);
  };

  useEffect(() => {
    if (settings.currentProjection) return;
    if (currentItem?.type === 'video') return; 

    if (currentItem) {
      const durationMs = (currentItem.duration || 5) * 1000;
      timerRef.current = setTimeout(() => {
        advanceCarousel();
      }, durationMs);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    } else {
      // Intentar cargar inmediatamente
      if (settings.contentGrid?.length > 0) {
        advanceCarousel();
      }
      
      // Keep checking every 3 seconds if there are items but none were eligible (e.g., all on cooldown)
      const intervalId = setInterval(() => {
        advanceCarousel();
      }, 3000);

      return () => {
        clearInterval(intervalId);
      };
    }
  }, [currentItem, settings.currentProjection, settings.contentGrid?.length]);

  // Lógica de expiración de la proyección. El video usa su propia duración
  // configurable (videoProjectionDuration) en vez de la de fotos — si el
  // video dura menos, se repite (loop) hasta completar el tiempo; si dura
  // más, se corta.
  useEffect(() => {
    if (settings.currentProjection && settings.currentProjection.timestamp) {
      const timeElapsed = Date.now() - settings.currentProjection.timestamp;
      const isVideoProjection = settings.currentProjection.mediaType === 'video';
      const PROJECTION_DURATION =
        ((isVideoProjection ? settings.videoProjectionDuration : settings.projectionDuration) || 15) * 1000;
      const timeRemaining = PROJECTION_DURATION - timeElapsed;
      
      if (timeRemaining > 0) {
        const timer = setTimeout(() => {
          axios.post(`${API_BASE_URL}/api/bookings/${settings.currentProjection.id}/complete`);
        }, timeRemaining);
        return () => clearTimeout(timer);
      } else {
        axios.post(`${API_BASE_URL}/api/bookings/${settings.currentProjection.id}/complete`);
      }
    } else if (!settings.currentProjection) {
      // Cuando la proyección se acaba, forzamos al carrusel a avanzar al siguiente contenido 
      // de la parrilla para evitar que se quede atascado en el último video o imagen congelada.
      advanceCarousel();
    }
  }, [settings.currentProjection]);

  const handleVideoEnded = () => {
    // Si hay una proyección activa, no cambiamos el fondo
    if (settingsRef.current.currentProjection) return;
    advanceCarousel();
  };

  const hasCarousel = !!currentItem;
  const transitionClass = `carousel-${settings.carouselTransitionDirection || 'fade'}`;
  const getTransitionName = (t: string) => t?.startsWith('carousel-') ? t : `carousel-${t}`;

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

  // Si el admin no configuró una imagen de fondo desde /admin, usamos el
  // muro animado de grafiti (mismo lenguaje visual que Home/Booking) en vez
  // de negro liso. Si SÍ configuró una imagen, esa sigue mandando igual que
  // antes — no perdemos esa funcionalidad.
  const hasCustomBackground = !!settings.backgroundUrl;

  return (
    <Box
      className={hasCustomBackground ? undefined : 'graffiti-wall'}
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: hasCustomBackground ? '#000' : undefined,
        backgroundImage: hasCustomBackground ? `url(${settings.backgroundUrl})` : undefined,
        backgroundSize: hasCustomBackground ? 'cover' : undefined,
        backgroundPosition: hasCustomBackground ? 'center' : undefined,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {!hasCustomBackground && (
        <>
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
          <div className="spray-cloud spray-cloud--pink" />
          <div className="spray-cloud spray-cloud--cyan" />
          <div className="spray-cloud spray-cloud--yellow" />
          <div className="drip drip--1" />
          <div className="drip drip--2" />
          <div className="drip drip--3" />
        </>
      )}

      {/* HEADER */}
      {settings.headerUrl && (
        <Box style={{ width: '100%', height: '15vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.4)', boxShadow: '0 4px 14px rgba(0,0,0,0.35)', position: 'relative', zIndex: 2 }}>
          <img src={settings.headerUrl} alt="Header" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
        </Box>
      )}

      {/* CONTENIDO CENTRAL */}
      <Box style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden', zIndex: 2 }}>
        
        {/* El carrusel siempre está renderizado debajo */}
        <Box style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'absolute', overflow: 'hidden', zIndex: 10 }}>
          <TransitionGroup style={{ width: '100%', height: '100%', position: 'relative' }} childFactory={(child) => React.cloneElement(child as React.ReactElement<any>, { classNames: currentItem?.transition ? getTransitionName(currentItem.transition) : transitionClass })}>
            {hasCarousel ? (
              <CarouselItem 
                key={currentItem.renderKey} 
                item={currentItem} 
                transitionClass={currentItem?.transition ? getTransitionName(currentItem.transition) : transitionClass} 
                onEnded={handleVideoEnded}
              />
            ) : (
              <CSSTransition key="fallback-empty" appear={true} nodeRef={fallbackNodeRef} timeout={1000} classNames="carousel-fade">
                <Box ref={fallbackNodeRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1 }}>
                  <Box className="ledson-screen-card">
                    <Title order={1} className="ledson-screen-title">{t('welcomeTitle')}</Title>
                    <Text className="ledson-screen-subtitle">{t('welcomeText1')}</Text>
                    <Text className="ledson-screen-subtitle">{t('welcomeText2')}</Text>
                    <Box className="ledson-screen-qr-box">
                      <QRCode value={`${window.location.origin}/booking`} size={220} />
                    </Box>
                    <Text className="ledson-screen-qr-caption">{t('scanQR')}</Text>
                  </Box>
                </Box>
              </CSSTransition>
            )}
          </TransitionGroup>
        </Box>

        <MantineTransition 
          mounted={!!settings.currentProjection} 
          transition={currentTransition} 
          duration={displayProjection?.transitionEffect === 'particles' ? 2000 : 1000} 
          timingFunction="ease"
        >
          {(styles) => (
            <div style={{ ...styles, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'absolute', top: 0, left: 0, zIndex: 20 }}>
              {displayProjection?.mediaType === 'video' ? (
                // El video se proyecta tal cual, sin el efecto de spray (que es
                // un canvas pensado solo para revelar una imagen estática).
                // Muteado porque los navegadores bloquean el autoplay con
                // sonido sin interacción previa del usuario — igual que los
                // videos de la parrilla de contenidos en este mismo componente.
                <Box style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', backgroundColor: '#000' }}>
                  <video
                    key={displayProjection?.id}
                    ref={projectionVideoRef}
                    src={displayProjection?.imageUrl}
                    autoPlay
                    muted
                    // Si el usuario eligió un tramo (trimStart/trimEnd), el loop
                    // nativo no sirve porque reiniciaría en el segundo 0 del
                    // archivo completo — se loopea a mano dentro del tramo vía
                    // onTimeUpdate. Sin tramo (videos antiguos), se mantiene el
                    // loop nativo de siempre.
                    loop={!displayProjection?.trimEnd}
                    playsInline
                    onLoadedMetadata={() => {
                      if (projectionVideoRef.current && displayProjection?.trimStart) {
                        projectionVideoRef.current.currentTime = displayProjection.trimStart;
                      }
                    }}
                    onTimeUpdate={() => {
                      const v = projectionVideoRef.current;
                      if (v && displayProjection?.trimEnd && v.currentTime >= displayProjection.trimEnd) {
                        v.currentTime = displayProjection.trimStart || 0;
                      }
                    }}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                  />
                </Box>
              ) : displayProjection?.transitionEffect === 'spray' || true ? (
                <SprayEffect
                  imageUrl={displayProjection?.imageUrl}
                  frameUrl={displayProjection?.frameUrl}
                />
              ) : (
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
              )}
            </div>
          )}
        </MantineTransition>

      </Box>

      {/* FOOTER */}
      {settings.footerUrl && (
        <Box style={{ width: '100%', height: '15vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.4)', boxShadow: '0 -4px 14px rgba(0,0,0,0.35)', position: 'relative', zIndex: 2 }}>
          <img src={settings.footerUrl} alt="Footer" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
        </Box>
      )}
    </Box>
  );
}