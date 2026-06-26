-- AlterEnum
ALTER TYPE "EContractAudience" ADD VALUE 'TEAM_MEMBER';

-- AlterTable
ALTER TABLE "e_contract_issuances" ALTER COLUMN "team_leader_id" DROP NOT NULL;

ALTER TABLE "e_contract_issuances" ADD COLUMN "team_member_id" TEXT;
ALTER TABLE "e_contract_issuances" ADD COLUMN "recipient_label" VARCHAR(128);

-- AddForeignKey
ALTER TABLE "e_contract_issuances" ADD CONSTRAINT "e_contract_issuances_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "e_contract_issuances_team_member_id_created_at_idx" ON "e_contract_issuances"("team_member_id", "created_at" DESC);
