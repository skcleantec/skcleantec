-- CreateTable
CREATE TABLE "schedule_day_staff_memos" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "updated_by_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_day_staff_memos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_day_staff_memos_tenant_id_date_key" ON "schedule_day_staff_memos"("tenant_id", "date");

-- AddForeignKey
ALTER TABLE "schedule_day_staff_memos" ADD CONSTRAINT "schedule_day_staff_memos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_day_staff_memos" ADD CONSTRAINT "schedule_day_staff_memos_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
