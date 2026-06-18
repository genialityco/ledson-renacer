# Frontend - Renacer Sistema de Reservas

Este es el cliente web de la aplicación **Renacer**, desarrollado con **React 19**, **TypeScript** y **Vite**. La aplicación está diseñada para manejar el flujo completo de captura de fotos y visualización en pantalla gigante, junto con la administración del sistema.

## 🛠 Tecnologías Utilizadas

- **Framework:** [React 19](https://react.dev/)
- **Bundler:** [Vite](https://vitejs.dev/)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **UI & Estilos:** [Mantine UI](https://mantine.dev/) (Componentes core y hooks), CSS Modules y PostCSS.
- **Enrutamiento:** `react-router-dom` v7.
- **Interacción y Medios:** 
  - `react-webcam` para la captura de fotos desde el navegador.
  - `react-qr-code` para generar códigos QR de acceso a reservas.
  - `react-big-calendar` para la visualización del calendario administrativo.
- **Peticiones HTTP:** `axios` para la comunicación con el backend REST.
- **Utilidades:** `date-fns` (manejo de fechas), `react-transition-group`.

## 🚀 Instalación y Ejecución

1. **Instalar dependencias:**
   Asegúrate de estar en el directorio `frontend/` y ejecuta:
   ```bash
   npm install
   ```

2. **Ejecutar en modo desarrollo:**
   ```bash
   npm run dev
   ```
   Esto levantará un servidor local (típicamente en `http://localhost:5173`) con recarga en caliente (HMR). Asegúrate de tener el backend corriendo en el puerto 5000 (`http://localhost:5000`), ya que los servicios axios apuntan hacia allí.

3. **Construir para producción:**
   ```bash
   npm run build
   ```
   Generará los archivos estáticos optimizados en la carpeta `dist/`.

4. **Previsualizar producción:**
   ```bash
   npm run preview
   ```

## 📂 Estructura de Vistas (`/src`)

El enrutamiento está definido en `App.tsx` e incluye las siguientes vistas clave:

- **Vista de Usuario:**
  - `Home.tsx` (`/`): Landing page inicial. Muestra una animación de imágenes cayendo, un código QR para acceso rápido y botones para iniciar la reserva o consultar el estado de las proyecciones.
  - `BookingForm.tsx` (`/booking`): Formulario principal de reservas. Permite ingresar datos personales, seleccionar horarios disponibles, aplicar filtros visuales y tomar una foto (vía webcam) o subir un archivo.
  - `AssistedBookingForm.tsx` (`/assisted-booking`): Versión del formulario de reserva adaptada para asistencia por parte del staff.
  - `UserBookingsView.tsx` (`/my-bookings`): Portal donde el usuario puede buscar el estado de su reserva (Pendiente, Confirmada, Generada, Proyectada) usando su cédula o correo.

- **Vista de Proyección:**
  - `BigScreenView.tsx` (`/screen`): Vista especializada diseñada *exclusivamente* para ser mostrada en la pantalla gigante. Renderiza la cola de imágenes, transiciones, carruseles y overlays (header/footer). Oculta el layout estándar (AppShell) de Mantine.

- **Panel de Administración:**
  - `AdminDashboard.tsx` (`/admin`): Panel de control que gestiona reservas, aprobación de imágenes, configuración de marcos/filtros, ajuste de la configuración de la Pantalla Gigante (carrusel, duraciones, fondos) y plantillas de horarios.
  - `GridCalendarView.tsx` (`/admin/grid`): Vista administrativa para programar y visualizar los contenidos base de la pantalla gigante utilizando `react-big-calendar`.
  - `BookingsCalendarView.tsx` (`/admin/bookings-calendar`): Vista administrativa para visualizar las reservas y su estatus (Pendiente, Aprobada, etc) en formato de calendario utilizando `react-big-calendar`.

