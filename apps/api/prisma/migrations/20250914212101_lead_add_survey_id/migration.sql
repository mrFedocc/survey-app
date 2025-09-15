-- DropIndex
DROP INDEX "public"."Lead_email_surveyId_key";

-- DropIndex
DROP INDEX "public"."Lead_surveyId_idx";

-- AlterTable
ALTER TABLE "public"."Lead" ALTER COLUMN "choices" DROP NOT NULL;
