import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/layout/AdminLayout';
import { TeamLayout } from './components/layout/TeamLayout';
import { CrewLayout } from './components/layout/CrewLayout';
import { FeatureGate } from './components/auth/FeatureGate';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { TeamProtectedRoute } from './components/auth/TeamProtectedRoute';
import { CrewProtectedRoute } from './components/auth/CrewProtectedRoute';
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
import { AdminOrderFormCustomerPreviewPage } from './pages/admin/AdminOrderFormCustomerPreviewPage';
import { TeamDashboardPage } from './pages/team/TeamDashboardPage';
import { TeamSchedulePage } from './pages/team/TeamSchedulePage';
import { TeamMessagesPage } from './pages/team/TeamMessagesPage';
import { TeamDayOffsPage } from './pages/team/TeamDayOffsPage';
import { TeamCsPage } from './pages/team/TeamCsPage';
import { TeamAssignmentListPage } from './pages/team/TeamAssignmentListPage';
import { TeamExternalSettlementPage } from './pages/team/TeamExternalSettlementPage';
import { TeamEContractListPage } from './pages/team/TeamEContractListPage';
import { OrderFormPage } from './pages/order/OrderFormPage';
import { OrderInfoPage } from './pages/order/OrderInfoPage';
import { CsReportPage } from './pages/cs/CsReportPage';
import { AdminCsPage } from './pages/admin/AdminCsPage';
import { AdminAdvertisingPage } from './pages/admin/AdminAdvertisingPage';
import { AdminAdvertisingSettingsPage } from './pages/admin/AdminAdvertisingSettingsPage';
import { AdminAdvertisingLayout } from './components/layout/AdminAdvertisingLayout';
import { AdminTeamsPage } from './pages/admin/AdminTeamsPage';
import { AdminTeamHolidayCalendarPage } from './pages/admin/AdminTeamHolidayCalendarPage';
import { AdminTeamLeaderStatsPage } from './pages/admin/AdminTeamLeaderStatsPage';
import { AdminExternalCompaniesPage } from './pages/admin/AdminExternalCompaniesPage';
import { AdminExternalSettlementPage } from './pages/admin/AdminExternalSettlementPage';
import { AdminPageSettingsPage } from './pages/admin/AdminPageSettingsPage';
import { AdminPayrollPage } from './pages/admin/AdminPayrollPage';
import { AdminEContractLayout } from './components/layout/AdminEContractLayout';
import { AdminEContractListPage } from './pages/admin/AdminEContractListPage';
import { AdminEContractDefinitionPage } from './pages/admin/AdminEContractDefinitionPage';
import { AdminEContractFieldSettingsPage } from './pages/admin/AdminEContractFieldSettingsPage';
import { AdminEContractIssuerProfilePage } from './pages/admin/AdminEContractIssuerProfilePage';
import { AdminEContractTeamOverviewPage } from './pages/admin/AdminEContractTeamOverviewPage';
import { EContractPublicSignPage } from './pages/public/EContractPublicSignPage';
import { CrewHomePage } from './pages/crew/CrewHomePage';
import { CrewRosterLayout } from './pages/crew/CrewRosterLayout';
import { CrewRosterCalendarPage } from './pages/crew/CrewRosterCalendarPage';
import { CrewRosterDayPage } from './pages/crew/CrewRosterDayPage';
import { CrewFieldSchedulePage } from './pages/crew/CrewFieldSchedulePage';
import { CrewSettingsPage } from './pages/crew/CrewSettingsPage';
import { CrewSettlementPage, CrewExpensesRedirect } from './pages/crew/CrewSettlementPage';
import { PlatformProtectedRoute } from './components/auth/PlatformProtectedRoute';
import { PlatformLayout } from './components/layout/PlatformLayout';
import { PlatformLoginPage } from './pages/platform/PlatformLoginPage';
import { PlatformTenantListPage } from './pages/platform/PlatformTenantListPage';
import { PlatformTenantCreatePage } from './pages/platform/PlatformTenantCreatePage';
import { PlatformTenantDetailPage } from './pages/platform/PlatformTenantDetailPage';

