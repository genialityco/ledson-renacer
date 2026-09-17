// Chrome (header/footer/botones/tarjetas) y los 3 correos transaccionales del
// sistema, como funciones puras (sin @Injectable/DI) para poder previsualizarlas
// sin Firestore ni SES. BookingsService sigue siendo dueño de toda la lógica de
// datos (código, horario, marco, idioma) y solo le pasa los valores ya resueltos
// a estas funciones para que arme el HTML final.

export type Lang = 'es' | 'en';

export const EMAIL_COLORS = {
  white: '#FFFFFF',
  cardGray: '#ECECEE',
  textGray: '#767676',
  blue: '#0559A5',
  green: '#49AD33',
  black: '#222222',
};

export const EMAIL_FONT_STACK =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// UTM de tracking, uno por tipo de correo (acordado con el usuario). Cada
// composer de más abajo fija el suyo — no lo recibe como parámetro porque
// hay una correspondencia fija 1 a 1 entre función y tipo de correo.
export type EmailUtmMedium =
  'booking_code' | 'download_memory' | 'abandoned_cart';

const UTM_SOURCE = 'email';
const UTM_CAMPAIGN = 'leds_on_comuna_13';

function withUtm(url: string, medium: EmailUtmMedium): string {
  const u = new URL(url);
  u.searchParams.set('utm_source', UTM_SOURCE);
  u.searchParams.set('utm_medium', medium);
  u.searchParams.set('utm_campaign', UTM_CAMPAIGN);
  return u.toString();
}

// Gmail (y otros webmail) precargan y cachean las imágenes de un correo la
// primera vez que las ven — si esa primera carga falla (ej. probando con un
// túnel de ngrok que aún no estaba arriba), el 404 queda pegado para ese
// correo aunque el origen ya sirva bien. `v` es un timestamp nuevo por cada
// correo generado (ver renderDocument) para que cada envío sea una URL
// nunca antes vista y jamás reutilice un fallo cacheado.
function withCacheBust(url: string, v: number): string {
  const u = new URL(url);
  u.searchParams.set('v', String(v));
  return u.toString();
}

const MYLEDSON_BASE_URL = 'https://myledson.com';

interface SocialLink {
  name: string;
  href: string;
  icon: string;
}

const SOCIAL_LINKS: SocialLink[] = [
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/myledson',
    icon: 'facebook',
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/myledson',
    icon: 'instagram',
  },
  {
    name: 'YouTube',
    href: 'https://www.youtube.com/@myledson',
    icon: 'youtube',
  },
  { name: 'X', href: 'https://www.x.com/myledson', icon: 'x' },
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/@myledson',
    icon: 'tiktok',
  },
];

export function renderButton(text: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
      <tr>
        <td style="background-color: ${EMAIL_COLORS.blue}; border-radius: 8px;">
          <a href="${url}" style="display: inline-block; min-width: 180px; padding: 16px 40px; font-family: ${EMAIL_FONT_STACK}; font-size: 16px; font-weight: 700; color: ${EMAIL_COLORS.white}; text-decoration: none; text-align: center;">${text}</a>
        </td>
      </tr>
    </table>
  `;
}

export function renderCard(
  innerHtml: string,
  opts: { bg: string; border?: string } = { bg: EMAIL_COLORS.cardGray },
): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background-color: ${opts.bg}; ${opts.border ? `border: ${opts.border};` : ''} border-radius: 16px; padding: 32px 24px; text-align: center;">
          ${innerHtml}
        </td>
      </tr>
    </table>
  `;
}

export function renderCheckIcon(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 4px auto 18px;">
      <tr>
        <td width="48" height="48" style="background-color: ${EMAIL_COLORS.white}; border: 2.5px solid ${EMAIL_COLORS.green}; border-radius: 50%; text-align: center; vertical-align: middle; font-family: ${EMAIL_FONT_STACK}; font-size: 22px; font-weight: 700; color: ${EMAIL_COLORS.green}; line-height: 44px;">&#10003;</td>
      </tr>
    </table>
  `;
}

// Foto/preview del recuerdo dentro de la tarjeta del correo 2 (resultado).
// width:100% (sin calc() ni márgenes negativos, que varios clientes de
// correo ignoran o aplican mal y hacían que la imagen se saliera del
// recuadro) — ocupa todo el ancho disponible dentro del padding de la
// tarjeta, que es el comportamiento seguro en todos los clientes.
export function renderResultMediaImage(src: string, alt: string): string {
  return `<img src="${src}" alt="${alt}" style="display: block; width: 100%; max-width: 100%; height: auto; margin: 0 0 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />`;
}

