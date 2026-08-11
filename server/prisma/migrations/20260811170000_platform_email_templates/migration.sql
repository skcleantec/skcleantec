-- CreateTable
CREATE TABLE "platform_email_templates" (
    "id" TEXT NOT NULL,
    "purpose" VARCHAR(64) NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "subject_template" VARCHAR(500) NOT NULL,
    "headline" VARCHAR(128) NOT NULL,
    "preheader" VARCHAR(256),
    "intro_html" TEXT NOT NULL,
    "footer_html" TEXT NOT NULL,
    "noreply_notice_html" TEXT NOT NULL,
    "updated_by_email" VARCHAR(320),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_email_templates_purpose_key" ON "platform_email_templates"("purpose");

-- Seed: default customer email templates
INSERT INTO "platform_email_templates" (
    "id",
    "purpose",
    "label",
    "enabled",
    "subject_template",
    "headline",
    "preheader",
    "intro_html",
    "footer_html",
    "noreply_notice_html",
    "updated_at"
) VALUES (
    gen_random_uuid()::text,
    'ORDER_FORM_SUBMISSION',
    '발주서 제출 확인',
    true,
    '[{{brandDisplayName}}] {{customerName}}님 발주서 접수가 완료되었습니다',
    '발주서 접수 완료',
    '청소비서를 통해 예약 접수가 정상 완료되었습니다.',
    $html$<p><strong>{{customerName}}</strong>님, 안녕하세요.</p><p><strong>청소비서</strong>를 통해 <strong>{{brandDisplayName}}</strong>에 청소 예약(발주서) 접수가 정상적으로 완료되었습니다.</p><p>아래는 접수하신 내용 요약입니다.</p>$html$,
    $html$<p>담당자가 일정을 확인한 뒤 연락드릴 수 있습니다.</p><p>청소비서는 입주·이사 청소 예약을 돕는 서비스입니다.</p>$html$,
    $html$<p>본 메일은 발신 전용 주소(noreply)로 발송되었으며 <strong>회신되지 않습니다</strong>. 문의는 업체 연락처 또는 <a href="https://www.cbiseo.com/help">청소비서 고객센터</a>를 이용해 주세요.</p>$html$,
    CURRENT_TIMESTAMP
),
(
    gen_random_uuid()::text,
    'INSPECTION_COMPLETION',
    '현장검수 완료본',
    true,
    '[{{brandDisplayName}}] {{customerName}}님 현장 검수 완료본',
    '현장 검수 완료',
    '청소비서 현장 검수 결과를 확인해 주세요.',
    $html$<p><strong>{{customerName}}</strong>님, 안녕하세요.</p><p><strong>청소비서</strong>를 통해 진행된 현장 검수가 완료되었습니다. 아래에서 검수 결과를 확인하실 수 있습니다.</p>$html$,
    $html$<p>검수 사진·PDF는 아래 링크에서 확인하실 수 있습니다.</p>$html$,
    $html$<p>본 메일은 발신 전용 주소(noreply)로 발송되었으며 <strong>회신되지 않습니다</strong>. 문의는 업체 연락처 또는 <a href="https://www.cbiseo.com/help">청소비서 고객센터</a>를 이용해 주세요.</p>$html$,
    CURRENT_TIMESTAMP
);
