-- CreateTable
CREATE TABLE "inquiry_consultation_photos" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "cloudinary_public_id" VARCHAR(512) NOT NULL,
    "secure_url" VARCHAR(1024) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_consultation_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiry_consultation_photos_inquiry_id_created_at_idx" ON "inquiry_consultation_photos"("inquiry_id", "created_at");

-- AddForeignKey
ALTER TABLE "inquiry_consultation_photos" ADD CONSTRAINT "inquiry_consultation_photos_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inquiry_consultation_photos" ADD CONSTRAINT "inquiry_consultation_photos_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
