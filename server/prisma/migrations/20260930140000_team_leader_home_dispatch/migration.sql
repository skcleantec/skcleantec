-- 팀장 집 주소(좌표)와 배정 성향(하루 건수·집 크기)
ALTER TABLE "users" ADD COLUMN "home_address" VARCHAR(512),
ADD COLUMN "home_address_detail" VARCHAR(256),
ADD COLUMN "home_geo_lat" DOUBLE PRECISION,
ADD COLUMN "home_geo_lng" DOUBLE PRECISION,
ADD COLUMN "home_geo_query" VARCHAR(512);

CREATE TYPE "TeamLeaderSizePolicy" AS ENUM ('UNRESTRICTED', 'ONE_ROOM_ONLY', 'ONE_AND_TWO', 'EXCLUDE_ONE_AND_TWO');

CREATE TABLE "team_leader_dispatch_profiles" (
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "jobs_per_day" INTEGER NOT NULL DEFAULT 2,
    "size_policy" "TeamLeaderSizePolicy" NOT NULL DEFAULT 'UNRESTRICTED',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_leader_dispatch_profiles_pkey" PRIMARY KEY ("user_id")
);

CREATE INDEX "team_leader_dispatch_profiles_tenant_id_idx" ON "team_leader_dispatch_profiles"("tenant_id");

ALTER TABLE "team_leader_dispatch_profiles" ADD CONSTRAINT "team_leader_dispatch_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_leader_dispatch_profiles" ADD CONSTRAINT "team_leader_dispatch_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
