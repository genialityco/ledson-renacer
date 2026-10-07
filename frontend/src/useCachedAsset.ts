import { useEffect, useState } from 'react';

const CACHE_NAME = 'ledson-screen-assets-v1';
const RETRY_MS = 60_000;

// Devuelve una URL local (blob:) del archivo si ya está guardado en el Cache
// API del navegador, y mientras tanto (o si no se puede) la URL original. La
// primera vez se descarga en segundo plano y se guarda: así, si después se
// cae el internet o se recarga la pantalla sin conexión, videos e imágenes
// clave (videoloop, video de transición, imagen por defecto) siguen
// disponibles. Al terminar de descargar cambia a la copia local para que la
// reproducción ya no dependa de la red.
export function useCachedAsset(url?: string | null): string {
  const [src, setSrc] = useState(url || '');

  useEffect(() => {
    setSrc(url || '');
    if (!url || typeof caches === 'undefined') return;
    let cancelled = false;
    let objectUrl: string | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const toLocal = async (res: Response) => {
      const blob = await res.blob();
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    };

    const load = async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const hit = await cache.match(url);
        if (hit) {
          await toLocal(hit);
          return;
        }
        // Sin copia guardada: se descarga solo si hay conexión; mientras
        // tanto se sigue usando la URL original tal cual.
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Se guarda la descarga COMPLETA (blob) y no la respuesta en
        // streaming: si la red se corta a mitad de un video grande, no queda
        // guardada una copia incompleta.
        const blob = await res.blob();
        await cache.put(
          url,
          new Response(blob, { headers: { 'Content-Type': res.headers.get('Content-Type') || blob.type } }),
        );
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch (e) {
        // Sin red, descarga interrumpida o sin CORS: se reintenta en un
        // minuto, hasta lograr la copia local.
        console.warn('No se pudo guardar copia local de', url, e);
        if (!cancelled) retryTimer = setTimeout(load, RETRY_MS);
      }
    };
    load();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return src;
}
