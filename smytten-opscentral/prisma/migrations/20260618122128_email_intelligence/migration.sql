-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('CHARGEBACK', 'COURIER_ESCALATION', 'INWARD', 'OTHER');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RecordSource" AS ENUM ('EMAIL', 'MANUAL');

-- CreateTable
CREATE TABLE "gmail_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_extractions" (
    "id" TEXT NOT NULL,
    "category" "EmailCategory" NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "source" "RecordSource" NOT NULL DEFAULT 'EMAIL',
    "threadId" TEXT NOT NULL,
    "messageId" TEXT,
    "emailDate" TIMESTAMP(3),
    "subject" TEXT,
    "fromAddress" TEXT,
    "gmailThreadUrl" TEXT,
    "data" JSONB NOT NULL,
    "model" TEXT,
    "confidence" DOUBLE PRECISION,
    "rawSnippet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "email_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gmail_connections_userId_idx" ON "gmail_connections"("userId");

-- CreateIndex
CREATE INDEX "email_extractions_status_idx" ON "email_extractions"("status");

-- CreateIndex
CREATE INDEX "email_extractions_category_idx" ON "email_extractions"("category");

-- CreateIndex
CREATE UNIQUE INDEX "email_extractions_threadId_category_key" ON "email_extractions"("threadId", "category");

-- AddForeignKey
ALTER TABLE "gmail_connections" ADD CONSTRAINT "gmail_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_extractions" ADD CONSTRAINT "email_extractions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
