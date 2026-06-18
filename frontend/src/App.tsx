import { AppShell, Title } from '@mantine/core';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Home } from './Home';
import { BookingForm } from './BookingForm';
import { AssistedBookingForm } from './AssistedBookingForm';
import { AdminDashboard } from './AdminDashboard';
import { GridCalendarView } from './GridCalendarView';
import { BookingsCalendarView } from './BookingsCalendarView';
import { BigScreenView } from './BigScreenView';
import { UserBookingsView } from './UserBookingsView';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

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
    <AppShell header={{ height: 60 }}>
      <AppShell.Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
        <Title order={3} style={{ cursor: 'pointer', color: '#228be6' }} onClick={() => navigate('/')}>
          Led's on Renacer Photobooth
        </Title>
      </AppShell.Header>

      <AppShell.Main style={{ padding: '60px 0 0 0', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
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
