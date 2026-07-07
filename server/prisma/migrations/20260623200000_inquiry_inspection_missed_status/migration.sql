-- 현장 검수 누락(팀장 일정·배정목록 표시)
ALTER TYPE "InquiryInspectionStatus" ADD VALUE IF NOT EXISTS 'MISSED';
