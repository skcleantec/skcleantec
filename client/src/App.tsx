import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/layout/AdminLayout';
import { TeamLayout } from './components/layout/TeamLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { TeamProtectedRoute } from './components/auth/TeamProtectedRoute';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminInquiriesPage } from './pages/admin/AdminInquiriesPage';
import { AdminSchedulePage } from './pages/admin/AdminSchedulePage';
import { AdminTeamLeadersPage } from './pages/admin/AdminTeamLeadersPage';
import { AdminMessagesPage } from './pages/admin/AdminMessagesPage';
import { AdminOrderFormPage } from './pages/admin/AdminOrderFormPage';
import { TeamLoginPage } from './pages/team/TeamLoginPage';
import { TeamDashboardPage } from './pages/team/TeamDashboardPage';
import { TeamMessagesPage } from './pages/team/TeamMessagesPage';
import { TeamDayOffsPage } from './pages/team/TeamDayOffsPage';
import { OrderFormPage } from './pages/order/OrderFormPage';
import { OrderInfoPage } from './pages/order/OrderInfoPage';
import { CsReportPage } from './pages/cs/CsReportPage';
import { AdminCsPage } from './pages/admin/AdminCsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="inquiries" element={<AdminInquiriesPage />} />
          <Route path="schedule" element={<AdminSchedulePage />} />
          <Route path="team-leaders" element={<AdminTeamLeadersPage />} />
          <Route path="messages" element={<AdminMessagesPage />} />
          <Route path="orderforms" element={<AdminOrderFormPage />} />
          <Route path="orderforms/notice" element={<Navigate to="/admin/orderforms?tab=notice" replace />} />
          <Route path="cs" element={<AdminCsPage />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
        <Route path="/order/:token" element={<OrderFormPage />} />
        <Route path="/info" element={<OrderInfoPage />} />
        <Route path="/cs" element={<CsReportPage />} />
        <Route path="/team/login" element={<TeamLoginPage />} />
        <Route
          path="/team"
          element={
            <TeamProtectedRoute>
              <TeamLayout />
            </TeamProtectedRoute>
          }
        >
          <Route path="dashboard" element={<TeamDashboardPage />} />
          <Route path="dayoffs" element={<TeamDayOffsPage />} />
          <Route path="messages" element={<TeamMessagesPage />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
