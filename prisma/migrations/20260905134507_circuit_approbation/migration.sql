-- CreateTable
CREATE TABLE "approver_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approver_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approver_assignments_approverId_idx" ON "approver_assignments"("approverId");

-- CreateIndex
CREATE UNIQUE INDEX "approver_assignments_userId_ordre_key" ON "approver_assignments"("userId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "approver_assignments_userId_approverId_key" ON "approver_assignments"("userId", "approverId");

-- AddForeignKey
ALTER TABLE "approver_assignments" ADD CONSTRAINT "approver_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approver_assignments" ADD CONSTRAINT "approver_assignments_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

