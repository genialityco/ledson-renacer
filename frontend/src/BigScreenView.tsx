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
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: props.in ? 1 : 0, transition: 'opacity 0.5s' }}
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
    restScreenIdleMinutes: 0,
    restScreenItems: [],
    hasPendingQueue: false,
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

  // Pantalla de Reposo: independiente de la Parrilla. Solo se activa tras N
  // minutos SIN proyección y SIN reservas pendientes (settings.hasPendingQueue),
  // reemplazando lo que se esté mostrando (Parrilla o tarjeta de bienvenida)
  // por su propio loop de imágenes/videos. En cuanto vuelve a haber una
  // proyección o alguien entra en cola, se sale de inmediato.
  const [restScreenActive, setRestScreenActive] = useState(false);
  const [restCurrentItem, setRestCurrentItem] = useState<any>(null);
  const restIndexRef = useRef(0);
  const restTimerRef = useRef<any>(null);
  const lastActiveAtRef = useRef(Date.now());

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (settings.currentProjection || settings.hasPendingQueue) {
      lastActiveAtRef.current = Date.now();
    }
  }, [settings.currentProjection, settings.hasPendingQueue]);

  useEffect(() => {
    const checkInterval = setInterval(() => {
      const s = settingsRef.current;
      if (s.currentProjection || s.hasPendingQueue) {
        setRestScreenActive(false);
        return;
      }
      const idleMinutes = s.restScreenIdleMinutes || 0;
      const items = s.restScreenItems || [];
      if (idleMinutes > 0 && items.length > 0) {
        const idleMs = Date.now() - lastActiveAtRef.current;
        setRestScreenActive(idleMs >= idleMinutes * 60000);
      } else {
        setRestScreenActive(false);
      }
    }, 1000);
    return () => clearInterval(checkInterval);
  }, []);

  const advanceRestScreen = () => {
    const items = settingsRef.current.restScreenItems || [];
    if (items.length === 0) {
      setRestCurrentItem(null);
      return;
    }
    const idx = restIndexRef.current % items.length;
    restIndexRef.current = idx + 1;
    const selected = items[idx];
    setRestCurrentItem({
      id: selected.id,
      url: selected.url,
      type: selected.type || 'image',
      duration: selected.duration || 10,
      trimStart: selected.trimStart,
      trimEnd: selected.trimEnd,
      renderKey: `rest-${selected.id}-${Date.now()}`,
    });
  };

  useEffect(() => {
    if (!restScreenActive) {
      setRestCurrentItem(null);
      restIndexRef.current = 0;
      return;
    }
    if (!restCurrentItem) {
      advanceRestScreen();
      return;
    }
    if (restCurrentItem.type === 'video') return; // avanza vía onEnded
    const durationMs = (restCurrentItem.duration || 10) * 1000;
    restTimerRef.current = setTimeout(advanceRestScreen, durationMs);
    return () => {
      if (restTimerRef.current) clearTimeout(restTimerRef.current);
    };
  }, [restScreenActive, restCurrentItem]);

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
    // Tampoco si está activa la Pantalla de Reposo: se pausa la Parrilla por completo
    // (no se consumen apariciones/cooldowns de items que no se están viendo).
    if (settingsRef.current.currentProjection || restScreenActive) return;

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
    if (settings.currentProjection || restScreenActive) return;
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
  }, [currentItem, settings.currentProjection, settings.contentGrid?.length, restScreenActive]);

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

  // Efecto de revelado "Overlay de Video": un video se reproduce encima de la
  // foto/video real (que ya está debajo, visible desde el inicio) y en sus
  // últimos `revealOverlayFadeSeconds` se desvanece (opacidad 1→0) revelándolo.
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  // La foto/video real no debe verse ni un instante antes de que el overlay
  // ya esté pintando frames encima — si no, hay un flash de la foto real
  // antes de que el video de transición alcance a cubrirla. Se mantiene
  // oculta (pantalla negra) hasta que el overlay confirma que ya se ve.
  const [overlayReady, setOverlayReady] = useState(false);
  const overlayVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setOverlayOpacity(1);
    setOverlayReady(false);
    if (displayProjection?.revealEffect !== 'video-overlay') return;
    // Salvavidas: si el overlay no arranca pronto (error de red, url rota),
    // no dejamos la pantalla negra para siempre.
    const fallback = setTimeout(() => setOverlayReady(true), 1500);
    return () => clearTimeout(fallback);
  }, [displayProjection?.id, displayProjection?.revealEffect]);

  const handleOverlayTimeUpdate = () => {
    const v = overlayVideoRef.current;
    if (!v || !v.duration) return;
    const fadeSeconds = displayProjection?.revealOverlayFadeSeconds || 2;
    const remaining = v.duration - v.currentTime;
    setOverlayOpacity(remaining <= fadeSeconds ? Math.max(0, remaining / fadeSeconds) : 1);
  };

  const particleTransition = {
    in: { opacity: 1, WebkitMaskSize: '200px 200px', transform: 'scale(1)', filter: 'blur(0px)' },
    out: { opacity: 0, WebkitMaskSize: '2px 2px', transform: 'scale(1.2)', filter: 'blur(10px)' },
    transitionProperty: 'opacity, -webkit-mask-size, transform, filter',
  };

  const currentTransition = displayProjection?.transitionEffect === 'particles'
    ? particleTransition
    : (displayProjection?.transitionEffect || 'fade');

  const hasCustomBackground = !!settings.backgroundUrl;

  return (
    <Box
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        backgroundImage: hasCustomBackground ? `url(${settings.backgroundUrl})` : undefined,
        backgroundSize: hasCustomBackground ? 'cover' : undefined,
        backgroundPosition: hasCustomBackground ? 'center' : undefined,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
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
            {restScreenActive && restCurrentItem ? (
              <CarouselItem
                key={restCurrentItem.renderKey}
                item={restCurrentItem}
                transitionClass={transitionClass}
                onEnded={advanceRestScreen}
              />
            ) : hasCarousel ? (
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
              {displayProjection?.revealEffect === 'video-overlay' && !overlayReady ? (
                <Box style={{ width: '100%', height: '100%', backgroundColor: '#000' }} />
              ) : displayProjection?.mediaType === 'video' ? (
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
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      // Mismo transform que aplicó VideoTrimModal al elegir el
                      // encuadre, para que lo que el cliente vio al recortar
                      // sea exactamente lo que se proyecta.
                      transform: displayProjection?.frameZoom
                        ? `scale(${displayProjection.frameZoom}) translate(${displayProjection.frameX || 0}%, ${displayProjection.frameY || 0}%)`
                        : undefined,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    }}
                  />
                </Box>
              ) : displayProjection?.revealEffect === 'spray' ? (
                <SprayEffect
                  imageUrl={displayProjection?.imageUrl}
                  frameUrl={displayProjection?.frameUrl}
                />
              ) : (
                // "fade" y "video-overlay" comparten esta base: la foto se
                // muestra directa, a pantalla completa. Para "video-overlay"
                // esto es lo que queda debajo, esperando a que el video de
                // arriba se desvanezca; para "fade" ES el revelado completo
                // (la entrada/salida ya la da el contenedor externo).
                <Box style={{ position: 'relative', flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
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
              )}

              {/* Overlay de Video: se superpone a la foto/video real (arriba)
                  y se desvanece en sus últimos segundos, revelándolo. */}
              {displayProjection?.revealEffect === 'video-overlay' && displayProjection?.revealOverlayVideoUrl && (
                <Box style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 25, pointerEvents: 'none' }}>
                  <video
                    key={displayProjection?.id}
                    ref={overlayVideoRef}
                    src={displayProjection.revealOverlayVideoUrl}
                    autoPlay
                    muted
                    playsInline
                    onPlaying={() => setOverlayReady(true)}
                    onError={() => setOverlayReady(true)}
                    onTimeUpdate={handleOverlayTimeUpdate}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: overlayOpacity }}
                  />
                </Box>
              )}

              {/* Código de reserva de la proyección activa, superpuesto sobre la
                  imagen/video para que quien la ve pueda identificar su turno. */}
              {displayProjection?.code && (
                <Box style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 12,
                  zIndex: 30,
                  padding: '6px 16px',
                  borderRadius: 999,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 700,
                  fontSize: 'clamp(0.9rem, 1.6vw, 1.3rem)',
                  letterSpacing: 2,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}>
                  {displayProjection.code}
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