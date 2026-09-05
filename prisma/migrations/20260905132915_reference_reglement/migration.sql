-- CreateTable
CREATE TABLE "payment_counters" (
    "annee" INTEGER NOT NULL,
    "dernier" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "payment_counters_pkey" PRIMARY KEY ("annee")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_requests_paymentRef_key" ON "expense_requests"("paymentRef");

