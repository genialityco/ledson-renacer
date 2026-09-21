import { useEffect, useState } from 'react';

const CACHE_NAME = 'ledson-screen-assets-v1';

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

    const toLocal = async (res: Response) => {
      const blob = await res.blob();
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    };

    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const hit = await cache.match(url);
        if (hit) {
          await toLocal(hit);
          return;
        }
        // Sin copia guardada: se descarga solo si hay conexión; si falla,
        // se sigue usando la URL original tal cual.
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) return;
        await cache.put(url, res.clone());
        await toLocal(res);
      } catch {
        /* sin red o sin CORS: se queda con la URL original */
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return src;
}
