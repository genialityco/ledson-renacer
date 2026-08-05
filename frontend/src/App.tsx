import { AppShell, Title, Group, Text } from '@mantine/core';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Home } from './Home';
import { BookingForm } from './BookingForm';
import { AssistedBookingForm } from './AssistedBookingForm';
import { AdminDashboard } from './AdminDashboard';
import { GridCalendarView } from './GridCalendarView';
import { BookingsCalendarView } from './BookingsCalendarView';
import { BigScreenView } from './BigScreenView';
import { UserBookingsView } from './UserBookingsView';
import { LanguageProvider, useLanguage } from './i18n';
import './graffiti.css';
import './ledson-clean.css';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, toggleLanguage } = useLanguage();

  // Si estamos en la ruta de la pantalla gigante, no mostramos absolutamente nada del layout base.
  const isBigScreen = location.pathname === '/screen';

  if (isBigScreen) {
    return (
      <Routes>
        <Route path="/screen" element={<BigScreenView />} />
      </Routes>
    );
  }

  // Si estamos en la vista pública normal, no mostramos el AppShell con menú lateral.
  return (
    <AppShell >
  <AppShell.Header className="ledson-header">
    <Group gap={6} className="ledson-logo-group" onClick={() => navigate('/')}>
      <span className="ledson-logo-icon" />
      <Title order={3} className="ledson-logo">
        led's<span className="ledson-logo-thin">on</span>
      </Title>
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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/booking" element={<BookingForm />} />
          <Route path="/assisted-booking" element={<AssistedBookingForm />} />
          <Route path="/my-bookings" element={<UserBookingsView />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/grid" element={<GridCalendarView />} />
          <Route path="/admin/bookings-calendar" element={<BookingsCalendarView />} />
        </Routes>
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
