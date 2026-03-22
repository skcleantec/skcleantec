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
import { TeamLoginPage } from './pages/team/TeamLoginPage';
import { TeamDashboardPage } from './pages/team/TeamDashboardPage';
import { TeamMessagesPage } from './pages/team/TeamMessagesPage';

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
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
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
          <Route path="messages" element={<TeamMessagesPage />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
