import "server-only";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { symmetricEncrypt, symmetricDecrypt } from "better-auth/crypto";
export type AuthMail = { to: string; kind: "INVITE" | "RESET"; url: string };
export interface MailCarrier {
  send(message: AuthMail): Promise<void>;
}
export function localTestCarrier(secret: string): MailCarrier {
  return {
    async send(message) {
      if (process.env.NODE_ENV === "production")
        throw new Error("A production mail carrier must be configured");
      await mkdir(".data/auth-mail", { recursive: true });
      await writeFile(
        `.data/auth-mail/${randomUUID()}.enc`,
        await symmetricEncrypt({ key: secret, data: JSON.stringify(message) }),
        { mode: 0o600 },
      );
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
