-- CreateEnum
CREATE TYPE "MarketerAdminLevel" AS ENUM ('NONE', 'LIMITED', 'FULL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "marketer_admin_level" "MarketerAdminLevel" NOT NULL DEFAULT 'NONE';

-- Migrate legacy boolean
UPDATE "users" SET "marketer_admin_level" = 'FULL' WHERE "has_admin_privileges" = true;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "has_admin_privileges";
