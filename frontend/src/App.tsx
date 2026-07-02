import { AppShell, Title, Switch, Group } from '@mantine/core';
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

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, toggleLanguage, t } = useLanguage();

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
  <AppShell.Header className="graffiti-header">
    <Title order={3} className="graffiti-logo" onClick={() => navigate('/')}>
      {t('appTitle')}
    </Title>
    <Group>
      <Switch
        className="graffiti-switch"
        size="md"
        onLabel="EN"
        offLabel="ES"
        checked={language === 'en'}
        onChange={toggleLanguage}
      />
    </Group>
  </AppShell.Header>

      <AppShell.Main style={{  backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
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
