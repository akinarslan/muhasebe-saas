import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));
import {
  resendCarrier,
  validateResendMessage,
} from "../src/server/auth/resend-carrier";
const message = {
  to: "verified@example.com",
  kind: "INVITE" as const,
  url: "https://pusula.example.com/invite?token=opaque",
  deliveryId: "fixture-id",
};
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test-only-key");
  vi.stubEnv("AUTH_MAIL_MODE", "test");
  vi.stubEnv("RESEND_TEST_RECIPIENT", message.to);
  vi.stubEnv("AUTH_PUBLIC_URL", "https://pusula.example.com");
  vi.stubEnv("AUTH_MAIL_ALLOW_LOCAL_LINKS", "false");
  send.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
describe("Resend server carrier", () => {
  it("restricts test recipient before contacting provider", async () => {
    await expect(
      resendCarrier().send({ ...message, to: "other@example.com" }),
    ).rejects.toMatchObject({ code: "RECIPIENT_NOT_ALLOWED" });
    expect(send).not.toHaveBeenCalled();
  });
  it("requires explicit development opt-in for local action links", () => {
    vi.stubEnv("AUTH_PUBLIC_URL", "http://localhost:3000");
    const local = {
      ...message,
      url: "http://localhost:3000/invite?token=opaque",
    };
    expect(() => validateResendMessage(local)).toThrow();
    vi.stubEnv("AUTH_MAIL_ALLOW_LOCAL_LINKS", "true");
    expect(validateResendMessage(local).mode).toBe("test");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => validateResendMessage(local)).toThrow();
  });
  it("blocks foreign origins, action paths and non-HTTPS public links", () => {
    for (const url of [
      "https://evil.example/invite",
      "https://pusula.example.com/admin",
      "https://pusula.example.com/invite#secret",
    ])
      expect(() => validateResendMessage({ ...message, url })).toThrow();
    vi.stubEnv("AUTH_PUBLIC_URL", "http://pusula.example.com");
    expect(() =>
      validateResendMessage({
        ...message,
        url: "http://pusula.example.com/invite",
      }),
    ).toThrow();
  });
  it("uses test sender, minimal content, idempotency and API acceptance", async () => {
    send.mockResolvedValue({ data: { id: "provider-fixture" }, error: null });
    expect(await resendCarrier().send(message)).toEqual({
      provider: "resend",
      status: "ACCEPTED",
      messageId: "provider-fixture",
    });
    expect(send.mock.calls[0][0]).toMatchObject({
      from: "Pusula <onboarding@resend.dev>",
      to: [message.to],
    });
    expect(send.mock.calls[0][1].idempotencyKey).toBe("pusula/fixture-id");
    expect(send.mock.calls[0][0].text).not.toMatch(
      /balance|customer|tenantId/i,
    );
  });
  it.each([
    ["daily_quota_exceeded", 429, "QUOTA_EXCEEDED"],
    ["monthly_quota_exceeded", 429, "QUOTA_EXCEEDED"],
    ["rate_limit_exceeded", 429, "RATE_LIMITED"],
    ["validation_error", 403, "SENDER_OR_RECIPIENT_REJECTED"],
    ["validation_error", 401, "AUTHENTICATION"],
  ])("redacts provider error %s", async (name, statusCode, code) => {
    send.mockResolvedValue({
      data: null,
      error: { name, statusCode, message: "private provider details" },
    });
    await expect(resendCarrier().send(message)).rejects.toMatchObject({
      code,
      message: "Email operation unavailable",
    });
  });
  it("handles network failure and malformed success", async () => {
    send.mockRejectedValue(new Error("secret transport details"));
    await expect(resendCarrier().send(message)).rejects.toMatchObject({
      code: "NETWORK_OR_TIMEOUT",
    });
    send.mockResolvedValue({ data: {}, error: null });
    await expect(resendCarrier().send(message)).rejects.toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE",
    });
  });
  it("requires an own sender in production mode", () => {
    vi.stubEnv("AUTH_MAIL_MODE", "production");
    vi.stubEnv("RESEND_FROM", "Pusula <onboarding@resend.dev>");
    expect(() => validateResendMessage(message)).toThrow();
    vi.stubEnv("RESEND_FROM", "Pusula <accounts@pusula.example.com>");
    expect(validateResendMessage(message).mode).toBe("production");
  });
});
