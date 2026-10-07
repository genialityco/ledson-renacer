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
//
// Con `aspect` (por ahora solo en celular), la vista previa se muestra con la
// proporción de la pantalla gigante (cropWidth / cropHeight) y la foto se
// captura con captureAtAspect (captureAtAspect.ts): lo que ve la persona es
// justo lo que se proyecta. Sin `aspect` se mantiene la vista previa de siempre.
export function CameraView({ webcamRef, aspect }: { webcamRef: RefObject<Webcam | null>; aspect?: number }) {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  return (
    <Box
      style={
        aspect
          ? { position: 'relative', height: '65vh', maxWidth: '100%', aspectRatio: String(aspect), margin: '0 auto' }
          : { position: 'relative', width: '100%' }
      }
    >
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
        style={{ width: '100%', height: aspect ? '100%' : '60vh', objectFit: 'cover', display: 'block' }}
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
