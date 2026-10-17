-- AlterTable
ALTER TABLE "AuthInvitation" ADD COLUMN     "revokedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "AuthMailDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipId" UUID,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AuthMailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthMailDelivery_userId_createdAt_idx" ON "AuthMailDelivery"("userId", "createdAt");
