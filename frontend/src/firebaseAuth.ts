import axios from 'axios';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { API_BASE_URL } from './config';

// Autenticación del panel (admin) y de la Reserva Asistida (vendedor) con
// Firebase Auth. El rol viene del custom claim `role` del usuario, que se
// asigna con backend/scripts/set-user-role.ts. La config web de Firebase no es
// secreta (va igual en cualquier app web); se puede sobreescribir por .env.
const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAe-z1T2gjCeT5FP0JY_rdt4kkv9m49tGc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'sured-883e9.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sured-883e9',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:702599304678:web:e6974c1f7784aed1fe3227',
});
export const auth = getAuth(firebaseApp);

export type Role = 'admin' | 'vendedor';

// Todas las vistas usan la instancia global de axios, así que el token se
// agrega acá una sola vez. Solo a peticiones al backend propio — nunca a APIs
// de terceros (ej. countriesnow.space en los formularios).
axios.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user && config.url?.startsWith(API_BASE_URL)) {
    config.headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  return config;
});
