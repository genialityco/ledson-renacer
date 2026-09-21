import { useState, type RefObject } from 'react';
import Webcam from 'react-webcam';
import { ActionIcon, Box } from '@mantine/core';
import { IconCameraRotate } from '@tabler/icons-react';

// Vista previa de la cámara con captura a la máxima calidad disponible y botón
// para alternar entre cámara frontal y trasera (útil en celular). Pide hasta
// 4K como resolución "ideal": el navegador entrega la mayor que soporte el
// dispositivo. forceScreenshotSourceSize hace que la foto salga a la
// resolución real de la cámara y no al tamaño en pantalla del video, y la
// calidad JPEG va al máximo.
export function CameraView({ webcamRef }: { webcamRef: RefObject<Webcam | null> }) {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  return (
    <Box style={{ position: 'relative', width: '100%' }}>
      <Webcam
        key={facingMode}
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        screenshotQuality={1}
        forceScreenshotSourceSize
        videoConstraints={{
          facingMode,
          width: { ideal: 4096 },
          height: { ideal: 2160 },
        }}
        style={{ width: '100%', height: '60vh', objectFit: 'cover', display: 'block' }}
      />
      <ActionIcon
        variant="filled"
        color="dark"
        radius="xl"
        size={44}
        aria-label="Cambiar cámara"
        onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
        style={{ position: 'absolute', top: 12, right: 12, opacity: 0.85 }}
      >
        <IconCameraRotate size={24} />
      </ActionIcon>
    </Box>
  );
}
