import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Postgres is intrinsic to the linked branch. No managed auth or other services.
  auth: false,
  // Persistent development data must not inherit the starter's 7-day auto-expiry.
});
