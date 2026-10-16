import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.PUSULA_AUTH_E2E === "1" ? ".next-auth-e2e" : ".next",
};
export default config;
