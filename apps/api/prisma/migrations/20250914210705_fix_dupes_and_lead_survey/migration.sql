/*
  Warnings:

  - A unique constraint covering the columns `[email,surveyId]` on the table `Lead` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Lead" ADD COLUMN     "surveyId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Lead_surveyId_idx" ON "public"."Lead"("surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_surveyId_key" ON "public"."Lead"("email", "surveyId");

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."Survey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
