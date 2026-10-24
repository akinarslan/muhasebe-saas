// Local metadata only. Never refresh, log, or persist credential material.
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
