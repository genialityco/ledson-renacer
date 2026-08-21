import { lazy, Suspense } from 'react';
import { AppShell, Group, Text, Center, Loader } from '@mantine/core';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './i18n';
import './graffiti.css';
import './ledson-clean.css';

// Cada vista carga en su propio chunk (en vez de ir todas en un solo bundle
// de ~2MB) — así quien visita /booking no descarga three.js/@react-three
// (solo lo usa /screen) ni react-big-calendar (solo lo usan las vistas de
// /admin/grid y /admin/bookings-calendar).
const Home = lazy(() => import('./Home').then((m) => ({ default: m.Home })));
const BookingForm = lazy(() => import('./BookingForm').then((m) => ({ default: m.BookingForm })));
const AssistedBookingForm = lazy(() => import('./AssistedBookingForm').then((m) => ({ default: m.AssistedBookingForm })));
const AdminDashboard = lazy(() => import('./AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const GridCalendarView = lazy(() => import('./GridCalendarView').then((m) => ({ default: m.GridCalendarView })));
const BookingsCalendarView = lazy(() => import('./BookingsCalendarView').then((m) => ({ default: m.BookingsCalendarView })));
const BigScreenView = lazy(() => import('./BigScreenView').then((m) => ({ default: m.BigScreenView })));
const UserBookingsView = lazy(() => import('./UserBookingsView').then((m) => ({ default: m.UserBookingsView })));

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, toggleLanguage } = useLanguage();

  // Si estamos en la ruta de la pantalla gigante, no mostramos absolutamente nada del layout base.
  const isBigScreen = location.pathname === '/screen';

  if (isBigScreen) {
    return (
      <Suspense fallback={<div style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }} />}>
        <Routes>
          <Route path="/screen" element={<BigScreenView />} />
        </Routes>
      </Suspense>
    );
  }

  // Si estamos en la vista pública normal, no mostramos el AppShell con menú lateral.
  return (
    <AppShell >
  <AppShell.Header className="ledson-header">
    <Group gap={6} className="ledson-logo-group" onClick={() => navigate('/')}>
      <img src="/logo-leds-on.png" alt="Led's On" className="ledson-logo-img" />
    </Group>
    <Group gap={8} className="ledson-lang">
      <Text component="span" className="ledson-lang-label" data-active={language === 'es'}>ES</Text>
      <button
        type="button"
        className="ledson-lang-track"
        data-lang={language}
        onClick={toggleLanguage}
        aria-label="Cambiar idioma"
      >
        <span className="ledson-lang-thumb" />
      </button>
      <Text component="span" className="ledson-lang-label" data-active={language === 'en'}>EN</Text>
    </Group>
  </AppShell.Header>

      <AppShell.Main style={{ backgroundColor: '#f8f9fa', minHeight: 'calc(100vh - var(--ledson-header-h) - var(--ledson-footer-h))' }}>
        <Suspense fallback={<Center style={{ minHeight: '60vh' }}><Loader color="blue" /></Center>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/booking" element={<BookingForm />} />
            <Route path="/assisted-booking" element={<AssistedBookingForm />} />
            <Route path="/my-bookings" element={<UserBookingsView />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/grid" element={<GridCalendarView />} />
            <Route path="/admin/bookings-calendar" element={<BookingsCalendarView />} />
          </Routes>
        </Suspense>
      </AppShell.Main>

      <AppShell.Footer className="ledson-footer">
        <Text className="ledson-footer-text">{new Date().getFullYear()} © LED'S ON</Text>
      </AppShell.Footer>
    </AppShell>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
