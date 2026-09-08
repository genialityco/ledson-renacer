import { useEffect, useRef, useState } from 'react';
import { Modal, Box, Text, Button, Group, RangeSlider, Slider } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react';
import { useLanguage } from './i18n';

interface VideoTrimModalProps {
  opened: boolean;
  file: File | null;
  maxSeconds?: number;
  // Proporción ancho/alto del encuadre de destino (ej. 576/1152, la de la
  // pantalla gigante). Si se pasa, se muestra además el recuadro de encuadre
  // (arrastrar + zoom); si se omite, el modal se comporta como antes (solo
  // selector de tramo, sin encuadre espacial).
  aspect?: number;
  onCancel: () => void;
  onConfirm: (trim: { trimStart: number; trimEnd: number; frameX?: number; frameY?: number; frameZoom?: number }) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// Selector de tramo estilo WhatsApp/Instagram Stories: el usuario arrastra dos
// manijas sobre la línea de tiempo del video para elegir hasta `maxSeconds`.
// A propósito NO recorta/recodifica el archivo (eso requeriría una librería
// pesada tipo ffmpeg en el navegador) — solo guarda el tramo elegido como
// metadatos (trimStart/trimEnd). El video completo se sube tal cual, y quien
// lo reproduce (la pantalla gigante) arranca y corta exactamente en esos
// segundos, dando el mismo resultado visual que un recorte real.
//
// Cuando se pasa `aspect`, además se puede encuadrar el video (arrastrar para
// mover, slider para zoom) dentro de un recuadro con esa proporción. Al igual
// que el tramo, esto tampoco recorta el archivo: se guardan frameX/frameY
// (posición, en % relativo al centro) y frameZoom, y la pantalla aplica
// exactamente el mismo transform al reproducir — así el encuadre que ve el
// usuario aquí es el mismo que se proyecta.
export function VideoTrimModal({ opened, file, maxSeconds, aspect, onCancel, onConfirm }: VideoTrimModalProps) {
  // Sin maxSeconds no hay límite de duración del tramo (ej. contenido de la
  // pantalla de reposo, que puede durar lo que sea) — solo se acota si el
  // caller pasa un valor explícito (ej. 15 para el video del photobooth).
  const effectiveMax = maxSeconds ?? Infinity;
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const maxPanPercent = (z: number) => ((z - 1) / z) * 50;

  const handleZoomChange = (val: number) => {
    const maxPan = maxPanPercent(val);
    setPan((p) => ({ x: clamp(p.x, -maxPan, maxPan), y: clamp(p.y, -maxPan, maxPan) }));
    setZoom(val);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!aspect) return;
    draggingRef.current = { startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Se divide por zoom porque translate() usa % relativo al tamaño sin
    // escalar del video, pero scale() se aplica encima: sin esto, arrastrar
    // movería el contenido más rápido que el cursor a medida que se hace zoom.
    const dxPct = ((e.clientX - draggingRef.current.startX) / rect.width) * 100 / zoom;
    const dyPct = ((e.clientY - draggingRef.current.startY) / rect.height) * 100 / zoom;
    const maxPan = maxPanPercent(zoom);
    setPan({
      x: clamp(draggingRef.current.startPanX + dxPct, -maxPan, maxPan),
      y: clamp(draggingRef.current.startPanY + dyPct, -maxPan, maxPan),
    });
  };

  const handlePointerUp = () => {
    draggingRef.current = null;
  };

  const handleLoadedMetadata = () => {
    const d = videoRef.current?.duration || 0;
    setDuration(d);
    setRange([0, Math.min(d, effectiveMax)]);
  };

  const handleRangeChange = (val: [number, number]) => {
    let [s, e] = val;
    if (e - s > effectiveMax) {
      // Determinar cuál de las dos manijas se movió para mantener fija la otra.
      if (s !== range[0]) s = e - effectiveMax;
      else e = s + effectiveMax;
    }
    setRange([s, e]);
    if (videoRef.current) videoRef.current.currentTime = s;
  };

  const togglePreview = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.pause();
      setIsPlaying(false);
    } else {
      v.currentTime = range[0];
      v.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime >= range[1]) {
      v.pause();
      v.currentTime = range[0];
      setIsPlaying(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onCancel} size="md" title={t('trimModalTitle')} centered>
      <Box
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={aspect ? {
          position: 'relative',
          width: '100%',
          maxWidth: 260,
          aspectRatio: String(aspect),
          margin: '0 auto',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#000',
          cursor: 'grab',
          touchAction: 'none',
        } : {
          position: 'relative',
          width: '100%',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        {objectUrl && (
          <video
            ref={videoRef}
            src={objectUrl}
            style={aspect ? {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${zoom}) translate(${pan.x}%, ${pan.y}%)`,
              pointerEvents: 'none',
            } : {
              width: '100%',
              maxHeight: 360,
              display: 'block',
            }}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            playsInline
          />
        )}
      </Box>
      {aspect && duration > 0 && (
        <>
          <Text size="xs" c="dimmed" mt="sm" mb={4}>{t('cropZoomLabel')} — {t('trimFrameDragHint')}</Text>
          <Slider value={zoom} onChange={handleZoomChange} min={1} max={3} step={0.01} label={(v) => v.toFixed(1)} />
        </>
      )}
      {duration > 0 && (
        <>
          <Group justify="space-between" mt="md" mb={4}>
            <Text size="sm" fw={500}>
              {maxSeconds != null
                ? t('trimSelectedLabel').replace('{sec}', (range[1] - range[0]).toFixed(1)).replace('{max}', String(maxSeconds))
                : t('trimSelectedLabelNoMax').replace('{sec}', (range[1] - range[0]).toFixed(1))}
            </Text>
            <Button
              size="xs"
              variant="light"
              leftSection={isPlaying ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
              onClick={togglePreview}
            >
              {isPlaying ? t('trimPause') : t('trimPreview')}
            </Button>
          </Group>
          <RangeSlider
            min={0}
            max={duration}
            step={0.1}
            value={range}
            onChange={handleRangeChange}
            label={(v) => `${v.toFixed(1)}s`}
            minRange={0.5}
          />
        </>
      )}
      <Group justify="space-between" mt="lg">
        <Button variant="default" onClick={onCancel}>{t('trimCancel')}</Button>
        <Button
          color="blue"
          disabled={duration === 0}
          onClick={() => onConfirm({
            trimStart: range[0],
            trimEnd: range[1],
            ...(aspect ? { frameX: pan.x, frameY: pan.y, frameZoom: zoom } : {}),
          })}
        >
          {t('trimConfirm')}
        </Button>
      </Group>
    </Modal>
  );
}
