import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Box, Transition as MantineTransition } from '@mantine/core';
import { TransitionGroup, CSSTransition } from 'react-transition-group';
import axios from 'axios';
import './falling.css';
import './graffiti.css';
import './ledson-clean.css';
import { SprayEffect } from './SprayEffect';
import { API_BASE_URL } from './config';
import { useCachedAsset } from './useCachedAsset';

// Llave de la pantalla (= SCREEN_KEY del backend) para los endpoints que solo
// ella puede llamar (/complete y grid-item-shown). Se abre como
// /screen?key=... y queda guardada en el navegador, por si después se abre
// /screen sin el parámetro.
const SCREEN_KEY = (() => {
  const fromUrl = new URLSearchParams(window.location.search).get('key');
  try {
    if (fromUrl) localStorage.setItem('ledson_screen_key', fromUrl);
    return fromUrl || localStorage.getItem('ledson_screen_key') || '';
  } catch {
    return fromUrl || '';
  }
})();
const screenAuth = { headers: { 'X-Screen-Key': SCREEN_KEY } };
const SETTINGS_STORAGE_KEY = 'ledson-screen-settings';

// Service worker (public/screen-sw.js) que guarda la app para que /screen
// vuelva a abrir aunque se recargue sin internet. Solo se registra aquí: los
// celulares de los clientes nunca lo instalan. En la primera visita la página
// cargó antes de que el service worker existiera, así que se le pasa la lista
// de archivos ya descargados para que también los guarde.
const registerScreenServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register('/screen-sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => {
      const urls = [
        window.location.href,
        ...performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => u.startsWith(window.location.origin)),
      ];
      reg.active?.postMessage({ type: 'cache-urls', urls });
    })
    .catch((e) => console.error('No se pudo registrar el service worker de la pantalla:', e));
};

// Última configuración recibida del backend, guardada en el navegador: si la
// pantalla se recarga o arranca SIN internet, sigue con la misma configuración
// (videoloop, fondo, header/footer, etc.) en vez de quedar vacía. Nunca se
// restaura una proyección en curso ni la cola: eso lo decide siempre el backend.
const loadStoredSettings = (): any | null => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    return { ...JSON.parse(raw), currentProjection: null, hasPendingQueue: false };
  } catch {
    return null;
  }
};

// ¿El cuadro actual del video de transición tapa toda la pantalla? Se dibuja
// reducido en un canvas de 8x16 y se revisa el alfa de cada punto. Devuelve
// null si el navegador no deja leer los píxeles (video de otro origen sin
// CORS).
let alphaCanvas: HTMLCanvasElement | null = null;
const isOverlayOpaque = (video: HTMLVideoElement): boolean | null => {
  try {
    alphaCanvas ||= document.createElement('canvas');
    alphaCanvas.width = 8;
    alphaCanvas.height = 16;
    const ctx = alphaCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.clearRect(0, 0, 8, 16);
    ctx.drawImage(video, 0, 0, 8, 16);
    const data = ctx.getImageData(0, 0, 8, 16).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return false;
    }
    return true;
  } catch {
    return null;
  }
};

