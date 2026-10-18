import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.PUSULA_AUTH_E2E === "1" ? ".next-auth-e2e" : ".next",
  // Operator backups, fixture clusters, tools and local trust files are never web assets.
  // Runtime rate cache remains on the deployment's writable local storage.
  outputFileTracingExcludes: { "/*": ["./.data/**/*"] },
};
export default config;
