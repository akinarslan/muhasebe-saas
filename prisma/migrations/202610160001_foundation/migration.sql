-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CostUnit" AS ENUM ('square_meter', 'linear_meter', 'piece', 'sheet');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalEntity" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,

    CONSTRAINT "LegalEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "sourceId" VARCHAR(200) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(320),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "unit" "CostUnit" NOT NULL,
    "roll" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialVariant" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "widthCm" DECIMAL(12,4) NOT NULL,
    "lengthCm" DECIMAL(12,4),
    "usdCost" DECIMAL(18,6),
    "inStock" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MaterialVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialPriceHistory" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "previousUsd" DECIMAL(18,6),
    "nextUsd" DECIMAL(18,6) NOT NULL,
    "actorId" VARCHAR(200) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalEntity_tenantId_id_key" ON "LegalEntity"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_tenantId_legalEntityId_id_key" ON "Activity"("tenantId", "legalEntityId", "id");

-- CreateIndex
CREATE INDEX "Customer_tenantId_legalEntityId_name_idx" ON "Customer"("tenantId", "legalEntityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_tenantId_legalEntityId_sourceId_key" ON "Customer"("tenantId", "legalEntityId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Material_tenantId_legalEntityId_id_key" ON "Material"("tenantId", "legalEntityId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialVariant_tenantId_legalEntityId_id_key" ON "MaterialVariant"("tenantId", "legalEntityId", "id");

-- CreateIndex
CREATE INDEX "MaterialPriceHistory_tenantId_legalEntityId_variantId_recor_idx" ON "MaterialPriceHistory"("tenantId", "legalEntityId", "variantId", "recordedAt");

-- AddForeignKey
ALTER TABLE "LegalEntity" ADD CONSTRAINT "LegalEntity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_legalEntityId_fkey" FOREIGN KEY ("tenantId", "legalEntityId") REFERENCES "LegalEntity"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_legalEntityId_fkey" FOREIGN KEY ("tenantId", "legalEntityId") REFERENCES "LegalEntity"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_tenantId_legalEntityId_fkey" FOREIGN KEY ("tenantId", "legalEntityId") REFERENCES "LegalEntity"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialVariant" ADD CONSTRAINT "MaterialVariant_tenantId_legalEntityId_materialId_fkey" FOREIGN KEY ("tenantId", "legalEntityId", "materialId") REFERENCES "Material"("tenantId", "legalEntityId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPriceHistory" ADD CONSTRAINT "MaterialPriceHistory_tenantId_legalEntityId_variantId_fkey" FOREIGN KEY ("tenantId", "legalEntityId", "variantId") REFERENCES "MaterialVariant"("tenantId", "legalEntityId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
