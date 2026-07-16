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
export const AdminServiceZonesPage = lazyWithRetry(() =>
  import('../pages/admin/AdminServiceZonesPage').then((m) => ({ default: m.AdminServiceZonesPage }))
);
export const AdminTeamLeadersPage = lazyWithRetry(() =>
  import('../pages/admin/AdminTeamLeadersPage').then((m) => ({ default: m.AdminTeamLeadersPage }))
);
export const AdminInquiryBulkDeletePage = lazyWithRetry(() =>
  import('../pages/admin/AdminInquiryBulkDeletePage').then((m) => ({ default: m.AdminInquiryBulkDeletePage }))
);
export const AdminInquiryTrashPage = lazyWithRetry(() =>
  import('../pages/admin/AdminInquiryTrashPage').then((m) => ({ default: m.AdminInquiryTrashPage }))
);
export const AdminInquiryExcelMappingsPage = lazyWithRetry(() =>
  import('../pages/admin/AdminInquiryExcelMappingsPage').then((m) => ({ default: m.AdminInquiryExcelMappingsPage }))
);
export const AdminInquiryExcelImportPage = lazyWithRetry(() =>
  import('../pages/admin/AdminInquiryExcelImportPage').then((m) => ({ default: m.AdminInquiryExcelImportPage }))
);
export const AdminInquiryExcelHistoryPage = lazyWithRetry(() =>
  import('../pages/admin/AdminInquiryExcelHistoryPage').then((m) => ({ default: m.AdminInquiryExcelHistoryPage }))
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
export const AdminOrderFormCustomerLinkSettingsPage = lazyWithRetry(() =>
  import('../pages/admin/AdminOrderFormCustomerLinkSettingsPage').then((m) => ({
    default: m.AdminOrderFormCustomerLinkSettingsPage,
  }))
);
export const AdminOrderFormTemplatesPage = lazyWithRetry(() =>
  import('../pages/admin/AdminOrderFormTemplatesPage').then((m) => ({ default: m.AdminOrderFormTemplatesPage }))
);
export const AdminQuotationsListPage = lazyWithRetry(() =>
  import('../pages/admin/AdminQuotationsListPage').then((m) => ({ default: m.AdminQuotationsListPage }))
);
export const AdminQuotationEditorPage = lazyWithRetry(() =>
  import('../pages/admin/AdminQuotationEditorPage').then((m) => ({ default: m.AdminQuotationEditorPage }))
);
export const AdminQuotationSettingsPage = lazyWithRetry(() =>
  import('../pages/admin/AdminQuotationSettingsPage').then((m) => ({ default: m.AdminQuotationSettingsPage }))
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
export const TeamPostCleanPhotoPage = lazyWithRetry(() =>
  import('../pages/team/TeamPostCleanPhotoPage').then((m) => ({ default: m.TeamPostCleanPhotoPage }))
);
export const TeamExternalSettlementPage = lazyWithRetry(() =>
  import('../pages/team/TeamExternalSettlementPage').then((m) => ({ default: m.TeamExternalSettlementPage }))
);
export const TeamDbMarketplacePage = lazyWithRetry(() =>
  import('../pages/team/TeamDbMarketplacePage').then((m) => ({ default: m.TeamDbMarketplacePage }))
);
export const TeamEContractListPage = lazyWithRetry(() =>
  import('../pages/team/TeamEContractListPage').then((m) => ({ default: m.TeamEContractListPage }))
);
export const TeamTrainingMaterialPage = lazyWithRetry(() =>
  import('../pages/team/TeamTrainingMaterialPage').then((m) => ({ default: m.TeamTrainingMaterialPage }))
);
export const TeamQuotationEditorPage = lazyWithRetry(() =>
  import('../pages/team/TeamQuotationEditorPage').then((m) => ({ default: m.TeamQuotationEditorPage }))
);
export const TeamCardPaymentPage = lazyWithRetry(() =>
  import('../pages/team/TeamCardPaymentPage').then((m) => ({ default: m.TeamCardPaymentPage }))
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
export const AdminLandingContactLayout = lazyWithRetry(() =>
  import('../components/layout/AdminLandingContactLayout').then((m) => ({
    default: m.AdminLandingContactLayout,
  }))
);
export const AdminLandingContactListPage = lazyWithRetry(() =>
  import('../pages/admin/leads/AdminLandingContactListPage').then((m) => ({
    default: m.AdminLandingContactListPage,
  }))
);
export const AdminLandingContactSettingsPage = lazyWithRetry(() =>
  import('../pages/admin/leads/AdminLandingContactSettingsPage').then((m) => ({
    default: m.AdminLandingContactSettingsPage,
  }))
);
export const ContactInquiryPage = lazyWithRetry(() =>
  import('../pages/contact/ContactInquiryPage').then((m) => ({ default: m.ContactInquiryPage }))
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
export const AdminDbMarketplacePage = lazyWithRetry(() =>
  import('../pages/admin/AdminDbMarketplacePage').then((m) => ({ default: m.AdminDbMarketplacePage }))
);
export const AdminOperatingCompaniesPage = lazyWithRetry(() =>
  import('../pages/admin/AdminOperatingCompaniesPage').then((m) => ({ default: m.AdminOperatingCompaniesPage }))
);
export const AdminTenantSubscriptionPage = lazyWithRetry(() =>
  import('../pages/admin/AdminTenantSubscriptionPage').then((m) => ({
    default: m.AdminTenantSubscriptionPage,
  }))
);
export const AdminTenantCompanyBusinessPage = lazyWithRetry(() =>
  import('../pages/admin/AdminTenantCompanyBusinessPage').then((m) => ({
    default: m.AdminTenantCompanyBusinessPage,
  }))
);
export const AdminTenantCompanyOutboundEmailPage = lazyWithRetry(() =>
  import('../pages/admin/AdminTenantCompanyOutboundEmailPage').then((m) => ({
    default: m.AdminTenantCompanyOutboundEmailPage,
  }))
);
export const AdminOperatingCompanyPolicyPage = lazyWithRetry(() =>
  import('../pages/admin/AdminOperatingCompanyPolicyPage').then((m) => ({
    default: m.AdminOperatingCompanyPolicyPage,
  }))
);
export const AdminStaffAccessSettingsPage = lazyWithRetry(() =>
  import('../pages/admin/AdminStaffAccessSettingsPage').then((m) => ({
    default: m.AdminStaffAccessSettingsPage,
  }))
);
export const AdminExternalSettlementPage = lazyWithRetry(() =>
  import('../pages/admin/AdminExternalSettlementPage').then((m) => ({ default: m.AdminExternalSettlementPage }))
);
export const AdminPageSettingsPage = lazyWithRetry(() =>
  import('../pages/admin/AdminPageSettingsPage').then((m) => ({ default: m.AdminPageSettingsPage }))
);
export const AdminTeamLeaderTrainingPage = lazyWithRetry(() =>
  import('../pages/admin/AdminTeamLeaderTrainingPage').then((m) => ({
    default: m.AdminTeamLeaderTrainingPage,
  }))
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
export const LegalAgreePublicPage = lazyWithRetry(() =>
  import('../pages/public/LegalAgreePublicPage').then((m) => ({ default: m.LegalAgreePublicPage }))
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
export const CrewDayOffsPage = lazyWithRetry(() =>
  import('../pages/crew/CrewDayOffsPage').then((m) => ({ default: m.CrewDayOffsPage }))
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
export const PlatformBillingPage = lazyWithRetry(() =>
  import('../pages/platform/PlatformBillingPage').then((m) => ({ default: m.PlatformBillingPage }))
);
export const PlatformSupportAccessPage = lazyWithRetry(() =>
  import('../pages/platform/PlatformSupportAccessPage').then((m) => ({ default: m.PlatformSupportAccessPage }))
);
export const PlatformDbMarketplacePage = lazyWithRetry(() =>
  import('../pages/platform/PlatformDbMarketplacePage').then((m) => ({ default: m.PlatformDbMarketplacePage }))
);
export const PlatformHelpInquirySettingsPage = lazyWithRetry(() =>
  import('../pages/platform/PlatformHelpInquirySettingsPage').then((m) => ({
    default: m.PlatformHelpInquirySettingsPage,
  }))
);
export const PlatformUnpaidPopupSettingsPage = lazyWithRetry(() =>
  import('../pages/platform/PlatformUnpaidPopupSettingsPage').then((m) => ({
    default: m.PlatformUnpaidPopupSettingsPage,
  }))
);
export const PlatformSettingsPage = lazyWithRetry(() =>
  import('../pages/platform/PlatformSettingsPage').then((m) => ({
    default: m.PlatformSettingsPage,
  }))
);
export const HelpPage = lazyWithRetry(() =>
  import('../pages/HelpPage').then((m) => ({ default: m.HelpPage }))
);
export const CrmPage = lazyWithRetry(() =>
  import('../pages/admin/crm/CrmPage').then((m) => ({ default: m.CrmPage }))
);
export const CrmPopupEntry = lazyWithRetry(() =>
  import('../pages/admin/crm/CrmPopupEntry').then((m) => ({ default: m.CrmPopupEntry }))
);
export const CrmSoomgoCompanionEntry = lazyWithRetry(() =>
  import('../pages/admin/crm/CrmSoomgoCompanionEntry').then((m) => ({ default: m.CrmSoomgoCompanionEntry }))
);
export const TelecrmSettingsLayout = lazyWithRetry(() =>
  import('../pages/admin/crm/settings/TelecrmSettingsLayout').then((m) => ({ default: m.TelecrmSettingsLayout }))
);
export const TelecrmScriptSettingsPage = lazyWithRetry(() =>
  import('../pages/admin/crm/settings/TelecrmScriptSettingsPage').then((m) => ({
    default: m.TelecrmScriptSettingsPage,
  }))
);
export const TelecrmPricingSettingsPage = lazyWithRetry(() =>
  import('../pages/admin/crm/settings/TelecrmPricingSettingsPage').then((m) => ({
    default: m.TelecrmPricingSettingsPage,
  }))
);
export const TelecrmGeneralSettingsPage = lazyWithRetry(() =>
  import('../pages/admin/crm/settings/TelecrmGeneralSettingsPage').then((m) => ({
    default: m.TelecrmGeneralSettingsPage,
  }))
);
export const TelecrmSoomgoSettingsPage = lazyWithRetry(() =>
  import('../pages/admin/crm/settings/TelecrmSoomgoSettingsPage').then((m) => ({
    default: m.TelecrmSoomgoSettingsPage,
  }))
);
export const TelecrmSoomgoPresetsSettingsPage = lazyWithRetry(() =>
  import('../pages/admin/crm/settings/TelecrmSoomgoPresetsSettingsPage').then((m) => ({
    default: m.TelecrmSoomgoPresetsSettingsPage,
  }))
);
