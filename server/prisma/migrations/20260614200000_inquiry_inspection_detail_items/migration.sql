-- CreateTable
CREATE TABLE "inquiry_inspection_items" (
    "id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,
    "item_key" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "not_applicable" BOOLEAN NOT NULL DEFAULT false,
    "na_reason" VARCHAR(500),

    CONSTRAINT "inquiry_inspection_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "inquiry_inspection_area_photos" ADD COLUMN "item_id" TEXT;

-- 기존 구역 단위 사진 → 임시 legacy 항목으로 이전
INSERT INTO "inquiry_inspection_items" ("id", "area_id", "item_key", "label", "sort_order", "is_custom", "not_applicable")
SELECT
    gen_random_uuid()::text,
    a."id",
    '_legacy',
    a."label" || ' (기존 통합)',
    999,
    false,
    false
FROM "inquiry_inspection_areas" a
WHERE EXISTS (
    SELECT 1 FROM "inquiry_inspection_area_photos" p WHERE p."area_id" = a."id"
);

UPDATE "inquiry_inspection_area_photos" p
SET "item_id" = i."id"
FROM "inquiry_inspection_items" i
WHERE i."area_id" = p."area_id" AND i."item_key" = '_legacy';

-- 사진 없는 구역도 표준 항목은 앱 최초 조회 시 seed (여기서는 빈 구역만 placeholder 1개)
INSERT INTO "inquiry_inspection_items" ("id", "area_id", "item_key", "label", "sort_order", "is_custom", "not_applicable")
SELECT
    gen_random_uuid()::text,
    a."id",
    '_pending_seed',
    '세부 항목 준비',
    0,
    false,
    true
FROM "inquiry_inspection_areas" a
WHERE NOT EXISTS (
    SELECT 1 FROM "inquiry_inspection_items" i WHERE i."area_id" = a."id"
);

-- DropForeignKey
ALTER TABLE "inquiry_inspection_area_photos" DROP CONSTRAINT "inquiry_inspection_area_photos_area_id_fkey";

-- DropIndex
DROP INDEX "inquiry_inspection_area_photos_area_id_phase_created_at_idx";

-- AlterTable
ALTER TABLE "inquiry_inspection_area_photos" DROP COLUMN "area_id";

-- NOT NULL (사진 없는 legacy placeholder item은 없음 — item_id 있는 row만)
DELETE FROM "inquiry_inspection_area_photos" WHERE "item_id" IS NULL;

ALTER TABLE "inquiry_inspection_area_photos" ALTER COLUMN "item_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_inspection_items_area_id_item_key_key" ON "inquiry_inspection_items"("area_id", "item_key");

-- CreateIndex
CREATE INDEX "inquiry_inspection_items_area_id_sort_order_idx" ON "inquiry_inspection_items"("area_id", "sort_order");

-- CreateIndex
CREATE INDEX "inquiry_inspection_area_photos_item_id_phase_created_at_idx" ON "inquiry_inspection_area_photos"("item_id", "phase", "created_at");

-- AddForeignKey
ALTER TABLE "inquiry_inspection_items" ADD CONSTRAINT "inquiry_inspection_items_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "inquiry_inspection_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_inspection_area_photos" ADD CONSTRAINT "inquiry_inspection_area_photos_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inquiry_inspection_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