export function renderCodeBox(code: string): string {
  return `
    <p style="font-size: 26px; font-weight: 700; letter-spacing: 3px; color: ${EMAIL_COLORS.blue}; border: 1.5px dashed ${EMAIL_COLORS.blue}; border-radius: 12px; padding: 12px 24px; display: inline-block; margin: 8px 0 20px; font-family: ${EMAIL_FONT_STACK};">${code}</p>
  `;
}

function renderDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;"><tr><td style="border-top: 1px solid ${EMAIL_COLORS.cardGray};">&nbsp;</td></tr></table>`;
}

function renderSocialIconsRow(frontendUrl: string, v: number): string {
  const cells = SOCIAL_LINKS.map(
    (s) => `
      <td style="padding: 0 7px;">
        <a href="${s.href}"><img src="${withCacheBust(`${frontendUrl}/email-assets/social-${s.icon}.png`, v)}" alt="${s.name}" width="36" height="36" style="display: block; border: 0;" /></a>
      </td>
    `,
  ).join('');
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
      <tr>${cells}</tr>
    </table>
  `;
}

function renderHeader(frontendUrl: string, v: number): string {
  return `
    <tr>
      <td style="padding: 24px 24px 0; text-align: center;">
        <img src="${withCacheBust(`${frontendUrl}/logo-leds-on.png`, v)}" alt="led's on" width="140" style="display: inline-block; border: 0;" />
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 0 0;">
        <img src="${withCacheBust(`${frontendUrl}/email-assets/header-banner.jpg`, v)}" alt="LED'S ON Comuna 13" width="600" style="display: block; width: 100%; max-width: 600px; border: 0;" />
      </td>
    </tr>
  `;
}

const FOOTER_TEXT: Record<
  Lang,
  {
    followUs: string;
    about: string;
    terms: string;
    legal: string;
    unsubscribeQuestion: string;
    unsubscribeLink: string;
    copyright: string;
    location: string;
  }
> = {
  es: {
    followUs: 'SÍGUENOS EN:',
    about: "Sobre LED'S ON",
    terms: 'Términos y Condiciones',
    legal:
      "Has recibido este correo electrónico porque reservaste tu espacio en la Experiencia LED'S ON en la pantalla más grande de la Comuna 13.",
    unsubscribeQuestion: '¿No quieres recibir más mensajes?',
    unsubscribeLink: 'Darse de baja',
    copyright: "© LED'S ON",
    location: 'Medellín, Colombia',
  },
  en: {
    followUs: 'FOLLOW US:',
    about: "About LED'S ON",
    terms: 'Terms and Conditions',
    legal:
      "You received this email because you booked your spot in the LED'S ON Experience on the biggest screen in Comuna 13.",
    unsubscribeQuestion: "Don't want to receive more emails?",
    unsubscribeLink: 'Unsubscribe',
    copyright: "© LED'S ON",
    location: 'Medellín, Colombia',
  },
};

function renderFooter(
  lang: Lang,
  frontendUrl: string,
  backendUrl: string,
  recipientEmail: string,
  utmMedium: EmailUtmMedium,
  v: number,
): string {
  const t = FOOTER_TEXT[lang];
  const homeUrl = withUtm(`${MYLEDSON_BASE_URL}/`, utmMedium);
  const aboutUrl = withUtm(`${MYLEDSON_BASE_URL}/sobre-nosotros/`, utmMedium);
  const termsUrl = withUtm(
    `${MYLEDSON_BASE_URL}/terminos-y-condiciones/`,
    utmMedium,
  );
  const unsubscribeUrl = `${backendUrl}/api/bookings/unsubscribe?email=${encodeURIComponent(recipientEmail)}`;
  return `
    <tr>
      <td style="padding: 0 0 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding: 36px 24px; background-color: ${EMAIL_COLORS.cardGray}; text-align: center; border-radius: 16px;">
              <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 12px; letter-spacing: 1px; color: ${EMAIL_COLORS.textGray}; margin: 0 0 16px;">${t.followUs}</p>
              ${renderSocialIconsRow(frontendUrl, v)}
              <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 18px; font-weight: 700; color: ${EMAIL_COLORS.black}; margin: 22px 0 12px;">
                <a href="${homeUrl}" style="color: ${EMAIL_COLORS.black}; text-decoration: none;">myledson.com</a>
              </p>
              <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 12.5px; margin: 0 0 22px;">
                <a href="${aboutUrl}" style="color: ${EMAIL_COLORS.textGray}; text-decoration: underline;">${t.about}</a>
                &nbsp;&nbsp;&nbsp;
                <a href="${termsUrl}" style="color: ${EMAIL_COLORS.textGray}; text-decoration: underline;">${t.terms}</a>
              </p>
              <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 12px; color: ${EMAIL_COLORS.textGray}; margin: 0 auto 10px; max-width: 420px; line-height: 1.6;">${t.legal}</p>
              <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 12px; color: ${EMAIL_COLORS.textGray}; margin: 0 0 24px; line-height: 1.6;">${t.unsubscribeQuestion} <a href="${unsubscribeUrl}" style="color: ${EMAIL_COLORS.textGray}; text-decoration: underline;">${t.unsubscribeLink}</a></p>
              <img src="${withCacheBust(`${frontendUrl}/logo-leds-on-icono.png`, v)}" alt="led's on" width="24" style="display: block; margin: 0 auto 10px; border: 0;" />
              <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 11px; color: ${EMAIL_COLORS.textGray}; margin: 0; line-height: 1.6;">${t.copyright}<br/>${t.location}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function renderDocument(opts: {
  lang: Lang;
  preheader: string;
  bodyHtml: string;
  frontendUrl: string;
  backendUrl: string;
  recipientEmail: string;
  utmMedium: EmailUtmMedium;
}): string {
  const v = Date.now();
  return `<!DOCTYPE html>
<html lang="${opts.lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
</style>
</head>
<body style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.white}; font-family: ${EMAIL_FONT_STACK};">
<div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${opts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${EMAIL_COLORS.white};">
<tr>
<td align="center" style="padding: 24px 0;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;">
${renderHeader(opts.frontendUrl, v)}
${opts.bodyHtml}
${renderFooter(opts.lang, opts.frontendUrl, opts.backendUrl, opts.recipientEmail, opts.utmMedium, v)}
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

// --- Correo 1: confirmación de reserva ---

export function renderBookingConfirmationEmail(data: {
  lang: Lang;
  frontendUrl: string;
  backendUrl: string;
  recipientEmail: string;
  name: string;
  code: string;
  statusLink: string;
  scheduleLines: string[];
}): { html: string; subject: string } {
  const utmMedium: EmailUtmMedium = 'booking_code';
  const bookingUrl = withUtm(`${data.frontendUrl}/booking`, utmMedium);
  const t =
    data.lang === 'en'
      ? {
          title: `Hello, ${data.name}`,
          confirmed: "Your spot on the LED'S ON Comuna 13 screen is confirmed!",
          codeLabel: 'Your booking code is:',
          saveCode:
            'Save it to check your projection status, or go straight here:',
          statusLink: 'Check my booking status',
          remember: 'Remember!',
          rememberText:
            "Your image will be projected on screen and then we'll send the digital keepsake to your email",
          wantMore: 'Want a new spot on screen?',
          cta: 'Book now here',
          subject: "Booking completed successfully at LED'S ON Comuna 13",
        }
      : {
          title: `Hola, ${data.name}`,
          confirmed:
            "¡Tu reserva en la pantalla LED'S ON Comuna 13 está confirmada!",
          codeLabel: 'Tu código de reserva es:',
          saveCode:
            'Guárdalo para consultar el estado de tu proyección o entra directo aquí:',
          statusLink: 'Consultar estado de mi reserva',
          remember: '¡Recuerda!',
          rememberText:
            'Tu imagen se proyectará en pantalla y luego enviaremos el recuerdo digital a tu correo electrónico',
          wantMore: '¿Quieres un nuevo espacio en pantalla?',
          cta: 'Reserva ahora aquí',
          subject: "Reserva completada exitosamente en LED'S ON Comuna 13",
        };

  const scheduleHtml = data.scheduleLines
    .map(
      (line) =>
        `<p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; color: ${EMAIL_COLORS.black}; margin: 5px 0;">${line}</p>`,
    )
    .join('');

  const cardInner = `
    ${renderCheckIcon()}
    <h2 style="font-family: ${EMAIL_FONT_STACK}; font-size: 19px; color: ${EMAIL_COLORS.black}; margin: 0 0 20px; line-height: 1.35;">${t.confirmed}</h2>
    <div style="margin: 0 0 24px;">${scheduleHtml}</div>
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 14px; color: ${EMAIL_COLORS.textGray}; margin: 0 0 6px;">${t.codeLabel}</p>
    ${renderCodeBox(data.code)}
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 14px; color: ${EMAIL_COLORS.textGray}; margin: 4px 0 8px;">${t.saveCode}</p>
    <p style="margin: 0;"><a href="${data.statusLink}" style="font-family: ${EMAIL_FONT_STACK}; color: ${EMAIL_COLORS.blue}; font-weight: 700; font-size: 14px;">${t.statusLink}</a></p>
  `;

  // La tarjeta gris va en su propia fila sin padding horizontal (igual que
  // el recuadro gris del footer) para que ambas queden del mismo ancho — el
  // resto del contenido (título, recuerda, CTA) sí conserva el padding de
  // 24px para no pegarse a los bordes.
  const bodyHtml = `
    <tr>
      <td style="padding: 32px 24px 24px;">
        <h1 style="font-family: ${EMAIL_FONT_STACK}; font-size: 24px; color: ${EMAIL_COLORS.blue}; text-align: center; margin: 0;">${t.title}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 0 24px;">
        ${renderCard(cardInner, { bg: EMAIL_COLORS.cardGray })}
      </td>
    </tr>
    <tr>
      <td style="padding: 0 24px 24px;">
        ${renderDivider()}
        <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; font-weight: 700; color: ${EMAIL_COLORS.black}; text-align: center; margin: 0 0 8px;">${t.remember}</p>
        <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 14px; color: ${EMAIL_COLORS.textGray}; text-align: center; margin: 0 auto; max-width: 340px; line-height: 1.55;">${t.rememberText}</p>
        ${renderDivider()}
        <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; font-weight: 700; color: ${EMAIL_COLORS.black}; text-align: center; margin: 0 0 18px;">${t.wantMore}</p>
        <div style="text-align: center;">${renderButton(t.cta, bookingUrl)}</div>
      </td>
    </tr>
  `;

  return {
    html: renderDocument({
      lang: data.lang,
      preheader: t.confirmed,
      bodyHtml,
      frontendUrl: data.frontendUrl,
      backendUrl: data.backendUrl,
      recipientEmail: data.recipientEmail,
      utmMedium,
    }),
    subject: t.subject,
  };
}

