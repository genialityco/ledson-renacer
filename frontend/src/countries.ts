import axios from 'axios';

export interface CountryOption {
  value: string;
  label: string;
}

const CACHE_KEY = 'ledson_countries_cache_v1';
let memoryCache: CountryOption[] | null = null;
let inFlight: Promise<CountryOption[]> | null = null;

// La lista de países de countriesnow.space pesa ~1MB (trae ciudades anidadas
// que acá ni usamos) y no cambia entre visitas. Antes se volvía a pedir
// entera cada vez que alguien abría el formulario de reserva — ahora se
// cachea en memoria (dura mientras la SPA sigue abierta) y en sessionStorage
// (sobrevive a un refresh de la página dentro de la misma sesión).
export async function fetchCountries(): Promise<CountryOption[]> {
  if (memoryCache) return memoryCache;
  if (inFlight) return inFlight;

  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      memoryCache = JSON.parse(cached);
      return memoryCache as CountryOption[];
    } catch {
      // Caché corrupto: se ignora y se vuelve a pedir a la API.
    }
  }

  inFlight = axios
    .get('https://countriesnow.space/api/v0.1/countries')
    .then((res) => {
      const options: CountryOption[] = res.data.error
        ? []
        : res.data.data.map((item: any) => ({ value: item.country, label: item.country }));
      memoryCache = options;
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(options));
      } catch {
        // sessionStorage lleno o no disponible — no es crítico, seguimos con el caché en memoria.
      }
      return options;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
