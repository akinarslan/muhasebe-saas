// Local metadata only. Never refresh, log, or persist credential material.
// An explicitly configured environment key takes precedence. Its validity is
// established by the fixed GET requests, not by invented OAuth expiry metadata.
// Invalid keys fail closed: never retry with another identity after selection.
export async function loadProviderCredential(
  loadOauth: () => Promise<Record<string, unknown>>,
  apiKey = process.env.NEON_API_KEY,
  now = Date.now(),
): Promise<{ access_token: string; type: "api_key" | "oauth" }> {
  if (apiKey !== undefined) {
    if (!apiKey || /[^\x21-\x7e]/.test(apiKey))
      throw new Error("NEON_API_KEY_FORMAT_REJECTED");
    return { access_token: apiKey, type: "api_key" };
  }
  const credential = await loadOauth();
  assertProviderCredential(credential, now);
  return { access_token: credential.access_token as string, type: "oauth" };
}

export function assertProviderCredential(
  credential: Record<string, unknown>,
  now = Date.now(),
) {
  if (typeof credential.access_token !== "string" || !credential.access_token)
    throw new Error("NEON_CREDENTIAL_UNAVAILABLE");
  if (credential.type !== undefined && credential.type !== "oauth")
    throw new Error("NEON_CREDENTIAL_TYPE_UNSUPPORTED");
  // Older Neon OAuth files omit type; they still require expiry validation.
  {
    if (
      typeof credential.expires_at !== "number" ||
      !Number.isFinite(credential.expires_at)
    )
      throw new Error("NEON_CREDENTIAL_EXPIRY_UNVERIFIED");
    // The existing Neon credential format stores expires_at in milliseconds.
    if (credential.expires_at <= now + 30_000)
      throw new Error("NEON_CREDENTIAL_EXPIRED_OR_EXPIRING");
  }
}
