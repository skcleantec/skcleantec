import { Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/layout/AdminLayout';
import { TeamLayout } from './components/layout/TeamLayout';
import { CrewLayout } from './components/layout/CrewLayout';
import { FeatureGate } from './components/auth/FeatureGate';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { TeamProtectedRoute } from './components/auth/TeamProtectedRoute';
import { CrewProtectedRoute } from './components/auth/CrewProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AdminInquiriesLayout } from './components/layout/AdminInquiriesLayout';
import { AdminTeamLeadersLayout } from './components/layout/AdminTeamLeadersLayout';
import { AdminAdvertisingLayout } from './components/layout/AdminAdvertisingLayout';
import { AdminEContractLayout } from './components/layout/AdminEContractLayout';
import { CrewRosterLayout } from './pages/crew/CrewRosterLayout';
import { PlatformProtectedRoute } from './components/auth/PlatformProtectedRoute';
import { PlatformLayout } from './components/layout/PlatformLayout';
import { PlatformLoginPage } from './pages/platform/PlatformLoginPage';
import { RoutePageFallback } from './components/ui/RoutePageFallback';
import {
  AdminDashboardPage,
  AdminInquiriesPage,
  AdminSchedulePage,
  AdminServiceZonesPage,
  AdminTeamLeadersPage,
  AdminInquiryBulkDeletePage,
  AdminMessagesPage,
  AdminOrderFormPage,
  AdminOrderFormCustomerPreviewPage,
  AdminOrderFormTemplatesPage,
  AdminQuotationsListPage,
  AdminQuotationEditorPage,
  AdminQuotationSettingsPage,
  TeamDashboardPage,
  TeamSchedulePage,
  TeamMessagesPage,
  TeamDayOffsPage,
  TeamCsPage,
  TeamAssignmentListPage,
  TeamInspectionPage,
  TeamPreCleanPhotoPage,
  TeamPostCleanPhotoPage,
  TeamExternalSettlementPage,
  TeamEContractListPage,
  OrderFormPage,
  OrderFormPrefillEditorPage,
  OrderInfoPage,
  CsReportPage,
  ReviewPaybackPage,
  InspectionCustomerViewPage,
  AdminReviewPaybackPage,
  AdminCsPage,
  AdminAdvertisingPage,
  AdminAdvertisingSettingsPage,
  AdminTeamsPage,
  AdminTeamHolidayCalendarPage,
  AdminTeamLeaderStatsPage,
  AdminExternalCompaniesPage,
  AdminTenantPartnersPage,
  AdminTenantPartnerSettlementPage,
  AdminOperatingCompaniesPage,
  AdminTenantCompanyBusinessPage,
  AdminTenantCompanyOutboundEmailPage,
  AdminOperatingCompanyPolicyPage,
  AdminExternalSettlementPage,
  AdminPageSettingsPage,
  AdminInspectionTemplatePage,
  AdminPayrollPage,
  AdminEContractListPage,
  AdminEContractDefinitionPage,
  AdminEContractFieldSettingsPage,
  AdminEContractIssuerProfilePage,
  AdminEContractTeamOverviewPage,
  EContractPublicSignPage,
  CrewHomePage,
  CrewRosterCalendarPage,
  CrewRosterDayPage,
  CrewFieldSchedulePage,
  CrewSettingsPage,
  CrewSettlementPage,
  CrewExpensesRedirect,
  PlatformTenantListPage,
  PlatformTenantCreatePage,
  PlatformTenantDetailPage,
  PlatformSupportAccessPage,
  HelpPage,
} from './routes/lazyPages';

function SuspensePage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RoutePageFallback />}>{children}</Suspense>;
}

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
          <Route path="tenants" element={<SuspensePage><PlatformTenantListPage /></SuspensePage>} />
          <Route path="tenants/new" element={<SuspensePage><PlatformTenantCreatePage /></SuspensePage>} />
          <Route path="tenants/:id" element={<SuspensePage><PlatformTenantDetailPage /></SuspensePage>} />
          <Route path="support-access" element={<SuspensePage><PlatformSupportAccessPage /></SuspensePage>} />
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
          <Route path="dashboard" element={<SuspensePage><AdminDashboardPage /></SuspensePage>} />
          <Route path="inquiries" element={<AdminInquiriesLayout />}>
            <Route index element={<SuspensePage><AdminInquiriesPage /></SuspensePage>} />
            <Route path="followup" element={<SuspensePage><AdminOrderFormPage /></SuspensePage>} />
            <Route path="review-payback" element={<SuspensePage><AdminReviewPaybackPage /></SuspensePage>} />
            <Route path="order-forms" element={<SuspensePage><AdminOrderFormPage /></SuspensePage>} />
            <Route path="order-issue" element={<SuspensePage><AdminOrderFormPage /></SuspensePage>} />
            <Route
              path="order-settings"
              element={<Navigate to="/admin/inquiries/order-customer-preview" replace />}
            />
            <Route path="order-templates" element={<SuspensePage><AdminOrderFormTemplatesPage /></SuspensePage>} />
            <Route path="order-customer-preview" element={<SuspensePage><AdminOrderFormCustomerPreviewPage /></SuspensePage>} />
            <Route path="quotations" element={<SuspensePage><AdminQuotationsListPage /></SuspensePage>} />
            <Route path="quotations/new" element={<SuspensePage><AdminQuotationEditorPage /></SuspensePage>} />
            <Route path="quotations/settings" element={<SuspensePage><AdminQuotationSettingsPage /></SuspensePage>} />
            <Route path="quotations/:id" element={<SuspensePage><AdminQuotationEditorPage /></SuspensePage>} />
          </Route>
          <Route path="schedule" element={<SuspensePage><AdminSchedulePage /></SuspensePage>} />
          <Route path="service-zones" element={<SuspensePage><AdminServiceZonesPage /></SuspensePage>} />
          <Route path="team-leaders" element={<AdminTeamLeadersLayout />}>
            <Route index element={<SuspensePage><AdminTeamLeadersPage /></SuspensePage>} />
            <Route path="team-members" element={<SuspensePage><AdminTeamsPage /></SuspensePage>} />
            <Route path="holiday-calendar" element={<SuspensePage><AdminTeamHolidayCalendarPage /></SuspensePage>} />
            <Route path="leader-stats" element={<SuspensePage><AdminTeamLeaderStatsPage /></SuspensePage>} />
            <Route path="page-settings" element={<SuspensePage><AdminPageSettingsPage /></SuspensePage>} />
            <Route path="inquiry-delete" element={<SuspensePage><AdminInquiryBulkDeletePage /></SuspensePage>} />
            <Route path="operating-companies" element={<SuspensePage><AdminOperatingCompaniesPage /></SuspensePage>} />
            <Route path="company-profile" element={<Navigate to="company-profile/business" replace />} />
            <Route
              path="company-profile/business"
              element={<SuspensePage><AdminTenantCompanyBusinessPage /></SuspensePage>}
            />
            <Route
              path="company-profile/outbound-email"
              element={<SuspensePage><AdminTenantCompanyOutboundEmailPage /></SuspensePage>}
            />
            <Route path="operating-policy" element={<SuspensePage><AdminOperatingCompanyPolicyPage /></SuspensePage>} />
            <Route
              path="inspection-template"
              element={
                <FeatureGate module="mod_inspection">
                  <SuspensePage><AdminInspectionTemplatePage /></SuspensePage>
                </FeatureGate>
              }
            />
            <Route path="external-companies" element={<SuspensePage><AdminExternalCompaniesPage /></SuspensePage>} />
            <Route
              path="tenant-partners"
              element={
                <FeatureGate module="mod_tenant_exchange">
                  <SuspensePage><AdminTenantPartnersPage /></SuspensePage>
                </FeatureGate>
              }
            />
            <Route
              path="tenant-partner-settlement"
              element={
                <FeatureGate module="mod_tenant_exchange">
                  <SuspensePage><AdminTenantPartnerSettlementPage /></SuspensePage>
                </FeatureGate>
              }
            />
            <Route path="external-settlement" element={<SuspensePage><AdminExternalSettlementPage /></SuspensePage>} />
            <Route path="payroll" element={<FeatureGate module="mod_payroll"><SuspensePage><AdminPayrollPage /></SuspensePage></FeatureGate>} />
            <Route path="e-contracts" element={<FeatureGate module="mod_e_contract"><AdminEContractLayout /></FeatureGate>}>
              <Route index element={<SuspensePage><AdminEContractListPage /></SuspensePage>} />
              <Route path="field-settings" element={<SuspensePage><AdminEContractFieldSettingsPage /></SuspensePage>} />
              <Route path="issuer-profile" element={<SuspensePage><AdminEContractIssuerProfilePage /></SuspensePage>} />
              <Route path="definition/:definitionId" element={<SuspensePage><AdminEContractDefinitionPage /></SuspensePage>} />
              <Route path="overview" element={<SuspensePage><AdminEContractTeamOverviewPage /></SuspensePage>} />
            </Route>
          </Route>
          <Route path="teams" element={<Navigate to="/admin/team-leaders/team-members" replace />} />
          <Route path="teams/holidays" element={<Navigate to="/admin/team-leaders/holiday-calendar" replace />} />
          <Route path="teams/leader-stats" element={<Navigate to="/admin/team-leaders/leader-stats" replace />} />
          <Route path="messages" element={<SuspensePage><AdminMessagesPage /></SuspensePage>} />
          <Route path="orderforms" element={<Navigate to="/admin/inquiries/order-issue" replace />} />
          <Route path="orderforms/notice" element={<Navigate to="/admin/inquiries/order-customer-preview?panel=guide" replace />} />
          <Route path="orderforms/followup" element={<Navigate to="/admin/inquiries/followup" replace />} />
          <Route path="cs" element={<FeatureGate module="mod_cs"><SuspensePage><AdminCsPage /></SuspensePage></FeatureGate>} />
          <Route path="advertising" element={<FeatureGate module="mod_advertising"><AdminAdvertisingLayout /></FeatureGate>}>
            <Route index element={<SuspensePage><AdminAdvertisingPage /></SuspensePage>} />
            <Route path="settings" element={<SuspensePage><AdminAdvertisingSettingsPage /></SuspensePage>} />
          </Route>
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
        <Route path="/e-contract/sign/:token" element={<SuspensePage><EContractPublicSignPage /></SuspensePage>} />
        <Route
          path="/admin/order-prefill/:orderFormId"
          element={
            <ProtectedRoute>
              <SuspensePage><OrderFormPrefillEditorPage /></SuspensePage>
            </ProtectedRoute>
          }
        />
        <Route path="/order/:token" element={<SuspensePage><OrderFormPage /></SuspensePage>} />
        <Route path="/info" element={<SuspensePage><OrderInfoPage /></SuspensePage>} />
        <Route path="/help" element={<SuspensePage><HelpPage /></SuspensePage>} />
        <Route path="/cs" element={<SuspensePage><CsReportPage /></SuspensePage>} />
        <Route path="/review-payback/:token" element={<SuspensePage><ReviewPaybackPage /></SuspensePage>} />
        <Route path="/inspection/:token" element={<SuspensePage><InspectionCustomerViewPage /></SuspensePage>} />
        <Route path="/team/login" element={<Navigate to="/login" replace />} />
        <Route
          path="/crew"
          element={
            <CrewProtectedRoute>
              <CrewLayout />
            </CrewProtectedRoute>
          }
        >
          <Route index element={<SuspensePage><CrewHomePage /></SuspensePage>} />
          <Route path="roster" element={<CrewRosterLayout />}>
            <Route index element={<SuspensePage><CrewRosterCalendarPage /></SuspensePage>} />
            <Route path=":ymd" element={<SuspensePage><CrewRosterDayPage /></SuspensePage>} />
          </Route>
          <Route path="schedule" element={<SuspensePage><CrewFieldSchedulePage /></SuspensePage>} />
          <Route path="settlement" element={<SuspensePage><CrewSettlementPage /></SuspensePage>} />
          <Route path="expenses" element={<SuspensePage><CrewExpensesRedirect /></SuspensePage>} />
          <Route path="settings" element={<SuspensePage><CrewSettingsPage /></SuspensePage>} />
        </Route>
        <Route
          path="/team"
          element={
            <TeamProtectedRoute>
              <TeamLayout />
            </TeamProtectedRoute>
          }
        >
          <Route path="dashboard" element={<SuspensePage><TeamDashboardPage /></SuspensePage>} />
          <Route path="assignments" element={<SuspensePage><TeamAssignmentListPage /></SuspensePage>} />
          <Route path="pre-clean/:inquiryId" element={<FeatureGate module="mod_inspection" redirectTo="/team/dashboard"><SuspensePage><TeamPreCleanPhotoPage /></SuspensePage></FeatureGate>} />
          <Route path="post-clean/:inquiryId" element={<FeatureGate module="mod_inspection" redirectTo="/team/dashboard"><SuspensePage><TeamPostCleanPhotoPage /></SuspensePage></FeatureGate>} />
          <Route path="inspection/:inquiryId" element={<FeatureGate module="mod_inspection" redirectTo="/team/dashboard"><SuspensePage><TeamInspectionPage /></SuspensePage></FeatureGate>} />
          <Route path="schedule" element={<SuspensePage><TeamSchedulePage /></SuspensePage>} />
          <Route path="dayoffs" element={<SuspensePage><TeamDayOffsPage /></SuspensePage>} />
          <Route path="settlement" element={<SuspensePage><TeamExternalSettlementPage /></SuspensePage>} />
          <Route path="cs" element={<SuspensePage><TeamCsPage /></SuspensePage>} />
          <Route path="messages" element={<SuspensePage><TeamMessagesPage /></SuspensePage>} />
          <Route path="e-contracts" element={<SuspensePage><TeamEContractListPage /></SuspensePage>} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
    </div>
  );
}

export default App;
