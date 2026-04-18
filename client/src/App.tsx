import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/layout/AdminLayout';
import { TeamLayout } from './components/layout/TeamLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { TeamProtectedRoute } from './components/auth/TeamProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminInquiriesPage } from './pages/admin/AdminInquiriesPage';
import { AdminInquiriesLayout } from './components/layout/AdminInquiriesLayout';
import { AdminSchedulePage } from './pages/admin/AdminSchedulePage';
import { AdminTeamLeadersPage } from './pages/admin/AdminTeamLeadersPage';
import { AdminTeamLeadersLayout } from './components/layout/AdminTeamLeadersLayout';
import { AdminInquiryBulkDeletePage } from './pages/admin/AdminInquiryBulkDeletePage';
import { AdminMessagesPage } from './pages/admin/AdminMessagesPage';
import { AdminOrderFormPage } from './pages/admin/AdminOrderFormPage';
import { TeamDashboardPage } from './pages/team/TeamDashboardPage';
import { TeamSchedulePage } from './pages/team/TeamSchedulePage';
import { TeamMessagesPage } from './pages/team/TeamMessagesPage';
import { TeamDayOffsPage } from './pages/team/TeamDayOffsPage';
import { TeamCsPage } from './pages/team/TeamCsPage';
import { TeamAssignmentListPage } from './pages/team/TeamAssignmentListPage';
import { OrderFormPage } from './pages/order/OrderFormPage';
import { OrderInfoPage } from './pages/order/OrderInfoPage';
import { CsReportPage } from './pages/cs/CsReportPage';
import { AdminCsPage } from './pages/admin/AdminCsPage';
import { AdminAdvertisingPage } from './pages/admin/AdminAdvertisingPage';
import { AdminTeamsPage } from './pages/admin/AdminTeamsPage';
import { AdminTeamsLayout } from './components/layout/AdminTeamsLayout';
import { AdminTeamHolidayCalendarPage } from './pages/admin/AdminTeamHolidayCalendarPage';
import { AdminTeamLeaderStatsPage } from './pages/admin/AdminTeamLeaderStatsPage';
import { AdminExternalCompaniesPage } from './pages/admin/AdminExternalCompaniesPage';
import { AdminExternalSettlementPage } from './pages/admin/AdminExternalSettlementPage';
import { AdminPageSettingsPage } from './pages/admin/AdminPageSettingsPage';

function App() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="inquiries" element={<AdminInquiriesLayout />}>
            <Route index element={<AdminInquiriesPage />} />
            <Route path="order-forms" element={<AdminOrderFormPage />} />
          </Route>
          <Route path="schedule" element={<AdminSchedulePage />} />
          <Route path="team-leaders" element={<AdminTeamLeadersLayout />}>
            <Route index element={<AdminTeamLeadersPage />} />
            <Route path="page-settings" element={<AdminPageSettingsPage />} />
            <Route path="inquiry-delete" element={<AdminInquiryBulkDeletePage />} />
            <Route path="external-companies" element={<AdminExternalCompaniesPage />} />
            <Route path="external-settlement" element={<AdminExternalSettlementPage />} />
          </Route>
          <Route path="teams" element={<AdminTeamsLayout />}>
            <Route index element={<AdminTeamsPage />} />
            <Route path="holidays" element={<AdminTeamHolidayCalendarPage />} />
            <Route path="leader-stats" element={<AdminTeamLeaderStatsPage />} />
          </Route>
          <Route path="messages" element={<AdminMessagesPage />} />
          <Route path="orderforms" element={<AdminOrderFormPage />} />
          <Route path="orderforms/notice" element={<Navigate to="/admin/orderforms?tab=notice" replace />} />
          <Route path="cs" element={<AdminCsPage />} />
          <Route path="advertising" element={<AdminAdvertisingPage />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
        <Route path="/order/:token" element={<OrderFormPage />} />
        <Route path="/info" element={<OrderInfoPage />} />
        <Route path="/cs" element={<CsReportPage />} />
        <Route path="/team/login" element={<Navigate to="/login" replace />} />
        <Route
          path="/team"
          element={
            <TeamProtectedRoute>
              <TeamLayout />
            </TeamProtectedRoute>
          }
        >
          <Route path="dashboard" element={<TeamDashboardPage />} />
          <Route path="assignments" element={<TeamAssignmentListPage />} />
          <Route path="schedule" element={<TeamSchedulePage />} />
          <Route path="dayoffs" element={<TeamDayOffsPage />} />
          <Route path="cs" element={<TeamCsPage />} />
          <Route path="messages" element={<TeamMessagesPage />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
    </div>
  );
}

export default App;
