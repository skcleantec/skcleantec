import { lazyWithRetry } from '../utils/lazyWithRetry';

export const AdminDashboardPage = lazyWithRetry(() =>
  import('../pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
export const AdminInquiriesPage = lazyWithRetry(() =>
  import('../pages/admin/AdminInquiriesPage').then((m) => ({ default: m.AdminInquiriesPage }))
);
export const AdminSchedulePage = lazyWithRetry(() =>
  import('../pages/admin/AdminSchedulePage').then((m) => ({ default: m.AdminSchedulePage }))
);
export const AdminTeamLeadersPage = lazyWithRetry(() =>
  import('../pages/admin/AdminTeamLeadersPage').then((m) => ({ default: m.AdminTeamLeadersPage }))
);
export const AdminInquiryBulkDeletePage = lazyWithRetry(() =>
  import('../pages/admin/AdminInquiryBulkDeletePage').then((m) => ({ default: m.AdminInquiryBulkDeletePage }))
);
export const AdminMessagesPage = lazyWithRetry(() =>
  import('../pages/admin/AdminMessagesPage').then((m) => ({ default: m.AdminMessagesPage }))
);
export const AdminOrderFormPage = lazyWithRetry(() =>
  import('../pages/admin/AdminOrderFormPage').then((m) => ({ default: m.AdminOrderFormPage }))
);
export const AdminOrderFormCustomerPreviewPage = lazyWithRetry(() =>
  import('../pages/admin/AdminOrderFormCustomerPreviewPage').then((m) => ({
    default: m.AdminOrderFormCustomerPreviewPage,
  }))
);
export const AdminOrderFormTemplatesPage = lazyWithRetry(() =>
  import('../pages/admin/AdminOrderFormTemplatesPage').then((m) => ({ default: m.AdminOrderFormTemplatesPage }))
);
export const TeamDashboardPage = lazyWithRetry(() =>
  import('../pages/team/TeamDashboardPage').then((m) => ({ default: m.TeamDashboardPage }))
);
export const TeamSchedulePage = lazyWithRetry(() =>
  import('../pages/team/TeamSchedulePage').then((m) => ({ default: m.TeamSchedulePage }))
);
export const TeamMessagesPage = lazyWithRetry(() =>
  import('../pages/team/TeamMessagesPage').then((m) => ({ default: m.TeamMessagesPage }))
);
export const TeamDayOffsPage = lazyWithRetry(() =>
  import('../pages/team/TeamDayOffsPage').then((m) => ({ default: m.TeamDayOffsPage }))
);
export const TeamCsPage = lazyWithRetry(() =>
  import('../pages/team/TeamCsPage').then((m) => ({ default: m.TeamCsPage }))
);
export const TeamAssignmentListPage = lazyWithRetry(() =>
  import('../pages/team/TeamAssignmentListPage').then((m) => ({ default: m.TeamAssignmentListPage }))
);
export const TeamInspectionPage = lazyWithRetry(() =>
  import('../pages/team/TeamInspectionPage').then((m) => ({ default: m.TeamInspectionPage }))
);
export const TeamPreCleanPhotoPage = lazyWithRetry(() =>
  import('../pages/team/TeamPreCleanPhotoPage').then((m) => ({ default: m.TeamPreCleanPhotoPage }))
);
export const TeamExternalSettlementPage = lazyWithRetry(() =>
  import('../pages/team/TeamExternalSettlementPage').then((m) => ({ default: m.TeamExternalSettlementPage }))
);
export const TeamEContractListPage = lazyWithRetry(() =>
  import('../pages/team/TeamEContractListPage').then((m) => ({ default: m.TeamEContractListPage }))
);
export const OrderFormPage = lazyWithRetry(() =>
  import('../pages/order/OrderFormPage').then((m) => ({ default: m.OrderFormPage }))
);
export const OrderFormPrefillEditorPage = lazyWithRetry(() =>
  import('../pages/order/OrderFormPage').then((m) => ({ default: m.OrderFormPrefillEditorPage }))
);
export const OrderInfoPage = lazyWithRetry(() =>
  import('../pages/order/OrderInfoPage').then((m) => ({ default: m.OrderInfoPage }))
);
export const CsReportPage = lazyWithRetry(() =>
  import('../pages/cs/CsReportPage').then((m) => ({ default: m.CsReportPage }))
);
export const ReviewPaybackPage = lazyWithRetry(() =>
  import('../pages/review-payback/ReviewPaybackPage').then((m) => ({ default: m.ReviewPaybackPage }))
);
export const InspectionCustomerViewPage = lazyWithRetry(() =>
  import('../pages/inspection/InspectionCustomerViewPage').then((m) => ({
    default: m.InspectionCustomerViewPage,
  }))
);
export const AdminReviewPaybackPage = lazyWithRetry(() =>
  import('../pages/admin/AdminReviewPaybackPage').then((m) => ({ default: m.AdminReviewPaybackPage }))
);
export const AdminCsPage = lazyWithRetry(() =>
  import('../pages/admin/AdminCsPage').then((m) => ({ default: m.AdminCsPage }))
);
export const AdminAdvertisingPage = lazyWithRetry(() =>
  import('../pages/admin/AdminAdvertisingPage').then((m) => ({ default: m.AdminAdvertisingPage }))
);
export const AdminAdvertisingSettingsPage = lazyWithRetry(() =>
  import('../pages/admin/AdminAdvertisingSettingsPage').then((m) => ({ default: m.AdminAdvertisingSettingsPage }))
);
export const AdminTeamsPage = lazyWithRetry(() =>
  import('../pages/admin/AdminTeamsPage').then((m) => ({ default: m.AdminTeamsPage }))
);
export const AdminTeamHolidayCalendarPage = lazyWithRetry(() =>
  import('../pages/admin/AdminTeamHolidayCalendarPage').then((m) => ({ default: m.AdminTeamHolidayCalendarPage }))
);
export const AdminTeamLeaderStatsPage = lazyWithRetry(() =>
  import('../pages/admin/AdminTeamLeaderStatsPage').then((m) => ({ default: m.AdminTeamLeaderStatsPage }))
);
export const AdminExternalCompaniesPage = lazyWithRetry(() =>
  import('../pages/admin/AdminExternalCompaniesPage').then((m) => ({ default: m.AdminExternalCompaniesPage }))
);
export const AdminTenantPartnersPage = lazyWithRetry(() =>
  import('../pages/admin/AdminTenantPartnersPage').then((m) => ({ default: m.AdminTenantPartnersPage }))
);
export const AdminTenantPartnerSettlementPage = lazyWithRetry(() =>
  import('../pages/admin/AdminTenantPartnerSettlementPage').then((m) => ({
    default: m.AdminTenantPartnerSettlementPage,
  }))
);
export const AdminOperatingCompaniesPage = lazyWithRetry(() =>
  import('../pages/admin/AdminOperatingCompaniesPage').then((m) => ({ default: m.AdminOperatingCompaniesPage }))
);
export const AdminOperatingCompanyPolicyPage = lazyWithRetry(() =>
  import('../pages/admin/AdminOperatingCompanyPolicyPage').then((m) => ({
    default: m.AdminOperatingCompanyPolicyPage,
  }))
);
export const AdminExternalSettlementPage = lazyWithRetry(() =>
  import('../pages/admin/AdminExternalSettlementPage').then((m) => ({ default: m.AdminExternalSettlementPage }))
);
export const AdminPageSettingsPage = lazyWithRetry(() =>
  import('../pages/admin/AdminPageSettingsPage').then((m) => ({ default: m.AdminPageSettingsPage }))
);
export const AdminInspectionTemplatePage = lazyWithRetry(() =>
  import('../pages/admin/AdminInspectionTemplatePage').then((m) => ({
    default: m.AdminInspectionTemplatePage,
  }))
);
export const AdminPayrollPage = lazyWithRetry(() =>
  import('../pages/admin/AdminPayrollPage').then((m) => ({ default: m.AdminPayrollPage }))
);
export const AdminEContractListPage = lazyWithRetry(() =>
  import('../pages/admin/AdminEContractListPage').then((m) => ({ default: m.AdminEContractListPage }))
);
export const AdminEContractDefinitionPage = lazyWithRetry(() =>
  import('../pages/admin/AdminEContractDefinitionPage').then((m) => ({ default: m.AdminEContractDefinitionPage }))
);
export const AdminEContractFieldSettingsPage = lazyWithRetry(() =>
  import('../pages/admin/AdminEContractFieldSettingsPage').then((m) => ({
    default: m.AdminEContractFieldSettingsPage,
  }))
);
export const AdminEContractIssuerProfilePage = lazyWithRetry(() =>
  import('../pages/admin/AdminEContractIssuerProfilePage').then((m) => ({
    default: m.AdminEContractIssuerProfilePage,
  }))
);
export const AdminEContractTeamOverviewPage = lazyWithRetry(() =>
  import('../pages/admin/AdminEContractTeamOverviewPage').then((m) => ({
    default: m.AdminEContractTeamOverviewPage,
  }))
);
export const EContractPublicSignPage = lazyWithRetry(() =>
  import('../pages/public/EContractPublicSignPage').then((m) => ({ default: m.EContractPublicSignPage }))
);
export const CrewHomePage = lazyWithRetry(() =>
  import('../pages/crew/CrewHomePage').then((m) => ({ default: m.CrewHomePage }))
);
export const CrewRosterCalendarPage = lazyWithRetry(() =>
  import('../pages/crew/CrewRosterCalendarPage').then((m) => ({ default: m.CrewRosterCalendarPage }))
);
export const CrewRosterDayPage = lazyWithRetry(() =>
  import('../pages/crew/CrewRosterDayPage').then((m) => ({ default: m.CrewRosterDayPage }))
);
export const CrewFieldSchedulePage = lazyWithRetry(() =>
  import('../pages/crew/CrewFieldSchedulePage').then((m) => ({ default: m.CrewFieldSchedulePage }))
);
export const CrewSettingsPage = lazyWithRetry(() =>
  import('../pages/crew/CrewSettingsPage').then((m) => ({ default: m.CrewSettingsPage }))
);
export const CrewSettlementPage = lazyWithRetry(() =>
  import('../pages/crew/CrewSettlementPage').then((m) => ({ default: m.CrewSettlementPage }))
);
export const CrewExpensesRedirect = lazyWithRetry(() =>
  import('../pages/crew/CrewSettlementPage').then((m) => ({ default: m.CrewExpensesRedirect }))
);
export const PlatformTenantListPage = lazyWithRetry(() =>
  import('../pages/platform/PlatformTenantListPage').then((m) => ({ default: m.PlatformTenantListPage }))
);
export const PlatformTenantCreatePage = lazyWithRetry(() =>
  import('../pages/platform/PlatformTenantCreatePage').then((m) => ({ default: m.PlatformTenantCreatePage }))
);
export const PlatformTenantDetailPage = lazyWithRetry(() =>
  import('../pages/platform/PlatformTenantDetailPage').then((m) => ({ default: m.PlatformTenantDetailPage }))
);
