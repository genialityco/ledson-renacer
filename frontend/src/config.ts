// URL base del backend. VITE_API_URL permite apuntar a producción (Netlify -> DigitalOcean).
// Sin esa variable, se asume que el backend corre en el puerto 5000 del mismo host
// (comportamiento actual usado en desarrollo local y en la pantalla grande dentro de la LAN).
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;
