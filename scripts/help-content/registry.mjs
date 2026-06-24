import { buildDashboardMarkdown } from './admin-dashboard.mjs';
import { buildScheduleMarkdown } from './admin-schedule.mjs';
import { buildDbMarketplaceMarkdown } from './admin-db-marketplace.mjs';
import {
  buildAdvertisingMarkdown,
  buildAdvertisingSettingsMarkdown,
} from './admin-advertising.mjs';
import { buildAdminMessagesMarkdown } from './admin-messages.mjs';
import {
  buildTeamLeadersUserRegisterMarkdown,
  buildTeamMembersMarkdown,
  buildHolidayCalendarMarkdown,
  buildLeaderStatsMarkdown,
  buildPayrollMarkdown,
  buildExternalSettlementMarkdown,
  buildEContractsMarkdown,
  buildInspectionTemplateMarkdown,
  buildOperatingCompaniesMarkdown,
  buildPageSettingsMarkdown,
  buildTenantPartnersMarkdown,
  buildTenantPartnerSettlementMarkdown,
  buildCompanySubscriptionMarkdown,
  buildCompanyBusinessMarkdown,
  buildCompanyOutboundEmailMarkdown,
  buildExternalCompaniesMarkdown,
  buildStaffAccessMarkdown,
  buildOperatingPolicyMarkdown,
} from './admin-team-leaders.mjs';
import {
  buildTeamDashboardMarkdown,
  buildTeamAssignmentsMarkdown,
  buildTeamScheduleMarkdown,
  buildTeamCsMarkdown,
  buildTeamEContractsMarkdown,
  buildTeamSettlementMarkdown,
  buildTeamDayoffsMarkdown,
  buildTeamMessagesMarkdown,
  buildTeamDbMarketplaceMarkdown,
} from './team-pages.mjs';
import { buildInquiriesDetailedMarkdown } from '../detailed-help-inquiries.mjs';
import {
  buildFollowupMarkdown,
  buildReviewPaybackMarkdown,
  buildCsMarkdown,
  buildOrderFormsListMarkdown,
  buildOrderIssueMarkdown,
  buildOrderTemplatesMarkdown,
  buildOrderCustomerLinkMarkdown,
  buildOrderCustomerPreviewMarkdown,
  buildQuotationsListMarkdown,
  buildQuotationsNewMarkdown,
  buildQuotationsSettingsMarkdown,
} from './admin-service-inquiries.mjs';

/** path → 상세 markdown 생성 함수 (없으면 null) */
const DETAILED_BY_PATH = {
  '/admin/dashboard': buildDashboardMarkdown,
  '/admin/inquiries': buildInquiriesDetailedMarkdown,
  '/admin/inquiries/followup': buildFollowupMarkdown,
  '/admin/inquiries/review-payback': buildReviewPaybackMarkdown,
  '/admin/inquiries/cs': buildCsMarkdown,
  '/admin/inquiries/order-forms': buildOrderFormsListMarkdown,
  '/admin/inquiries/order-issue': buildOrderIssueMarkdown,
  '/admin/inquiries/order-templates': buildOrderTemplatesMarkdown,
  '/admin/inquiries/order-customer-link': buildOrderCustomerLinkMarkdown,
  '/admin/inquiries/order-customer-preview': buildOrderCustomerPreviewMarkdown,
  '/admin/inquiries/quotations': buildQuotationsListMarkdown,
  '/admin/inquiries/quotations/new': buildQuotationsNewMarkdown,
  '/admin/inquiries/quotations/settings': buildQuotationsSettingsMarkdown,
  '/admin/schedule': buildScheduleMarkdown,
  '/admin/db-marketplace': buildDbMarketplaceMarkdown,
  '/admin/advertising': buildAdvertisingMarkdown,
  '/admin/advertising/settings': buildAdvertisingSettingsMarkdown,
  '/admin/messages': buildAdminMessagesMarkdown,
  '/admin/team-leaders': buildTeamLeadersUserRegisterMarkdown,
  '/admin/team-leaders/team-members': buildTeamMembersMarkdown,
  '/admin/team-leaders/holiday-calendar': buildHolidayCalendarMarkdown,
  '/admin/team-leaders/leader-stats': buildLeaderStatsMarkdown,
  '/admin/team-leaders/payroll': buildPayrollMarkdown,
  '/admin/team-leaders/external-settlement': buildExternalSettlementMarkdown,
  '/admin/team-leaders/e-contracts': buildEContractsMarkdown,
  '/admin/team-leaders/inspection-template': buildInspectionTemplateMarkdown,
  '/admin/team-leaders/operating-companies': buildOperatingCompaniesMarkdown,
  '/admin/team-leaders/page-settings': buildPageSettingsMarkdown,
  '/admin/team-leaders/tenant-partners': buildTenantPartnersMarkdown,
  '/admin/team-leaders/tenant-partner-settlement': buildTenantPartnerSettlementMarkdown,
  '/admin/team-leaders/company-profile/subscription': buildCompanySubscriptionMarkdown,
  '/admin/team-leaders/company-profile/business': buildCompanyBusinessMarkdown,
  '/admin/team-leaders/company-profile/outbound-email': buildCompanyOutboundEmailMarkdown,
  '/admin/team-leaders/external-companies': buildExternalCompaniesMarkdown,
  '/admin/team-leaders/staff-access': buildStaffAccessMarkdown,
  '/admin/team-leaders/operating-policy': buildOperatingPolicyMarkdown,
  '/team/dashboard': buildTeamDashboardMarkdown,
  '/team/assignments': buildTeamAssignmentsMarkdown,
  '/team/schedule': buildTeamScheduleMarkdown,
  '/team/cs': buildTeamCsMarkdown,
  '/team/e-contracts': buildTeamEContractsMarkdown,
  '/team/settlement': buildTeamSettlementMarkdown,
  '/team/dayoffs': buildTeamDayoffsMarkdown,
  '/team/messages': buildTeamMessagesMarkdown,
  '/team/db-marketplace': buildTeamDbMarketplaceMarkdown,
};

export function resolveDetailedMarkdown(path) {
  const fn = DETAILED_BY_PATH[path];
  return fn ? fn() : null;
}
