// Envía un evento a Google Analytics (gtag.js, cargado en index.html).
// No falla si gtag no está disponible (bloqueadores de anuncios, o si el
// script de GA todavía no terminó de cargar).
export function trackGtagEvent(
  eventName: string,
  params: Record<string, unknown>,
) {
  const gtag = (window as any).gtag;
  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  }
}
