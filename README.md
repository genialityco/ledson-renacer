# Renacer - Sistema de Gestión de Reservas

Este es el repositorio principal del proyecto **Renacer**, un sistema integral para la gestión de reservas, manejo de horarios y pagos, dividido en dos componentes principales: Frontend y Backend.

## 📁 Estructura del Proyecto

El proyecto está organizado en un monorepositorio con la siguiente estructura:

- `frontend/`: Aplicación cliente construida con **React, Vite y TypeScript**, diseñada para ofrecer una interfaz fluida e intuitiva tanto para los usuarios como para los administradores.
- `backend/`: API REST construida con **NestJS y TypeScript**, encargada de la lógica de negocio, integración con base de datos (Firebase), almacenamiento en la nube (AWS SDK) y pasarela de pagos (Wompi).

## 🚀 Tecnologías Principales

- **Frontend**: React 19, TypeScript, Vite, Mantine UI, React Big Calendar.
- **Backend**: NestJS, TypeScript, Firebase Admin (Auth/Firestore), AWS SDK, Wompi.

## 🛠️ Cómo Iniciar el Proyecto

Para levantar el proyecto en tu entorno local, necesitas tener instalado [Node.js](https://nodejs.org/). 

### 1. Iniciar el Backend
Ve a la carpeta del backend, instala las dependencias y corre el servidor de desarrollo:
```bash
cd backend
npm install
npm run start:dev
```
*Asegúrate de tener configurado tu archivo JSON de Firebase (`sured-883e9-firebase-adminsdk.json`) y las variables de entorno correspondientes.*

### 2. Iniciar el Frontend
En otra terminal, ve a la carpeta del frontend, instala las dependencias y arranca Vite:
```bash
cd frontend
npm install
npm run dev
```

## 📖 Documentación Detallada
Para más información técnica sobre cada entorno, consulta los README específicos:
- [Documentación del Frontend](./frontend/README.md)
- [Documentación del Backend](./backend/README.md)