// --- Correo 2: recuerdo/resultado ---

export function renderResultEmail(data: {
  lang: Lang;
  frontendUrl: string;
  backendUrl: string;
  recipientEmail: string;
  name: string;
  mediaBlockHtml: string;
  isVideo: boolean;
}): { html: string; subject: string } {
  const utmMedium: EmailUtmMedium = 'download_memory';
  const bookingUrl = withUtm(`${data.frontendUrl}/booking`, utmMedium);
  const t =
    data.lang === 'en'
      ? {
          title: `Hello ${data.name}`,
          subtitle:
            "You're now living art in the history of Comuna 13 in Medellín!",
          ready: 'Here is the memory of your experience:',
          enjoyed: 'We hope you enjoyed it :)',
          share:
            'Share your experience on social media and tag us as @myledson',
          wantMore: 'Want a new spot on screen?',
          cta: 'Book now here',
          subject: "Here's the memory of your LED'S ON Experience",
        }
      : {
          title: `Hola ${data.name}`,
          subtitle:
            '¡Ahora eres arte vivo en la historia de la Comuna 13 en Medellín!',
          ready: 'Aquí tienes el recuerdo de tu experiencia:',
          enjoyed: 'Esperamos que lo hayas disfrutado :)',
          share:
            'Publica tu experiencia en tus redes sociales y etiquétanos como <strong>@myledson</strong>',
          wantMore: '¿Quieres un nuevo espacio en pantalla?',
          cta: 'Reserva ahora aquí',
          subject: "Aquí tienes el recuerdo de tu Experiencia LED'S ON",
        };

  const cardInner = `
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; color: ${EMAIL_COLORS.black}; margin: 0 0 16px;">${t.ready}</p>
    ${data.mediaBlockHtml}
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; font-weight: 700; color: ${EMAIL_COLORS.black}; margin: 20px auto 8px; max-width: 320px; line-height: 1.4;">${t.enjoyed}</p>
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 14px; color: ${EMAIL_COLORS.textGray}; margin: 0 auto; max-width: 320px; line-height: 1.5;">${t.share}</p>
  `;

  // Sin línea separadora antes de "¿Quieres un nuevo espacio...": el bloque
  // queda centrado a puro margen (24px arriba y abajo) en vez de apoyarse en
  // un divider, para que respire parejo entre la tarjeta y el footer. La
  // tarjeta va en su propia fila sin padding horizontal (igual que el
  // recuadro gris del footer) para que ambas queden del mismo ancho.
  const bodyHtml = `
    <tr>
      <td style="padding: 32px 24px 24px;">
        <h1 style="font-family: ${EMAIL_FONT_STACK}; font-size: 24px; color: ${EMAIL_COLORS.blue}; text-align: center; margin: 0 0 8px;">${t.title}</h1>
        <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; color: ${EMAIL_COLORS.black}; text-align: center; margin: 0 auto 24px; max-width: 380px; line-height: 1.45;">${t.subtitle}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 0 28px;">
        ${renderCard(cardInner, { bg: EMAIL_COLORS.white, border: `1px solid ${EMAIL_COLORS.cardGray}` })}
      </td>
    </tr>
    <tr>
      <td style="padding: 0 24px 24px;">
        <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; font-weight: 700; color: ${EMAIL_COLORS.black}; text-align: center; margin: 0 0 16px;">${t.wantMore}</p>
        <div style="text-align: center;">${renderButton(t.cta, bookingUrl)}</div>
      </td>
    </tr>
  `;

  return {
    html: renderDocument({
      lang: data.lang,
      preheader: t.subtitle,
      bodyHtml,
      frontendUrl: data.frontendUrl,
      backendUrl: data.backendUrl,
      recipientEmail: data.recipientEmail,
      utmMedium,
    }),
    subject: t.subject,
  };
}