function App() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/platform/login" element={<PlatformLoginPage />} />
        <Route
          path="/platform"
          element={
            <PlatformProtectedRoute>
              <PlatformLayout />
            </PlatformProtectedRoute>
          }
        >
          <Route path="tenants" element={<PlatformTenantListPage />} />
          <Route path="tenants/new" element={<PlatformTenantCreatePage />} />
          <Route path="tenants/:id" element={<PlatformTenantDetailPage />} />
          <Route index element={<Navigate to="tenants" replace />} />
        </Route>
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
            <Route path="followup" element={<AdminOrderFormPage />} />
            <Route path="order-forms" element={<AdminOrderFormPage />} />
            <Route path="order-issue" element={<AdminOrderFormPage />} />
            <Route
              path="order-settings"
              element={<Navigate to="/admin/inquiries/order-customer-preview" replace />}
            />
            <Route path="order-customer-preview" element={<AdminOrderFormCustomerPreviewPage />} />
          </Route>
          <Route path="schedule" element={<AdminSchedulePage />} />
          <Route path="team-leaders" element={<AdminTeamLeadersLayout />}>
            <Route index element={<AdminTeamLeadersPage />} />
            <Route path="team-members" element={<AdminTeamsPage />} />
            <Route path="holiday-calendar" element={<AdminTeamHolidayCalendarPage />} />
            <Route path="leader-stats" element={<AdminTeamLeaderStatsPage />} />
            <Route path="page-settings" element={<AdminPageSettingsPage />} />
            <Route path="inquiry-delete" element={<AdminInquiryBulkDeletePage />} />
            <Route path="external-companies" element={<AdminExternalCompaniesPage />} />
            <Route path="external-settlement" element={<AdminExternalSettlementPage />} />
            <Route path="payroll" element={<FeatureGate module="mod_payroll"><AdminPayrollPage /></FeatureGate>} />
            <Route path="e-contracts" element={<FeatureGate module="mod_e_contract"><AdminEContractLayout /></FeatureGate>}>
              <Route index element={<AdminEContractListPage />} />
              <Route path="field-settings" element={<AdminEContractFieldSettingsPage />} />
              <Route path="issuer-profile" element={<AdminEContractIssuerProfilePage />} />
              <Route path="definition/:definitionId" element={<AdminEContractDefinitionPage />} />
              <Route path="overview" element={<AdminEContractTeamOverviewPage />} />
            </Route>
          </Route>
          <Route path="teams" element={<Navigate to="/admin/team-leaders/team-members" replace />} />
          <Route path="teams/holidays" element={<Navigate to="/admin/team-leaders/holiday-calendar" replace />} />
          <Route path="teams/leader-stats" element={<Navigate to="/admin/team-leaders/leader-stats" replace />} />
          <Route path="messages" element={<AdminMessagesPage />} />
          <Route path="orderforms" element={<Navigate to="/admin/inquiries/order-issue" replace />} />
          <Route path="orderforms/notice" element={<Navigate to="/admin/inquiries/order-customer-preview?panel=guide" replace />} />
          <Route path="orderforms/followup" element={<Navigate to="/admin/inquiries/followup" replace />} />
          <Route path="cs" element={<FeatureGate module="mod_cs"><AdminCsPage /></FeatureGate>} />
          <Route path="advertising" element={<FeatureGate module="mod_advertising"><AdminAdvertisingLayout /></FeatureGate>}>
            <Route index element={<AdminAdvertisingPage />} />
            <Route path="settings" element={<AdminAdvertisingSettingsPage />} />
          </Route>
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
        <Route path="/e-contract/sign/:token" element={<EContractPublicSignPage />} />
        <Route path="/order/:token" element={<OrderFormPage />} />
        <Route path="/info" element={<OrderInfoPage />} />
        <Route path="/cs" element={<CsReportPage />} />
        <Route path="/team/login" element={<Navigate to="/login" replace />} />
        <Route
          path="/crew"
          element={
            <CrewProtectedRoute>
              <CrewLayout />
            </CrewProtectedRoute>
          }
        >
          <Route index element={<CrewHomePage />} />
          <Route path="roster" element={<CrewRosterLayout />}>
            <Route index element={<CrewRosterCalendarPage />} />
            <Route path=":ymd" element={<CrewRosterDayPage />} />
          </Route>
          <Route path="schedule" element={<CrewFieldSchedulePage />} />
          <Route path="settlement" element={<CrewSettlementPage />} />
          <Route path="expenses" element={<CrewExpensesRedirect />} />
          <Route path="settings" element={<CrewSettingsPage />} />
        </Route>
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
          <Route path="settlement" element={<TeamExternalSettlementPage />} />
          <Route path="cs" element={<TeamCsPage />} />
          <Route path="messages" element={<TeamMessagesPage />} />
          <Route path="e-contracts" element={<TeamEContractListPage />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
    </div>
  );
}

export default App;
