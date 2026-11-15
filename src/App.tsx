import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { BookPage } from './pages/BookPage';
import { BookingSuccessPage } from './pages/BookingSuccessPage';
import { HomePage } from './pages/HomePage';
import { SchedulePage } from './pages/SchedulePage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { VerifyPage } from './pages/VerifyPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminRegistrationsPage } from './pages/admin/AdminRegistrationsPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminSeatsPage } from './pages/admin/AdminSeatsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/book" element={<BookPage />} />
        <Route path="/booking/success" element={<BookingSuccessPage />} />
        <Route path="/ticket/:id" element={<TicketDetailPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/registrations" element={<AdminRegistrationsPage />} />
        <Route path="/admin/seats" element={<AdminSeatsPage />} />
        <Route path="/admin/reports" element={<AdminReportsPage />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
