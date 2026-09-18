// URL base del backend. VITE_API_URL permite apuntar a producción (Netlify -> DigitalOcean).
// Sin esa variable, se asume que el backend corre en el puerto 5000 del mismo host
// (comportamiento actual usado en desarrollo local y en la pantalla grande dentro de la LAN).
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

// Fecha de HOY en la zona horaria local del dispositivo, como "YYYY-MM-DD".
// new Date().toISOString() siempre convierte a UTC, así que entre ~7pm y
// medianoche hora Colombia (UTC-5) devuelve la fecha de MAÑANA. Este helper
// arma el string a partir de los getters locales (getFullYear/Month/Date)
// para que siempre coincida con el calendario del dispositivo del usuario.
export const getLocalDateStr = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// URLs legales publicadas en myledson.com. Llevan los UTM acordados con el
// cliente para poder distinguir en analytics desde qué formulario se abrieron:
// 'web_sale' = formulario público con pago online, 'pos_sale' = formulario del
// stand físico (Reserva Asistida). Los correos arman sus propias URLs (con
// utm_source=email) en backend/src/email/email.templates.ts.
export type LegalUtmSource = 'web_sale' | 'pos_sale';

const legalUrl = (slug: string, source: LegalUtmSource) =>
  `https://myledson.com/${slug}/?utm_source=${source}&utm_medium=web_app&utm_campaign=leds_on_comuna_13`;

export const getLegalLinks = (source: LegalUtmSource) => ({
  terms: legalUrl('terminos-y-condiciones', source),
  privacy: legalUrl('politica-de-tratamiento-de-datos-personales', source),
});

// La foto del usuario se recorta a la proporción de la pantalla (cropWidth x
// cropHeight) pero a este múltiplo de resolución: la pantalla la muestra a
// 576x1152, mientras que el recuerdo digital por correo conserva el detalle.
export const PHOTO_QUALITY_SCALE = 2;

// Peso máximo de un video subido por el usuario. Debe ir de la mano del
// límite del backend (MAX_UPLOAD_MB en main.ts, que además cuenta el +33% de
// base64). Configurable con VITE_MAX_VIDEO_MB.
export const MAX_VIDEO_MB = Number(import.meta.env.VITE_MAX_VIDEO_MB) || 200;
