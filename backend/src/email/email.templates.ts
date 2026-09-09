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
        <td style="background-color: ${EMAIL_COLORS.blue}; border-radius: 6px;">
          <a href="${url}" style="display: inline-block; padding: 14px 32px; font-family: ${EMAIL_FONT_STACK}; font-size: 16px; font-weight: 700; color: ${EMAIL_COLORS.white}; text-decoration: none;">${text}</a>
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
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 16px;">
      <tr>
        <td width="40" height="40" style="background-color: ${EMAIL_COLORS.green}; border-radius: 50%; text-align: center; vertical-align: middle; font-family: ${EMAIL_FONT_STACK}; font-size: 20px; color: ${EMAIL_COLORS.white}; line-height: 40px;">&#10003;</td>
      </tr>
    </table>
  `;
}

export function renderCodeBox(code: string): string {
  return `
    <p style="font-size: 26px; font-weight: 700; letter-spacing: 3px; color: ${EMAIL_COLORS.blue}; border: 2px dashed ${EMAIL_COLORS.blue}; border-radius: 12px; padding: 12px 24px; display: inline-block; margin: 8px 0 16px; font-family: ${EMAIL_FONT_STACK};">${code}</p>
  `;
}

function renderDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;"><tr><td style="border-top: 1px solid ${EMAIL_COLORS.cardGray};">&nbsp;</td></tr></table>`;
}

function renderSocialIconsRow(frontendUrl: string): string {
  const cells = SOCIAL_LINKS.map(
    (s) => `
      <td style="padding: 0 6px;">
        <a href="${s.href}"><img src="${frontendUrl}/email-assets/social-${s.icon}.png" alt="${s.name}" width="36" height="36" style="display: block; border-radius: 50%;" /></a>
      </td>
    `,
  ).join('');
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
      <tr>${cells}</tr>
    </table>
  `;
}

function renderHeader(frontendUrl: string): string {
  return `
    <tr>
      <td style="padding: 24px 24px 0; text-align: center;">
        <img src="${frontendUrl}/logo-leds-on.png" alt="led's on" width="140" style="display: inline-block; border: 0;" />
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 0 0;">
        <img src="${frontendUrl}/email-assets/header-banner.jpg" alt="LED'S ON Comuna 13" width="600" style="display: block; width: 100%; max-width: 600px; border: 0;" />
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
    copyright: "© LED'S ON",
    location: 'Medellín, Colombia',
  },
  en: {
    followUs: 'FOLLOW US:',
    about: "About LED'S ON",
    terms: 'Terms and Conditions',
    legal:
      "You received this email because you booked your spot in the LED'S ON Experience on the biggest screen in Comuna 13.",
    copyright: "© LED'S ON",
    location: 'Medellín, Colombia',
  },
};

function renderFooter(
  lang: Lang,
  frontendUrl: string,
  utmMedium: EmailUtmMedium,
): string {
  const t = FOOTER_TEXT[lang];
  const homeUrl = withUtm(`${MYLEDSON_BASE_URL}/`, utmMedium);
  const aboutUrl = withUtm(`${MYLEDSON_BASE_URL}/sobre-nosotros/`, utmMedium);
  const termsUrl = withUtm(
    `${MYLEDSON_BASE_URL}/terminos-y-condiciones/`,
    utmMedium,
  );
  return `
    <tr>
      <td style="padding: 32px 24px; background-color: ${EMAIL_COLORS.cardGray}; text-align: center; border-radius: 16px;">
        <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 12px; letter-spacing: 1px; color: ${EMAIL_COLORS.textGray}; margin: 0 0 12px;">${t.followUs}</p>
        ${renderSocialIconsRow(frontendUrl)}
        <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 14px; font-weight: 700; color: ${EMAIL_COLORS.black}; margin: 16px 0 8px;">
          <a href="${homeUrl}" style="color: ${EMAIL_COLORS.black}; text-decoration: none;">myledson.com</a>
        </p>
        <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 12px; margin: 0 0 16px;">
          <a href="${aboutUrl}" style="color: ${EMAIL_COLORS.textGray}; text-decoration: underline;">${t.about}</a>
          &nbsp;&nbsp;
          <a href="${termsUrl}" style="color: ${EMAIL_COLORS.textGray}; text-decoration: underline;">${t.terms}</a>
        </p>
        <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 11px; color: ${EMAIL_COLORS.textGray}; margin: 0 0 20px; line-height: 1.5;">${t.legal}</p>
        <img src="${frontendUrl}/logo-leds-on-icono.png" alt="led's on" width="24" style="display: block; margin: 0 auto 8px; border: 0;" />
        <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 11px; color: ${EMAIL_COLORS.textGray}; margin: 0;">${t.copyright}<br/>${t.location}</p>
      </td>
    </tr>
  `;
}

