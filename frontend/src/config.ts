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
