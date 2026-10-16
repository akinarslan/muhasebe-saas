-- AlterTable
ALTER TABLE "AuthUser" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AuthSession" ADD COLUMN     "mfaVerifiedAt" TIMESTAMPTZ(3),
ADD COLUMN     "stepUpAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "AuthTwoFactor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),

    CONSTRAINT "AuthTwoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthBootstrap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthBootstrap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSecurityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthTwoFactor_userId_key" ON "AuthTwoFactor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthBootstrap_userId_key" ON "AuthBootstrap"("userId");

-- AddForeignKey
ALTER TABLE "AuthTwoFactor" ADD CONSTRAINT "AuthTwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE FUNCTION reject_auth_security_event_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Security audit is append-only'; END $$;
CREATE TRIGGER auth_security_event_immutable BEFORE UPDATE OR DELETE ON "AuthSecurityEvent" FOR EACH ROW EXECUTE FUNCTION reject_auth_security_event_change();
ALTER TABLE "AuthUser" ADD CONSTRAINT auth_status_valid CHECK (status IN ('ACTIVE','INVITED','INACTIVE','SUSPENDED'));
