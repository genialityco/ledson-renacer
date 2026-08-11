import { useEffect, useRef, useState } from 'react';
import { Modal, Box, Text, Button, Group, RangeSlider } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react';
import { useLanguage } from './i18n';

interface VideoTrimModalProps {
  opened: boolean;
  file: File | null;
  maxSeconds?: number;
  onCancel: () => void;
  onConfirm: (trim: { trimStart: number; trimEnd: number }) => void;
}

// Selector de tramo estilo WhatsApp/Instagram Stories: el usuario arrastra dos
// manijas sobre la línea de tiempo del video para elegir hasta `maxSeconds`.
// A propósito NO recorta/recodifica el archivo (eso requeriría una librería
// pesada tipo ffmpeg en el navegador) — solo guarda el tramo elegido como
// metadatos (trimStart/trimEnd). El video completo se sube tal cual, y quien
// lo reproduce (la pantalla gigante) arranca y corta exactamente en esos
// segundos, dando el mismo resultado visual que un recorte real.
export function VideoTrimModal({ opened, file, maxSeconds = 15, onCancel, onConfirm }: VideoTrimModalProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleLoadedMetadata = () => {
    const d = videoRef.current?.duration || 0;
    setDuration(d);
    setRange([0, Math.min(d, maxSeconds)]);
  };

  const handleRangeChange = (val: [number, number]) => {
    let [s, e] = val;
    if (e - s > maxSeconds) {
      // Determinar cuál de las dos manijas se movió para mantener fija la otra.
      if (s !== range[0]) s = e - maxSeconds;
      else e = s + maxSeconds;
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
      <Box style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
        {objectUrl && (
          <video
            ref={videoRef}
            src={objectUrl}
            style={{ width: '100%', maxHeight: 360, display: 'block' }}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            playsInline
          />
        )}
      </Box>
      {duration > 0 && (
        <>
          <Group justify="space-between" mt="md" mb={4}>
            <Text size="sm" fw={500}>
              {t('trimSelectedLabel').replace('{sec}', (range[1] - range[0]).toFixed(1)).replace('{max}', String(maxSeconds))}
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
        <Button color="blue" disabled={duration === 0} onClick={() => onConfirm({ trimStart: range[0], trimEnd: range[1] })}>
          {t('trimConfirm')}
        </Button>
      </Group>
    </Modal>
  );
}
