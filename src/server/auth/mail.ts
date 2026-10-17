import "server-only";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { symmetricEncrypt, symmetricDecrypt } from "better-auth/crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { MailFailure, mailSettings, resendCarrier } from "./resend-carrier";
export type MailResult = {
  provider: string;
  status: "LOCAL_TEST" | "ACCEPTED";
  messageId?: string;
};
export type AuthMail = {
  to: string;
  kind: "INVITE" | "RESET" | "TEST";
  url: string;
  membershipId?: string;
  deliveryId?: string;
};
export interface MailCarrier {
  provider?: string;
  send(message: AuthMail): Promise<void | MailResult>;
}
export function trackedCarrier(
  db: PrismaClient,
  carrier: MailCarrier,
): MailCarrier {
  return {
    provider: carrier.provider ?? "local",
    async send(message) {
      const user = await db.authUser.findUnique({
        where: { email: message.to.toLowerCase() },
        select: { id: true },
      });
      const record = await db.authMailDelivery.create({
        data: {
          userId: user?.id ?? "operator-test",
          membershipId: message.membershipId,
          kind: message.kind,
          provider: carrier.provider ?? "local",
          status: "PENDING",
        },
      });
      try {
        const result = (await carrier.send({
          ...message,
          deliveryId: record.id,
        })) ?? {
          provider: carrier.provider ?? "local",
          status: "LOCAL_TEST" as const,
        };
        await db.authMailDelivery.update({
          where: { id: record.id },
          data: { status: result.status, providerMessageId: result.messageId },
        });
        return result;
      } catch (error) {
        const code =
          error instanceof MailFailure ? error.code : "CARRIER_FAILURE";
        await db.authMailDelivery.update({
          where: { id: record.id },
          data: {
            status: [
              "NETWORK_OR_TIMEOUT",
              "INVALID_PROVIDER_RESPONSE",
            ].includes(code)
              ? "UNKNOWN"
              : "FAILED",
            errorCode: code,
          },
        });
        console.warn("AUTH_MAIL_FAILED", { deliveryId: record.id, code });
        throw new MailFailure(code);
      }
    },
  };
}
export function configuredCarrier(secret: string) {
  return mailSettings().provider === "resend"
    ? resendCarrier()
    : localTestCarrier(secret);
}
export function localTestCarrier(secret: string): MailCarrier {
  return {
    provider: "local",
    async send(message) {
      if (process.env.NODE_ENV === "production")
        throw new Error("A production mail carrier must be configured");
      await mkdir(".data/auth-mail", { recursive: true });
      await writeFile(
        `.data/auth-mail/${randomUUID()}.enc`,
        await symmetricEncrypt({ key: secret, data: JSON.stringify(message) }),
        { mode: 0o600 },
      );
      return { provider: "local", status: "LOCAL_TEST" };
    },
  };
}
// Operator/test-only reader; never exposed as an HTTP endpoint.
export async function readTestMail(
  path: string,
  secret: string,
): Promise<AuthMail> {
  return JSON.parse(
    await symmetricDecrypt({ key: secret, data: await readFile(path, "utf8") }),
  );
}
