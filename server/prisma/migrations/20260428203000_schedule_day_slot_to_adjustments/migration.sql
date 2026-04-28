-- CreateTable
CREATE TABLE "schedule_day_slot_to_adjustments" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "morning_delta" INTEGER NOT NULL DEFAULT 0,
    "afternoon_delta" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_day_slot_to_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_day_slot_to_adjustments_date_key" ON "schedule_day_slot_to_adjustments"("date");
