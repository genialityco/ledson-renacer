# Backend - Renacer Sistema de Reservas

Este es el servidor API para la aplicación **Renacer**. Está desarrollado bajo la arquitectura escalable de **NestJS** y proporciona todos los endpoints necesarios para la gestión de citas, notificaciones, usuarios y pagos.

## 🛠 Tecnologías Utilizadas

- **Framework:** [NestJS](https://nestjs.com/) (Node.js)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **Base de Datos & Auth:** [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) (Firestore, Authentication).
- **Almacenamiento:** Integración con `aws-sdk` (AWS S3) para manejo de imágenes.
- **Pagos:** Integración con la pasarela de pagos **Wompi**.
- **Tareas Programadas:** `@nestjs/schedule` para ejecución de cron jobs y automatizaciones del sistema.

## 📂 Módulos Principales (`/src`)

El backend está construido con un enfoque altamente modular:

- **`bookings/`**: Gestión integral de reservas.
- **`schedules/`**: Control de la disponibilidad y manejo de horarios.
- **`email/`**: Servicio para envío de notificaciones y confirmaciones por correo electrónico.
- **`firebase/`**: Conexión y servicios de base de datos e identidad con Firebase.
- **`images/`**: Procesamiento, subida y gestión de imágenes.
- **`wompi/`**: Lógica transaccional para el manejo de pagos mediante la pasarela Wompi.

## 🚀 Instalación y Ejecución

1. **Instalar dependencias:**
   Ubicado en el directorio `backend/`, ejecuta:
   ```bash
   npm install
   ```

2. **Configuración del Entorno:**
   - Asegúrate de colocar los archivos de credenciales necesarios.
   - Existe un archivo `sured-883e9-firebase-adminsdk.json` en la raíz de la carpeta `backend` usado para inicializar la conexión con Firebase de forma segura.

3. **Ejecutar el servidor en desarrollo:**
   ```bash
   npm run start:dev
   ```
   El servidor de NestJS se iniciará en modo "watch" (recarga automática ante cualquier cambio en el código).

4. **Ejecutar en producción:**
   ```bash
   npm run build
   npm run start:prod
   ```

## 🧪 Pruebas

Para ejecutar las pruebas Unitarias y End-to-End (E2E) configuradas con Jest:
```bash
# Pruebas unitarias
npm run test

# Pruebas e2e
npm run test:e2e
```