function renderDocument(opts: {
  lang: Lang;
  preheader: string;
  bodyHtml: string;
  frontendUrl: string;
  utmMedium: EmailUtmMedium;
}): string {
  return `<!DOCTYPE html>
<html lang="${opts.lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
</head>
<body style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.white};">
<div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${opts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${EMAIL_COLORS.white};">
<tr>
<td align="center" style="padding: 24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;">
${renderHeader(opts.frontendUrl)}
<tr>
<td style="padding: 32px 24px 24px;">
${opts.bodyHtml}
</td>
</tr>
${renderFooter(opts.lang, opts.frontendUrl, opts.utmMedium)}
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
          subject: "Thanks for your Led's on Renacer booking!",
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
          subject: "¡Gracias por tu reserva en Led's on Renacer!",
        };

  const scheduleHtml = data.scheduleLines
    .map(
      (line) =>
        `<p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; color: ${EMAIL_COLORS.black}; margin: 4px 0;">${line}</p>`,
    )
    .join('');

  const cardInner = `
    ${renderCheckIcon()}
    <h2 style="font-family: ${EMAIL_FONT_STACK}; font-size: 19px; color: ${EMAIL_COLORS.black}; margin: 0 0 12px;">${t.confirmed}</h2>
    ${scheduleHtml}
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 14px; color: ${EMAIL_COLORS.textGray}; margin: 20px 0 4px;">${t.codeLabel}</p>
    ${renderCodeBox(data.code)}
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 14px; color: ${EMAIL_COLORS.textGray}; margin: 0 0 4px;">${t.saveCode}</p>
    <p style="margin: 0;"><a href="${data.statusLink}" style="font-family: ${EMAIL_FONT_STACK}; color: ${EMAIL_COLORS.blue}; font-weight: 700; font-size: 14px;">${t.statusLink}</a></p>
  `;

  const bodyHtml = `
    <h1 style="font-family: ${EMAIL_FONT_STACK}; font-size: 24px; color: ${EMAIL_COLORS.blue}; text-align: center; margin: 0 0 24px;">${t.title}</h1>
    ${renderCard(cardInner, { bg: EMAIL_COLORS.cardGray })}
    ${renderDivider()}
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; font-weight: 700; color: ${EMAIL_COLORS.black}; text-align: center; margin: 0 0 6px;">${t.remember}</p>
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 14px; color: ${EMAIL_COLORS.textGray}; text-align: center; margin: 0;">${t.rememberText}</p>
    ${renderDivider()}
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; font-weight: 700; color: ${EMAIL_COLORS.black}; text-align: center; margin: 0 0 16px;">${t.wantMore}</p>
    <div style="text-align: center;">${renderButton(t.cta, bookingUrl)}</div>
  `;

  return {
    html: renderDocument({
      lang: data.lang,
      preheader: t.confirmed,
      bodyHtml,
      frontendUrl: data.frontendUrl,
      utmMedium,
    }),
    subject: t.subject,
  };
}

// --- Correo 2: recuerdo/resultado ---

export function renderResultEmail(data: {
  lang: Lang;
  frontendUrl: string;
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
          subject: data.isVideo
            ? "Your Led's on Renacer video is ready!"
            : "Your Led's on Renacer photo is ready!",
        }
      : {
          title: `Hola ${data.name}`,
          subtitle:
            '¡Ahora eres arte vivo en la historia de la Comuna 13 en Medellín!',
          ready: 'Aquí tienes el recuerdo de tu experiencia:',
          enjoyed: 'Esperamos que lo hayas disfrutado :)',
          share:
            'Publica tu experiencia en tus redes sociales y etiquétanos como @myledson',
          wantMore: '¿Quieres un nuevo espacio en pantalla?',
          cta: 'Reserva ahora aquí',
          subject: data.isVideo
            ? "¡Tu video de Led's on Renacer está listo!"
            : "¡Tu foto de Led's on Renacer está lista!",
        };

  const cardInner = `
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; color: ${EMAIL_COLORS.black}; margin: 0 0 16px;">${t.ready}</p>
    ${data.mediaBlockHtml}
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; font-weight: 700; color: ${EMAIL_COLORS.black}; margin: 16px 0 8px;">${t.enjoyed}</p>
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 14px; color: ${EMAIL_COLORS.textGray}; margin: 0;">${t.share}</p>
  `;

  const bodyHtml = `
    <h1 style="font-family: ${EMAIL_FONT_STACK}; font-size: 24px; color: ${EMAIL_COLORS.blue}; text-align: center; margin: 0 0 8px;">${t.title}</h1>
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; color: ${EMAIL_COLORS.black}; text-align: center; margin: 0 0 24px;">${t.subtitle}</p>
    ${renderCard(cardInner, { bg: EMAIL_COLORS.white, border: `1px solid ${EMAIL_COLORS.cardGray}` })}
    ${renderDivider()}
    <p style="font-family: ${EMAIL_FONT_STACK}; font-size: 15px; font-weight: 700; color: ${EMAIL_COLORS.black}; text-align: center; margin: 0 0 16px;">${t.wantMore}</p>
    <div style="text-align: center;">${renderButton(t.cta, bookingUrl)}</div>
  `;

  return {
    html: renderDocument({
      lang: data.lang,
      preheader: t.subtitle,
      bodyHtml,
      frontendUrl: data.frontendUrl,
      utmMedium,
    }),
    subject: t.subject,
  };
}

// --- Correo 3: carrito abandonado ---

export function renderAbandonedCartEmail(data: {
  lang: Lang;
  frontendUrl: string;
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
    <h1 style="font-family: ${EMAIL_FONT_STACK}; font-size: 24px; color: ${EMAIL_COLORS.blue}; text-align: center; margin: 0 0 24px;">${t.title}</h1>
    ${renderCard(cardInner, { bg: EMAIL_COLORS.cardGray })}
  `;

  return {
    html: renderDocument({
      lang: data.lang,
      preheader: t.notice,
      bodyHtml,
      frontendUrl: data.frontendUrl,
      utmMedium,
    }),
    subject: t.subject,
  };
}
