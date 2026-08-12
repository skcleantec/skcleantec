-- CreateTable
CREATE TABLE "schedule_staff_notice_boards" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "updated_by_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_staff_notice_boards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_staff_notice_boards_tenant_id_key" ON "schedule_staff_notice_boards"("tenant_id");

-- AddForeignKey
ALTER TABLE "schedule_staff_notice_boards" ADD CONSTRAINT "schedule_staff_notice_boards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_staff_notice_boards" ADD CONSTRAINT "schedule_staff_notice_boards_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
