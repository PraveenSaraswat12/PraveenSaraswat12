-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OPS_EXEC', 'OPS_LEAD', 'FINANCE', 'VENDOR');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('DELIVERED', 'RTO', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PENDING_PICKUP', 'NDR', 'LOST', 'CANCELLED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'OPS_EXEC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_batches" (
    "id" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "sourceHeader" TEXT,

    CONSTRAINT "upload_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_records" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "awb" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3),
    "pickupDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'UNKNOWN',
    "rawStatus" TEXT,
    "isRTO" BOOLEAN NOT NULL DEFAULT false,
    "ndrAttempts" INTEGER NOT NULL DEFAULT 0,
    "pincode" TEXT,
    "state" TEXT,
    "zone" TEXT,
    "weight" DOUBLE PRECISION,
    "codAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "upload_batches_uploadedAt_idx" ON "upload_batches"("uploadedAt");

-- CreateIndex
CREATE INDEX "delivery_records_batchId_idx" ON "delivery_records"("batchId");

-- CreateIndex
CREATE INDEX "delivery_records_awb_idx" ON "delivery_records"("awb");

-- CreateIndex
CREATE INDEX "delivery_records_zone_idx" ON "delivery_records"("zone");

-- CreateIndex
CREATE INDEX "delivery_records_state_idx" ON "delivery_records"("state");

-- CreateIndex
CREATE INDEX "delivery_records_pincode_idx" ON "delivery_records"("pincode");

-- CreateIndex
CREATE INDEX "delivery_records_status_idx" ON "delivery_records"("status");

-- CreateIndex
CREATE INDEX "delivery_records_isRTO_idx" ON "delivery_records"("isRTO");

-- CreateIndex
CREATE INDEX "delivery_records_orderDate_idx" ON "delivery_records"("orderDate");

-- CreateIndex
CREATE INDEX "delivery_records_pickupDate_idx" ON "delivery_records"("pickupDate");

-- CreateIndex
CREATE INDEX "delivery_records_deliveryDate_idx" ON "delivery_records"("deliveryDate");

-- AddForeignKey
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "upload_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
