import { useCallback, useState } from 'react';
import { Modal, Box, Slider, Button, Group, Text } from '@mantine/core';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { useLanguage } from './i18n';

interface ImageCropModalProps {
  opened: boolean;
  imageSrc: string | null;
  aspect: number;
  outputWidth: number;
  outputHeight: number;
  title?: string;
  onCancel: () => void;
  onConfirm: (croppedBase64: string) => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function getCroppedImageBase64(
  imageSrc: string,
  cropPixels: Area,
  outputWidth: number,
  outputHeight: number,
): Promise<string> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageSrc;
  ctx.drawImage(
    image,
    cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
    0, 0, outputWidth, outputHeight,
  );
  return canvas.toDataURL('image/jpeg', 0.92);
}

// Recorte interactivo tipo Facebook/Instagram: el usuario arrastra y hace
// zoom dentro de un marco de proporción fija antes de confirmar. Se usa tanto
// para la foto del usuario (aspect 1, para no arriesgar la compatibilidad con
// la API de IA externa) como para las imágenes que sube el admin para la
// pantalla gigante (aspect 576/1152, la proporción real del proyector).
export function ImageCropModal({ opened, imageSrc, aspect, outputWidth, outputHeight, title, onCancel, onConfirm }: ImageCropModalProps) {
  const { t } = useLanguage();
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const reset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const base64 = await getCroppedImageBase64(imageSrc, croppedAreaPixels, outputWidth, outputHeight);
      reset();
      onConfirm(base64);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal opened={opened} onClose={handleCancel} size="md" title={title || t('cropModalTitle')} centered>
      <Box style={{ position: 'relative', width: '100%', height: 360, background: '#111', borderRadius: 12, overflow: 'hidden' }}>
        {imageSrc && (
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        )}
      </Box>
      <Text size="xs" c="dimmed" mt="sm" mb={4}>{t('cropZoomLabel')}</Text>
      <Slider value={zoom} onChange={setZoom} min={1} max={3} step={0.01} label={(v) => v.toFixed(1)} />
      <Group justify="space-between" mt="lg">
        <Button variant="default" onClick={handleCancel}>{t('cropCancel')}</Button>
        <Button color="blue" loading={isProcessing} disabled={!croppedAreaPixels} onClick={handleConfirm}>
          {t('cropConfirm')}
        </Button>
      </Group>
    </Modal>
  );
}
