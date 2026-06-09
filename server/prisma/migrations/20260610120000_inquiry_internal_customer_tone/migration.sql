-- CreateEnum
CREATE TYPE "InternalCustomerTone" AS ENUM ('GOOD', 'NORMAL', 'BAD');

-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN "internal_customer_tone" "InternalCustomerTone" NOT NULL DEFAULT 'NORMAL';
