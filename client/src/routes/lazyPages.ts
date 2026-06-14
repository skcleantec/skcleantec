import { lazy } from 'react';

export const AdminDashboardPage = lazy(() =>
  import('../pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
export const AdminInquiriesPage = lazy(() =>
  import('../pages/admin/AdminInquiriesPage').then((m) => ({ default: m.AdminInquiriesPage }))
);
export const AdminSchedulePage = lazy(() =>
  import('../pages/admin/AdminSchedulePage').then((m) => ({ default: m.AdminSchedulePage }))
);
export const AdminTeamLeadersPage = lazy(() =>
  import('../pages/admin/AdminTeamLeadersPage').then((m) => ({ default: m.AdminTeamLeadersPage }))
);
export const AdminInquiryBulkDeletePage = lazy(() =>
  import('../pages/admin/AdminInquiryBulkDeletePage').then((m) => ({ default: m.AdminInquiryBulkDeletePage }))
);
export const AdminMessagesPage = lazy(() =>
  import('../pages/admin/AdminMessagesPage').then((m) => ({ default: m.AdminMessagesPage }))
);
export const AdminOrderFormPage = lazy(() =>
  import('../pages/admin/AdminOrderFormPage').then((m) => ({ default: m.AdminOrderFormPage }))
);
export const AdminOrderFormCustomerPreviewPage = lazy(() =>
  import('../pages/admin/AdminOrderFormCustomerPreviewPage').then((m) => ({
    default: m.AdminOrderFormCustomerPreviewPage,
  }))
);
export const AdminOrderFormTemplatesPage = lazy(() =>
  import('../pages/admin/AdminOrderFormTemplatesPage').then((m) => ({ default: m.AdminOrderFormTemplatesPage }))
);
export const TeamDashboardPage = lazy(() =>
  import('../pages/team/TeamDashboardPage').then((m) => ({ default: m.TeamDashboardPage }))
);
export const TeamSchedulePage = lazy(() =>
  import('../pages/team/TeamSchedulePage').then((m) => ({ default: m.TeamSchedulePage }))
);
export const TeamMessagesPage = lazy(() =>
  import('../pages/team/TeamMessagesPage').then((m) => ({ default: m.TeamMessagesPage }))
);
export const TeamDayOffsPage = lazy(() =>
  import('../pages/team/TeamDayOffsPage').then((m) => ({ default: m.TeamDayOffsPage }))
);
export const TeamCsPage = lazy(() =>
  import('../pages/team/TeamCsPage').then((m) => ({ default: m.TeamCsPage }))
);
export const TeamAssignmentListPage = lazy(() =>
  import('../pages/team/TeamAssignmentListPage').then((m) => ({ default: m.TeamAssignmentListPage }))
);
export const TeamInspectionPage = lazy(() =>
  import('../pages/team/TeamInspectionPage').then((m) => ({ default: m.TeamInspectionPage }))
);
export const TeamPreCleanPhotoPage = lazy(() =>
  import('../pages/team/TeamPreCleanPhotoPage').then((m) => ({ default: m.TeamPreCleanPhotoPage }))
);
export const TeamExternalSettlementPage = lazy(() =>
  import('../pages/team/TeamExternalSettlementPage').then((m) => ({ default: m.TeamExternalSettlementPage }))
);
export const TeamEContractListPage = lazy(() =>
  import('../pages/team/TeamEContractListPage').then((m) => ({ default: m.TeamEContractListPage }))
);
export const OrderFormPage = lazy(() =>
  import('../pages/order/OrderFormPage').then((m) => ({ default: m.OrderFormPage }))
);
export const OrderFormPrefillEditorPage = lazy(() =>
  import('../pages/order/OrderFormPage').then((m) => ({ default: m.OrderFormPrefillEditorPage }))
);
export const OrderInfoPage = lazy(() =>
  import('../pages/order/OrderInfoPage').then((m) => ({ default: m.OrderInfoPage }))
);
export const CsReportPage = lazy(() =>
  import('../pages/cs/CsReportPage').then((m) => ({ default: m.CsReportPage }))
);
export const ReviewPaybackPage = lazy(() =>
  import('../pages/review-payback/ReviewPaybackPage').then((m) => ({ default: m.ReviewPaybackPage }))
);
export const AdminReviewPaybackPage = lazy(() =>
  import('../pages/admin/AdminReviewPaybackPage').then((m) => ({ default: m.AdminReviewPaybackPage }))
);
export const AdminCsPage = lazy(() =>
  import('../pages/admin/AdminCsPage').then((m) => ({ default: m.AdminCsPage }))
);
export const AdminAdvertisingPage = lazy(() =>
  import('../pages/admin/AdminAdvertisingPage').then((m) => ({ default: m.AdminAdvertisingPage }))
);
export const AdminAdvertisingSettingsPage = lazy(() =>
  import('../pages/admin/AdminAdvertisingSettingsPage').then((m) => ({ default: m.AdminAdvertisingSettingsPage }))
);
export const AdminTeamsPage = lazy(() =>
  import('../pages/admin/AdminTeamsPage').then((m) => ({ default: m.AdminTeamsPage }))
);
export const AdminTeamHolidayCalendarPage = lazy(() =>
  import('../pages/admin/AdminTeamHolidayCalendarPage').then((m) => ({ default: m.AdminTeamHolidayCalendarPage }))
);
export const AdminTeamLeaderStatsPage = lazy(() =>
  import('../pages/admin/AdminTeamLeaderStatsPage').then((m) => ({ default: m.AdminTeamLeaderStatsPage }))
);
export const AdminExternalCompaniesPage = lazy(() =>
  import('../pages/admin/AdminExternalCompaniesPage').then((m) => ({ default: m.AdminExternalCompaniesPage }))
);
export const AdminTenantPartnersPage = lazy(() =>
  import('../pages/admin/AdminTenantPartnersPage').then((m) => ({ default: m.AdminTenantPartnersPage }))
);
export const AdminTenantPartnerSettlementPage = lazy(() =>
  import('../pages/admin/AdminTenantPartnerSettlementPage').then((m) => ({
    default: m.AdminTenantPartnerSettlementPage,
  }))
);
export const AdminOperatingCompaniesPage = lazy(() =>
  import('../pages/admin/AdminOperatingCompaniesPage').then((m) => ({ default: m.AdminOperatingCompaniesPage }))
);
export const AdminOperatingCompanyPolicyPage = lazy(() =>
  import('../pages/admin/AdminOperatingCompanyPolicyPage').then((m) => ({
    default: m.AdminOperatingCompanyPolicyPage,
  }))
);
export const AdminExternalSettlementPage = lazy(() =>
  import('../pages/admin/AdminExternalSettlementPage').then((m) => ({ default: m.AdminExternalSettlementPage }))
);
export const AdminPageSettingsPage = lazy(() =>
  import('../pages/admin/AdminPageSettingsPage').then((m) => ({ default: m.AdminPageSettingsPage }))
);
export const AdminPayrollPage = lazy(() =>
  import('../pages/admin/AdminPayrollPage').then((m) => ({ default: m.AdminPayrollPage }))
);
export const AdminEContractListPage = lazy(() =>
  import('../pages/admin/AdminEContractListPage').then((m) => ({ default: m.AdminEContractListPage }))
);
export const AdminEContractDefinitionPage = lazy(() =>
  import('../pages/admin/AdminEContractDefinitionPage').then((m) => ({ default: m.AdminEContractDefinitionPage }))
);
export const AdminEContractFieldSettingsPage = lazy(() =>
  import('../pages/admin/AdminEContractFieldSettingsPage').then((m) => ({
    default: m.AdminEContractFieldSettingsPage,
  }))
);
export const AdminEContractIssuerProfilePage = lazy(() =>
  import('../pages/admin/AdminEContractIssuerProfilePage').then((m) => ({
    default: m.AdminEContractIssuerProfilePage,
  }))
);
export const AdminEContractTeamOverviewPage = lazy(() =>
  import('../pages/admin/AdminEContractTeamOverviewPage').then((m) => ({
    default: m.AdminEContractTeamOverviewPage,
  }))
);
export const EContractPublicSignPage = lazy(() =>
  import('../pages/public/EContractPublicSignPage').then((m) => ({ default: m.EContractPublicSignPage }))
);
export const CrewHomePage = lazy(() =>
  import('../pages/crew/CrewHomePage').then((m) => ({ default: m.CrewHomePage }))
);
export const CrewRosterCalendarPage = lazy(() =>
  import('../pages/crew/CrewRosterCalendarPage').then((m) => ({ default: m.CrewRosterCalendarPage }))
);
export const CrewRosterDayPage = lazy(() =>
  import('../pages/crew/CrewRosterDayPage').then((m) => ({ default: m.CrewRosterDayPage }))
);
export const CrewFieldSchedulePage = lazy(() =>
  import('../pages/crew/CrewFieldSchedulePage').then((m) => ({ default: m.CrewFieldSchedulePage }))
);
export const CrewSettingsPage = lazy(() =>
  import('../pages/crew/CrewSettingsPage').then((m) => ({ default: m.CrewSettingsPage }))
);
export const CrewSettlementPage = lazy(() =>
  import('../pages/crew/CrewSettlementPage').then((m) => ({ default: m.CrewSettlementPage }))
);
export const CrewExpensesRedirect = lazy(() =>
  import('../pages/crew/CrewSettlementPage').then((m) => ({ default: m.CrewExpensesRedirect }))
);
export const PlatformTenantListPage = lazy(() =>
  import('../pages/platform/PlatformTenantListPage').then((m) => ({ default: m.PlatformTenantListPage }))
);
export const PlatformTenantCreatePage = lazy(() =>
  import('../pages/platform/PlatformTenantCreatePage').then((m) => ({ default: m.PlatformTenantCreatePage }))
);
export const PlatformTenantDetailPage = lazy(() =>
  import('../pages/platform/PlatformTenantDetailPage').then((m) => ({ default: m.PlatformTenantDetailPage }))
);
