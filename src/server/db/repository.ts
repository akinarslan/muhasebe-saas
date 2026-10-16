import "server-only";
import { z } from "zod";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";

const scopeSchema = z
  .object({ tenantId: z.uuid(), legalEntityId: z.uuid() })
  .strict();
export type CompanyScope = z.infer<typeof scopeSchema>;
const customerSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(200),
    name: z.string().trim().min(2).max(200),
    email: z.email().optional(),
  })
  .strict();
export type NewCustomer = z.infer<typeof customerSchema>;

// Internal DAL only. Sprint C must construct scope from verified membership,
// never request payloads. No public CRUD route is exposed in Sprint B.
export class CompanyRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly scope: CompanyScope,
  ) {
    scopeSchema.parse(scope);
  }

  transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.tenant_id', ${this.scope.tenantId}, true), set_config('app.legal_entity_id', ${this.scope.legalEntityId}, true)`;
        return operation(tx);
      },
      { maxWait: 8000, timeout: 15000 },
    );
  }
  createCustomer(input: NewCustomer) {
    const data = customerSchema.parse(input);
    return this.transaction((tx) =>
      tx.customer.create({ data: { ...data, ...this.scope } }),
    );
  }
  customers() {
    return this.transaction((tx) =>
      tx.customer.findMany({ where: this.scope, orderBy: { name: "asc" } }),
    );
  }
  customer(id: string) {
    z.uuid().parse(id);
    return this.transaction((tx) =>
      tx.customer.findFirst({ where: { ...this.scope, id } }),
    );
  }
  renameCustomer(id: string, name: string) {
    z.uuid().parse(id);
    const validName = customerSchema.shape.name.parse(name);
    return this.transaction((tx) =>
      tx.customer.updateMany({
        where: { ...this.scope, id },
        data: { name: validName, version: { increment: 1 } },
      }),
    );
  }
  deleteCustomer(id: string) {
    z.uuid().parse(id);
    return this.transaction((tx) =>
      tx.customer.deleteMany({ where: { ...this.scope, id } }),
    );
  }
  changeUsdCost(variantId: string, usd: string, actorId: string) {
    z.uuid().parse(variantId);
    z.string()
      .regex(/^\d{1,12}(\.\d{1,6})?$/)
      .parse(usd);
    z.string().min(1).max(200).parse(actorId);
    const nextUsd = new Prisma.Decimal(usd);
    return this.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "MaterialVariant" WHERE id = ${variantId}::uuid FOR UPDATE`;
      const variant = await tx.materialVariant.findFirstOrThrow({
        where: { ...this.scope, id: variantId },
      });
      await tx.materialPriceHistory.create({
        data: {
          ...this.scope,
          variantId,
          previousUsd: variant.usdCost,
          nextUsd,
          actorId,
        },
      });
      return tx.materialVariant.update({
        where: { id: variantId },
        data: { usdCost: nextUsd },
      });
    });
  }
}
