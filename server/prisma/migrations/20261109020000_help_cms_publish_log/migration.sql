-- CreateTable
CREATE TABLE "help_cms_publish_logs" (
    "id" TEXT NOT NULL,
    "actor" VARCHAR(128) NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "slug" VARCHAR(128),
    "detail" TEXT,
    "request_ip" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_cms_publish_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "help_cms_publish_logs_created_at_idx" ON "help_cms_publish_logs"("created_at");

-- CreateIndex
CREATE INDEX "help_cms_publish_logs_slug_created_at_idx" ON "help_cms_publish_logs"("slug", "created_at");
