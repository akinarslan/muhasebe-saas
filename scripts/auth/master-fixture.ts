import { authFixture } from "./fixture";
import { createAuth, authRequest } from "../../src/server/auth/core";
import { createDatabase } from "../../src/server/db/client";
import { symmetricDecrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import type { AuthMail } from "../../src/server/auth/mail";
export async function masterFixture() {
  const credentials = await authFixture(),
    messages: AuthMail[] = [];
  const source = createAuth(
    process.env.TEST_AUTH_DATABASE_URL!,
    process.env.AUTH_TEST_SECRET!,
    true,
    {
      async send(message) {
        messages.push(message);
      },
    },
  );
  const db = createDatabase(process.env.TEST_DATABASE_URL!, true),
    cookies = new Map<string, string>();
  const headers = () =>
    new Headers({
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:3000",
      cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
    });
  async function call(path: string, body: object) {
    const response = await authRequest(
      new Request(`http://127.0.0.1:3000/api/auth${path}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      }),
      source,
    );
    for (const value of response.headers.getSetCookie()) {
      const part = value.split(";")[0],
        i = part.indexOf("=");
      cookies.set(part.slice(0, i), part.slice(i + 1));
    }
    return response;
  }
  await source.db.authRateLimit.deleteMany();
  await call("/sign-in/email", credentials);
  const user = await source.db.authUser.findUniqueOrThrow({
    where: { email: credentials.email },
  });
  const factor = await source.db.authTwoFactor.findUniqueOrThrow({
    where: { userId: user.id },
  });
  const secret = await symmetricDecrypt({
    key: process.env.AUTH_TEST_SECRET!,
    data: factor.secret,
  });
  if (
    !(
      await call("/two-factor/verify-totp", {
        code: await createOTP(secret).totp(),
      })
    ).ok
  )
    throw new Error("Fixture MFA failed");
  if (
    !(
      await call("/step-up", {
        password: credentials.password,
        code: await createOTP(secret).totp(),
      })
    ).ok
  )
    throw new Error("Fixture step-up failed");
  return {
    source,
    db,
    headers,
    call,
    credentials,
    messages,
    async close() {
      await db.$disconnect();
      await source.db.$disconnect();
    },
  };
}
