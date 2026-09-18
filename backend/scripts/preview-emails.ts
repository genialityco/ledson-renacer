import * as fs from 'fs';
import * as path from 'path';
import {
  renderBookingConfirmationEmail,
  renderResultEmail,
  renderAbandonedCartEmail,
  renderButton,
  renderResultMediaImage,
} from '../src/email/email.templates';

const FRONTEND_URL = 'https://www.c13.myledson.com';
const BACKEND_URL = 'https://api.c13.myledson.com';
const SAMPLE_EMAIL = 'juan.fernando@example.com';
const SAMPLE_IMAGE =
  'https://images.unsplash.com/photo-1520975916090-3105956dac38?w=800';

const outDir = path.resolve(__dirname, 'output');
fs.mkdirSync(outDir, { recursive: true });

function write(name: string, html: string) {
  fs.writeFileSync(path.join(outDir, name), html, 'utf-8');
  console.log(`generado: ${name}`);
}

for (const lang of ['es', 'en'] as const) {
  // 1. Confirmación de reserva
  const confirmation = renderBookingConfirmationEmail({
    lang,
    frontendUrl: FRONTEND_URL,
    backendUrl: BACKEND_URL,
    recipientEmail: SAMPLE_EMAIL,
    name: 'Juan Fernando',
    code: 'A3-F9-K2',
    statusLink: `${FRONTEND_URL}/my-bookings?code=A3-F9-K2`,
    scheduleLines:
      lang === 'es'
        ? [
            'Tu horario reservado es <strong>10:45 - 11:00</strong>',
            'Vivirás tu experiencia en pantalla a las ~<strong>10:47</strong>',
          ]
        : [
            'Your reserved time slot is <strong>10:45 - 11:00</strong>',
            "You'll live your experience on screen at ~<strong>10:47</strong>",
          ],
  });
  write(`1-confirmacion-${lang}.html`, confirmation.html);

  // 2. Recuerdo (foto)
  const downloadUrl = `${FRONTEND_URL.replace('www.c13', 'api')}/api/bookings/download/A3-F9-K2`;
  const mediaBlockPhoto = `${renderResultMediaImage(SAMPLE_IMAGE, 'foto')}${renderButton(lang === 'es' ? 'Descarga tu recuerdo' : 'Download your memory', downloadUrl, { widthPercent: 85 })}`;
  const resultPhoto = renderResultEmail({
    lang,
    frontendUrl: FRONTEND_URL,
    backendUrl: BACKEND_URL,
    recipientEmail: SAMPLE_EMAIL,
    name: 'Juan Fernando',
    mediaBlockHtml: mediaBlockPhoto,
    isVideo: false,
  });
  write(`2-recuerdo-foto-${lang}.html`, resultPhoto.html);

  // 2b. Recuerdo (video)
  const mediaBlockVideo = renderButton(
    lang === 'es' ? 'Descarga tu recuerdo' : 'Download your memory',
    downloadUrl,
    { widthPercent: 85 },
  );
  const resultVideo = renderResultEmail({
    lang,
    frontendUrl: FRONTEND_URL,
    backendUrl: BACKEND_URL,
    recipientEmail: SAMPLE_EMAIL,
    name: 'Juan Fernando',
    mediaBlockHtml: mediaBlockVideo,
    isVideo: true,
  });
  write(`2b-recuerdo-video-${lang}.html`, resultVideo.html);

  // 3. Carrito abandonado
  const abandoned = renderAbandonedCartEmail({
    lang,
    frontendUrl: FRONTEND_URL,
    backendUrl: BACKEND_URL,
    recipientEmail: SAMPLE_EMAIL,
    name: 'Juan Fernando',
    savedLine:
      lang === 'es'
        ? 'Tu foto y tu horario <strong>10:45-11:00</strong> del <strong>2026-09-09</strong> aún están guardados.'
        : 'Your photo and your time slot <strong>10:45-11:00</strong> on <strong>2026-09-09</strong> are still saved.',
  });
  write(`3-abandonado-${lang}.html`, abandoned.html);
}

console.log(`\nListo. Abrir los archivos en: ${outDir}`);
