import type Webcam from 'react-webcam';

// Captura el cuadro actual de la cámara recortado al centro con la proporción
// `aspect`, a la resolución real del video (el mismo encuadre que muestra la
// vista previa con objectFit "cover"). Devuelve null si la cámara aún no
// entrega imagen.
export function captureAtAspect(webcam: Webcam | null, aspect: number): string | null {
  const video = webcam?.video;
  if (!video || !video.videoWidth || !video.videoHeight) return null;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const sw = Math.min(vw, Math.round(vh * aspect));
  const sh = Math.min(vh, Math.round(vw / aspect));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/jpeg', 1);
}
