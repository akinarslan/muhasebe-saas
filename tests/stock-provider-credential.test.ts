// @vitest-environment node
import { expect, it, vi } from "vitest";
import { loadProviderCredential } from "../scripts/stock/provider-credential";

it("selects an explicit API key without reading expired OAuth", async () => {
  const oauth = vi.fn(async () => ({ access_token: "old", expires_at: 0 }));
  await expect(loadProviderCredential(oauth, "synthetic-key", 1000)).resolves.toEqual({
    access_token: "synthetic-key",
    type: "api_key",
  });
  expect(oauth).not.toHaveBeenCalled();
});

it.each(["", "has space", "key\r\nheader", "key\n", "key\r", "\tkey", "key\u007f"])(
  "rejects malformed environment credential without identity fallback (%j)",
  async (key) => {
    const oauth = vi.fn(async () => ({ access_token: "other", expires_at: 50000 }));
    await expect(loadProviderCredential(oauth, key, 1000)).rejects.toThrow(
      "NEON_API_KEY_FORMAT_REJECTED",
    );
    expect(oauth).not.toHaveBeenCalled();
  },
);

it("preserves expiry checks when no API key is configured", async () => {
  const old = process.env.NEON_API_KEY;
  delete process.env.NEON_API_KEY;
  try {
    await expect(
      loadProviderCredential(async () => ({ access_token: "old", expires_at: 0 }), undefined, 1000),
    ).rejects.toThrow("NEON_CREDENTIAL_EXPIRED_OR_EXPIRING");
    await expect(
      loadProviderCredential(async () => ({ access_token: "current", type: "oauth", expires_at: 50000 }), undefined, 1000),
    ).resolves.toEqual({ access_token: "current", type: "oauth" });
  } finally {
    if (old === undefined) delete process.env.NEON_API_KEY;
    else process.env.NEON_API_KEY = old;
  }
});