// --- Correo 3: carrito abandonado ---

export function renderAbandonedCartEmail(data: {
  lang: Lang;
  frontendUrl: string;
  backendUrl: string;
  recipientEmail: string;
  name: string;
  savedLine: string;
}): { html: string; subject: string } {
  const utmMedium: EmailUtmMedium = 'abandoned_cart';
  const bookingUrl = withUtm(`${data.frontendUrl}/booking`, utmMedium);
  const t =
    data.lang === 'en'
      ? {
          title: `Hello ${data.name}!`,
          notice:
            "We noticed you didn't finish the payment for your Led's on Renacer experience.",
          resume: 'You can pick up right where you left off:',
          cta: 'Book now here',
          subject: "Resume your Led's on Renacer booking!",
        }
      : {
          title: `¡Hola ${data.name}!`,
          notice:
            "Notamos que no terminaste el pago para tu experiencia Led's on Renacer.",
          resume: 'Puedes retomar tu compra justo donde la dejaste:',
          cta: 'Reserva ahora aquí',
          subject: "¡Retoma tu reserva de Led's on Renacer!",
        };

  const cardInner = `
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; color: ${EMAIL_COLORS.black}; margin: 0 0 12px;">${t.notice}</p>
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; color: ${EMAIL_COLORS.black}; margin: 0 0 20px;">${data.savedLine}</p>
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 14px; color: ${EMAIL_COLORS.textGray}; margin: 0 0 16px;">${t.resume}</p>
    <div style="text-align: center;">${renderButton(t.cta, bookingUrl)}</div>
  `;

  const bodyHtml = `
    <tr>
      <td style="padding: 32px 24px 24px;">
        <h1 style="font-family: ${EMAIL_FONT_STACK}; font-size: 24px; color: ${EMAIL_COLORS.blue}; text-align: center; margin: 0 0 24px;">${t.title}</h1>
        ${renderCard(cardInner, { bg: EMAIL_COLORS.cardGray })}
      </td>
    </tr>
  `;

  return {
    html: renderDocument({
      lang: data.lang,
      preheader: t.notice,
      bodyHtml,
      frontendUrl: data.frontendUrl,
      backendUrl: data.backendUrl,
      recipientEmail: data.recipientEmail,
      utmMedium,
    }),
    subject: t.subject,
  };
}
