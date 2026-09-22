-- Farm City — outstanding schema changes for Supabase.
-- Safe to run more than once (idempotent). Paste into the Supabase SQL editor.

-- 1) Bulk quotes: extra columns (Part 3)
ALTER TABLE "BulkQuote" ADD COLUMN IF NOT EXISTS "type" TEXT;
ALTER TABLE "BulkQuote" ADD COLUMN IF NOT EXISTS "contactPerson" TEXT;
ALTER TABLE "BulkQuote" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "BulkQuote" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "BulkQuote" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- 2) Payment reminders (Part 5)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "remindedAt" TIMESTAMP(3);

-- 3) Contract customers & standing orders (Phase 2)
CREATE TABLE IF NOT EXISTS "ContractCustomer" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "organisation" TEXT,
    "contactPerson" TEXT,
    "billingEmail" TEXT,
    "paymentTerms" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContractCustomer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContractCustomer_customerId_key" ON "ContractCustomer"("customerId");

CREATE TABLE IF NOT EXISTS "StandingOrder" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "label" TEXT,
    "frequency" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'JUJA_HUB',
    "method" TEXT NOT NULL DEFAULT 'LOCAL_RIDER',
    "zoneId" TEXT,
    "address" TEXT,
    "county" TEXT,
    "town" TEXT,
    "receiverName" TEXT,
    "receiverPhone" TEXT,
    "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StandingOrder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StandingOrder_active_nextRunAt_idx" ON "StandingOrder"("active", "nextRunAt");

CREATE TABLE IF NOT EXISTS "StandingOrderItem" (
    "id" TEXT NOT NULL,
    "standingOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "slug" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "StandingOrderItem_pkey" PRIMARY KEY ("id")
);

-- 4) Price lists & invoices (Phase 2)
CREATE TABLE IF NOT EXISTS "ContractPrice" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "slug" TEXT,
    "productName" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContractPrice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContractPrice_contractId_productName_key" ON "ContractPrice"("contractId", "productName");

CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_number_key" ON "Invoice"("number");
CREATE INDEX IF NOT EXISTS "Invoice_contractId_idx" ON "Invoice"("contractId");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");

CREATE TABLE IF NOT EXISTS "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "lineTotal" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- 5) Foreign keys (guarded so re-running is safe)
DO $$ BEGIN
  ALTER TABLE "ContractCustomer" ADD CONSTRAINT "ContractCustomer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StandingOrder" ADD CONSTRAINT "StandingOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ContractCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StandingOrderItem" ADD CONSTRAINT "StandingOrderItem_standingOrderId_fkey" FOREIGN KEY ("standingOrderId") REFERENCES "StandingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractPrice" ADD CONSTRAINT "ContractPrice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ContractCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ContractCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
