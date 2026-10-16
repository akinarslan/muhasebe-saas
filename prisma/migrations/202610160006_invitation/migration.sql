-- CreateTable
CREATE TABLE "AuthInvitation" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthInvitation_tokenHash_key" ON "AuthInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthInvitation_userId_idx" ON "AuthInvitation"("userId");