// Identifica UNA proyección concreta: la misma reserva proyectada otra vez a
// mano trae otro timestamp, así que cuenta como una proyección nueva.
const projectionKey = (p: { id?: string; timestamp?: number } | null | undefined): string | null =>
  p?.id ? `${p.id}:${p.timestamp ?? ''}` : null;

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
  const [rawSettings, setRawSettings] = useState<any>(() => loadStoredSettings() || {
    backgroundUrl: '',
    headerUrl: '',
    footerUrl: '',
    defaultVideoUrl: '',
    defaultImageUrl: '',
    carouselImages: [],
    contentGrid: [],
    restScreenIdleMinutes: 0,
    restScreenItems: [],
    hasPendingQueue: false,
    currentProjection: null
  });
  // Proyección que ya cumplió su tiempo pero cuyo aviso de "completada" no
  // llegó al backend (sin internet): se oculta localmente para que la pantalla
  // no se quede congelada en ella, y se sigue reintentando avisar.
  // Se guarda la clave de ESA proyección (id + hora), no solo el id: si la
  // misma reserva se vuelve a proyectar a mano, es otra proyección y se muestra.
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const settings = useMemo(
    () =>
      rawSettings.currentProjection && projectionKey(rawSettings.currentProjection) === dismissedKey
        ? { ...rawSettings, currentProjection: null }
        : rawSettings,
    [rawSettings, dismissedKey],
  );
  const [, setCurrentTimeString] = useState('');
  
  const [currentItem, setCurrentItem] = useState<any>(null);
  const lastGridItemIdRef = useRef<string | null>(null);
  const timerRef = useRef<any>(null);

  const settingsRef = useRef<any>(settings);
  const fallbackNodeRef = useRef(null);
  const projectionVideoRef = useRef<HTMLVideoElement>(null);

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
        setRawSettings(res.data);
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(res.data));
        } catch { /* almacenamiento lleno o bloqueado: se ignora */ }
      }
    } catch (e) {
      console.error('Error fetching projections:', e);
    }
  };

  useEffect(() => {
    registerScreenServiceWorker();
  }, []);

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
      axios.post(`${API_BASE_URL}/api/bookings/screen-settings/grid-item-shown/${selected.id}`, null, screenAuth).catch(console.error);
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

  // Lógica de expiración de la proyección. Si es video, se toma el tiempo total
  // del recorte (trimEnd - trimStart) para que se muestre exactamente una vez completo.
  // Si no tiene recorte o es foto, usa la duración global configurada.
  useEffect(() => {
    if (settings.currentProjection && settings.currentProjection.timestamp) {
      const timeElapsed = Date.now() - settings.currentProjection.timestamp;
      const isVideoProjection = settings.currentProjection.mediaType === 'video';
      
      let PROJECTION_DURATION;
      if (isVideoProjection && settings.currentProjection.trimEnd) {
        const trimStart = settings.currentProjection.trimStart || 0;
        const trimEnd = settings.currentProjection.trimEnd;
        PROJECTION_DURATION = (trimEnd - trimStart) * 1000;
      } else {
        PROJECTION_DURATION = ((isVideoProjection ? settings.videoProjectionDuration : settings.projectionDuration) || 15) * 1000;
      }
      
      const timeRemaining = PROJECTION_DURATION - timeElapsed;
      
      const projectionId = settings.currentProjection.id;
      const key = projectionKey(settings.currentProjection);
      const complete = () =>
        axios
          .post(`${API_BASE_URL}/api/bookings/${projectionId}/complete`, null, screenAuth)
          .catch((err) => {
            // 401/403 = la pantalla no tiene la llave correcta (/screen?key=...).
            console.error('No se pudo completar la proyección', projectionId, err?.response?.status, err?.response?.data?.message);
            setDismissedKey(key);
          });
      if (timeRemaining > 0) {
        const timer = setTimeout(complete, timeRemaining);
        return () => clearTimeout(timer);
      } else {
        complete();
      }
    } else if (!settings.currentProjection) {
      // Cuando la proyección se acaba, forzamos al carrusel a avanzar al siguiente contenido 
      // de la parrilla para evitar que se quede atascado en el último video o imagen congelada.
      advanceCarousel();
    }
  }, [settings.currentProjection]);

  // Reintenta avisar la finalización de una proyección ocultada por falta de
  // conexión, hasta que el backend responda. Solo mientras el backend siga
  // teniendo ESA proyección: si ya la cerró (o se reemplazó, aunque sea por
  // la misma reserva proyectada otra vez), reintentar cerraría la nueva.
  const backendProjectionKey = projectionKey(rawSettings.currentProjection);
  useEffect(() => {
    if (!dismissedKey || backendProjectionKey !== dismissedKey) return;
    const bookingId = dismissedKey.split(':')[0];
    const t = setInterval(() => {
      axios
        .post(`${API_BASE_URL}/api/bookings/${bookingId}/complete`, null, screenAuth)
        .then(() => clearInterval(t))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [dismissedKey, backendProjectionKey]);

  const handleVideoEnded = () => {
    // Si hay una proyección activa, no cambiamos el fondo
    if (settingsRef.current.currentProjection) return;
    advanceCarousel();
  };

  const hasCarousel = !!currentItem;
  const transitionClass = `carousel-${settings.carouselTransitionDirection || 'fade'}`;
  const getTransitionName = (t: string) => t?.startsWith('carousel-') ? t : `carousel-${t}`;

  // Guardar la última proyección para que la animación de salida sepa qué renderizar
  const [rawDisplayProjection, setDisplayProjection] = useState<any>(null);
  const displayKey = projectionKey(rawDisplayProjection);
  useEffect(() => {
    if (settings.currentProjection) {
      setDisplayProjection(settings.currentProjection);
    }
  }, [settings.currentProjection]);

  // Respaldo de proyección: si la foto/video del cliente no se puede cargar
  // (sin internet, archivo caído), en su lugar se muestra la imagen por
  // defecto (configurable en Admin; si no hay, el arte de bienvenida de la
  // app) para que la pantalla nunca quede en negro ni con un ícono roto.
  const defaultImageSrc = useCachedAsset(settings.defaultImageUrl || '/imagenes/inicioc13.png');
  const [projectionFailed, setProjectionFailed] = useState(false);
  useEffect(() => {
    setProjectionFailed(false);
    const p = rawDisplayProjection;
    if (!p || p.mediaType === 'video' || !p.imageUrl) return;
    let done = false;
    const img = new Image();
    img.onload = () => { done = true; };
    img.onerror = () => { done = true; setProjectionFailed(true); };
    img.src = p.imageUrl;
    const timeout = setTimeout(() => { if (!done) setProjectionFailed(true); }, 8000);
    return () => { clearTimeout(timeout); img.onload = null; img.onerror = null; };
  }, [displayKey]);
  const displayProjection = useMemo(
    () =>
      projectionFailed && rawDisplayProjection
        ? { ...rawDisplayProjection, mediaType: 'image', imageUrl: defaultImageSrc, frameUrl: '' }
        : rawDisplayProjection,
    [projectionFailed, rawDisplayProjection, defaultImageSrc],
  );

  // Copias locales de los videos clave (ver useCachedAsset): siguen
  // reproduciéndose aunque se caiga el internet.
  const defaultVideoSrc = useCachedAsset(settings.defaultVideoUrl);
  // Se precarga desde la configuración (no solo al llegar una proyección): así
  // la primera proyección ya usa la copia local, que además es del mismo
  // origen y permite leer la transparencia del video (ver isOverlayOpaque).
  const overlayVideoSrc = useCachedAsset(displayProjection?.revealOverlayVideoUrl || settings.revealOverlayVideoUrl);
  const [standbyKey, setStandbyKey] = useState(0);

  // Efecto de revelado "Overlay de Video": un video de transición se
  // reproduce encima de la foto/video real.
  // - Video CON transparencia (webm VP9 con alfa): se respeta tal cual. Sus
  //   partes transparentes dejan ver lo que haya debajo (la Parrilla/videoloop
  //   al entrar, la foto al revelar) y él mismo hace su entrada y salida.
  // - Video SIN transparencia (mp4): se desvanece por CSS en sus últimos
  //   `revealOverlayFadeSeconds`, revelando la foto (comportamiento anterior).
  // `overlayCovered` indica que el video ya tapa toda la pantalla: recién
  // entonces se cambia lo de abajo (aparece la foto al entrar, se quita al
  // salir), para que el cambio nunca se vea.
  const [overlayCovered, setOverlayCovered] = useState(false);
  const overlayVideoRef = useRef<HTMLVideoElement>(null);
  const isOverlayMode =
    displayProjection?.revealEffect === 'video-overlay' && !!displayProjection?.revealOverlayVideoUrl;

  const overlayStartedRef = useRef(false);

  useEffect(() => {
    setOverlayCovered(false);
    overlayStartedRef.current = false;
    if (displayProjection?.revealEffect !== 'video-overlay') return;
    // Salvavidas: si el overlay no arranca pronto (error de red, url rota),
    // se muestra la foto igual en vez de dejar la pantalla sin ella.
    // Y si arrancó pero se trabó antes de tapar la pantalla, a los 6s igual.
    const fallback = setTimeout(() => {
      if (!overlayStartedRef.current) setOverlayCovered(true);
    }, 1500);
    const stalled = setTimeout(() => setOverlayCovered(true), 6000);
    return () => {
      clearTimeout(fallback);
      clearTimeout(stalled);
    };
  }, [displayKey, displayProjection?.revealEffect]);

  // Salida: al terminar una proyección con efecto "video-overlay", el video de
  // transición se vuelve a reproducir encima de la foto (que sigue montada)
  // y recién cuando termina se desmonta el contenedor, revelando lo de abajo.
  const [exiting, setExiting] = useState(false);
  // Se mantiene true hasta que entre una proyección nueva: así el <video> de
  // salida conserva su key durante el fade-out final del contenedor y no se
  // vuelve a montar (lo que lo reproducía otra vez).
  // Clave (id + hora) de la proyección cuya salida ya se reprodujo. Corre UNA sola
  // vez por proyección: si el polling devuelve un instante una respuesta
  // vieja con la misma proyección (o el estado parpadea), no se reinicia.
  const [exitedKey, setExitedKey] = useState<string | null>(null);
  const exitPlayed = !!displayKey && exitedKey === displayKey;
  const hadProjectionRef = useRef(false);
  useEffect(() => {
    const cp = settings.currentProjection;
    const has = !!cp;
    if (has) {
      if (projectionKey(cp) !== exitedKey) {
        setExiting(false);
      }
    } else if (
      hadProjectionRef.current &&
      displayProjection &&
      exitedKey !== displayKey &&
      displayProjection.revealEffect === 'video-overlay' &&
      displayProjection.revealOverlayVideoUrl
    ) {
      setOverlayCovered(false);
      setExiting(true);
      setExitedKey(displayKey);
    }
    hadProjectionRef.current = has;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.currentProjection]);

  // Salvavidas del video de transición: si se traba (red caída a mitad de la
  // reproducción) no debe dejar la pantalla tapada ni la salida sin terminar.
  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => setExiting(false), 6000);
    return () => clearTimeout(t);
  }, [exiting]);
  // Animación del overlay, cuadro a cuadro (requestAnimationFrame, no
  // onTimeUpdate que solo dispara ~4 veces por segundo y hacía el
  // desvanecimiento a saltos). La opacidad se aplica directo al <video> para
  // no re-renderizar toda la pantalla 60 veces por segundo.
  const overlayFadeSeconds = displayProjection?.revealOverlayFadeSeconds || 2;
  useEffect(() => {
    if (!isOverlayMode) return;
    let raf = 0;
    let covered = false;
    let hasAlpha = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const v = overlayVideoRef.current;
      if (!v || !v.duration || v.readyState < 2) return;
      if (!covered) {
        // null = no se pudo leer (video de otro origen sin CORS): se asume
        // opaco, como antes de detectar transparencia.
        // Un video con transparencia que nunca llega a tapar toda la
        // pantalla: la foto aparece al terminar.
        const opaque = v.ended || isOverlayOpaque(v);
        if (opaque === false) {
          hasAlpha = true;
        } else {
          covered = true;
          setOverlayCovered(true);
        }
      }
      if (hasAlpha) {
        v.style.opacity = '1';
      } else {
        const remaining = v.duration - v.currentTime;
        v.style.opacity = String(remaining <= overlayFadeSeconds ? Math.max(0, remaining / overlayFadeSeconds) : 1);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isOverlayMode, displayKey, exiting, overlayFadeSeconds]);

  // Salvavidas: si el overlay se traba sin terminar, que no tape la foto.
  useEffect(() => {
    if (!overlayCovered || exiting) return;
    const t = setTimeout(() => {
      if (overlayVideoRef.current) overlayVideoRef.current.style.opacity = '0';
    }, 15000);
    return () => clearTimeout(t);
  }, [overlayCovered, exiting, displayKey]);

  // Al entrar, la foto queda oculta hasta que el overlay tapa la pantalla; al
  // salir, se quita en cuanto la tapa, y el final del overlay revela lo de
  // abajo (Parrilla/videoloop). Mientras está oculta, el contenedor es
  // transparente para que se vea a través de las partes transparentes.
  const projectionHidden = isOverlayMode && (exiting ? overlayCovered : !overlayCovered);

  const particleTransition = {
    in: { opacity: 1, WebkitMaskSize: '200px 200px', transform: 'scale(1)', filter: 'blur(0px)' },
    out: { opacity: 0, WebkitMaskSize: '2px 2px', transform: 'scale(1.2)', filter: 'blur(10px)' },
    transitionProperty: 'opacity, -webkit-mask-size, transform, filter',
  };

  const currentTransition = displayProjection?.transitionEffect === 'particles'
    ? particleTransition
    : (displayProjection?.transitionEffect || 'fade');

  const hasCustomBackground = !!settings.backgroundUrl;

  // La pantalla real del venue es 576x1152 (vertical, relación 1:2) — mismos
  // valores que cropWidth/cropHeight, que ya se usan para el recorte de fotos
  // y videos. Si esta vista se abre en un monitor de otra proporción (para
  // pruebas), el contenido antes se estiraba a 100vw/100vh completos, lo que
  // hacía que cualquier video/imagen con object-fit:cover se recortara arriba
  // y abajo (o a los lados) de forma distinta a como se ve en la pantalla
  // real. Ahora el "lienzo" interior siempre mantiene esa proporción 1:2,
  // con barras negras (letterbox) rellenando el resto del monitor de
  // prueba — lo que se ve acá es una vista fiel de la pantalla real.
  const screenWidth = settings.cropWidth || 576;
  const screenHeight = settings.cropHeight || 1152;

  return (
    <Box style={{ width: '100vw', height: '100vh', backgroundColor: '#000', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', overflow: 'hidden' }}>
    <Box
      style={{
        width: '100%',
        height: '100%',
        maxWidth: `calc(100vh * ${screenWidth} / ${screenHeight})`,
        maxHeight: `calc(100vw * ${screenHeight} / ${screenWidth})`,
        aspectRatio: `${screenWidth} / ${screenHeight}`,
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
          <TransitionGroup
            style={{ width: '100%', height: '100%', position: 'relative' }}
            childFactory={(child) => {
              const el = child as React.ReactElement<any>;
              // El videoloop, la imagen por defecto y la Pantalla de Reposo
              // conservan su propio fade: la transición de la Parrilla (por
              // defecto slide a la derecha) solo aplica a los ítems de la
              // Parrilla. TransitionGroup antepone ".$" a las keys.
              if (/default-(videoloop|image)$|\$rest-/.test(String(el.key))) return el;
              return React.cloneElement(el, { classNames: currentItem?.transition ? getTransitionName(currentItem.transition) : transitionClass });
            }}
          >
            {restScreenActive && restCurrentItem ? (
              <CarouselItem
                key={restCurrentItem.renderKey}
                item={restCurrentItem}
                transitionClass={transitionClass}
                classNames="carousel-fade"
                onEnded={advanceRestScreen}
              />
            ) : hasCarousel ? (
              <CarouselItem
                key={currentItem.renderKey}
                item={currentItem}
                transitionClass={currentItem?.transition ? getTransitionName(currentItem.transition) : transitionClass}
                onEnded={handleVideoEnded}
              />
            ) : settings.defaultVideoUrl ? (
              // Videoloop por defecto: lo único que se muestra cuando no hay
              // Parrilla/Reposo ni proyección activa — nunca se detiene solo
              // ni tiene una duración fija, simplemente se repite en bucle.
              // object-fit "contain" (no "cover") a propósito: este video no
              // tiene un recorte/encuadre guardado como sí lo tienen las fotos
              // y videos de clientes, así que "cover" lo recortaba arriba y
              // abajo cuando su proporción no coincidía con la de la pantalla.
              <CSSTransition key="default-videoloop" appear={true} nodeRef={fallbackNodeRef} timeout={1000} classNames="carousel-fade">
                <Box ref={fallbackNodeRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1, backgroundColor: '#000' }}>
                  <video
                    // key: si el video falla o se corta por la red, se vuelve a
                    // montar a los 3s (con la copia local cuando ya existe).
                    key={standbyKey}
                    src={defaultVideoSrc}
                    autoPlay
                    muted
                    loop
                    playsInline
                    onError={() => setTimeout(() => setStandbyKey((k) => k + 1), 3000)}
                    onStalled={(e) => { const v = e.currentTarget; setTimeout(() => { if (v.paused || v.readyState < 3) setStandbyKey((k) => k + 1); }, 8000); }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </Box>
              </CSSTransition>
            ) : (
              // Sin videoloop configurado: se muestra la imagen por defecto
              // (la de Admin o, si no hay, el arte de la app) para que la
              // pantalla nunca quede en negro.
              <CSSTransition key="default-image" appear={true} nodeRef={fallbackNodeRef} timeout={1000} classNames="carousel-fade">
                <Box ref={fallbackNodeRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1, backgroundColor: '#000' }}>
                  <img src={defaultImageSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </Box>
              </CSSTransition>
            )}
          </TransitionGroup>
        </Box>

        <MantineTransition 
          mounted={(!!settings.currentProjection && projectionKey(settings.currentProjection) !== exitedKey) || exiting}
          transition={currentTransition}
          // Con video de transición, la entrada y la salida las resuelve ese
          // video: el contenedor aparece y se quita de golpe. Si no, su
          // fade de 1s se sumaba al video (que dura ~1s) y este se veía
          // semitransparente durante toda la entrada.
          duration={isOverlayMode ? 0 : displayProjection?.transitionEffect === 'particles' ? 2000 : 1000}
          exitDuration={isOverlayMode ? 0 : undefined}
          timingFunction="ease"
        >
          {(styles) => (
            // Fondo negro opaco: sin esto, mientras el revelado (spray/fade)
            // todavía no cubre toda la imagen, o mientras el contenedor se
            // desvanece hacia adentro, se alcanza a ver la Parrilla o la
            // Pantalla de Reposo por detrás (quedan debajo en zIndex 10).
            // Excepción: mientras el video de transición aún no tapa la
            // pantalla, es transparente a propósito (ver projectionHidden).
            <div style={{ ...styles, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'absolute', top: 0, left: 0, zIndex: 20, backgroundColor: projectionHidden ? 'transparent' : '#000' }}>
              {projectionHidden ? (
                <Box style={{ width: '100%', height: '100%' }} />
              ) : displayProjection?.mediaType === 'video' ? (
                // El video se proyecta tal cual, sin el efecto de spray (que es
                // un canvas pensado solo para revelar una imagen estática).
                // Muteado porque los navegadores bloquean el autoplay con
                // sonido sin interacción previa del usuario — igual que los
                // videos de la parrilla de contenidos en este mismo componente.
                <Box style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', backgroundColor: '#000' }}>
                  <video
                    key={displayKey ?? undefined}
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
                    onError={() => setProjectionFailed(true)}
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
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                    />
                  )}
                </Box>
              )}

              {/* Overlay de Video: se superpone a la foto/video real (arriba)
                  y se desvanece en sus últimos segundos, revelándolo. */}
              {/* Una vez terminada la salida (exitPlayed && !exiting) el video
                  ya no se renderiza: mientras el contenedor hace su fade-out
                  final no puede volver a montarse ni reproducirse. */}
              {displayProjection?.revealEffect === 'video-overlay' && displayProjection?.revealOverlayVideoUrl && !(exitPlayed && !exiting) && (
                <Box style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 25, pointerEvents: 'none' }}>
                  <video
                    key={`${displayKey}${exitPlayed ? '-exit' : ''}`}
                    ref={overlayVideoRef}
                    src={overlayVideoSrc}
                    autoPlay
                    muted
                    playsInline
                    onPlay={() => console.debug('[overlay] play', exitPlayed ? 'salida' : 'entrada', displayProjection?.id)}
                    onPlaying={() => { overlayStartedRef.current = true; }}
                    onError={() => { setOverlayCovered(true); setExiting(false); }}
                    onEnded={() => { if (exiting) setExiting(false); }}
                    // La opacidad la maneja el efecto de animación del overlay.
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
              )}

              {/* Código de reserva de la proyección activa, superpuesto sobre la
                  imagen/video para que quien la ve pueda identificar su turno. */}
              {displayProjection?.code && !projectionHidden && (
                <Box style={{
                  position: 'absolute',
                  top: 12,
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
    </Box>
  );
}