-- CreateEnum
CREATE TYPE "AttachmentNature" AS ENUM ('DEMANDE', 'CONFIRMATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CONFIRMATION_ATTENDUE';
ALTER TYPE "NotificationType" ADD VALUE 'DEMANDE_CONFIRMEE';

-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'CONFIRMEE';

-- DropIndex
DROP INDEX "attachments_requestId_idx";

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "nature" "AttachmentNature" NOT NULL DEFAULT 'DEMANDE';

-- AlterTable
ALTER TABLE "expense_requests" ADD COLUMN     "confirmationNote" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "attachments_requestId_nature_idx" ON "attachments"("requestId", "nature");
