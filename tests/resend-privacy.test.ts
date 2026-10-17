import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { resendCarrier } from "../src/server/auth/resend-carrier";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("real pinned SDK does not log private provider response or use an alternate API host", async () => {
  vi.stubEnv("RESEND_API_KEY", "synthetic-api-key");
  vi.stubEnv("RESEND_TEST_RECIPIENT", "fixture@example.com");
  vi.stubEnv("AUTH_MAIL_MODE", "test");
  vi.stubEnv("RESEND_BASE_URL", "https://untrusted.example.invalid");
  const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "validation_error",
          statusCode: 403,
          message: "private provider recipient information",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    resendCarrier().send({
      to: "fixture@example.com",
      kind: "TEST",
      url: "",
      deliveryId: "privacy-fixture",
    }),
  ).rejects.toMatchObject({ code: "SENDER_OR_RECIPIENT_REJECTED" });
  expect(fetcher.mock.calls[0][0]).toBe("https://api.resend.com/emails");
  expect(logger).not.toHaveBeenCalled();
});
