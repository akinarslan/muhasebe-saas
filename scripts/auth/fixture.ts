import { loadEnvConfig } from "@next/env";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { symmetricEncrypt, symmetricDecrypt } from "better-auth/crypto";
import { bootstrap } from "../../src/server/auth/bootstrap";
loadEnvConfig(process.cwd());
export async function authFixture() {
  const key = process.env.AUTH_TEST_SECRET!;
  const file = ".data/auth-test-fixture.enc";
  try {
    return JSON.parse(
      await symmetricDecrypt({ key, data: await readFile(file, "utf8") }),
    ) as { email: string; password: string };
  } catch {
    const fixture = {
      email: `master-${randomBytes(8).toString("hex")}@example.invalid`,
      password: randomBytes(24).toString("base64url"),
    };
    const result = await bootstrap(
      {
        ...fixture,
        name: "C2 master fixture",
        tenantName: "C2 synthetic tenant",
        companyName: "C2 synthetic company",
      },
      true,
    );
    if (!result.created)
      throw new Error(
        "Test bootstrap is closed and fixture is unavailable; explicit operator recovery required",
      );
    await mkdir(".data", { recursive: true });
    await writeFile(
      file,
      await symmetricEncrypt({ key, data: JSON.stringify(fixture) }),
      { mode: 0o600 },
    );
    return fixture;
  }
}
