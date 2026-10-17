import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import {
  resendCarrier,
  mailSettings,
} from "../../src/server/auth/resend-carrier";
loadEnvConfig(process.cwd());
async function run() {
  if (!process.argv.includes("--send-live"))
    throw new Error("LIVE_OPT_IN_REQUIRED");
  const config = mailSettings();
  if (config.mode !== "test" || !config.recipient)
    throw new Error("VERIFIED_TEST_RECIPIENT_REQUIRED");
  const result = await resendCarrier().send({
    to: config.recipient,
    kind: "TEST",
    url: "",
    deliveryId: randomUUID(),
  });
  if (result?.status !== "ACCEPTED") throw new Error("PROVIDER_NOT_ACCEPTED");
  console.log(
    "Resend test API: ACCEPTED; delivery to inbox is not asserted. No action link or account data sent.",
  );
}
run().catch((e) => {
  console.error(
    "Mail smoke failed:",
    e?.code ??
      (e?.message === "VERIFIED_TEST_RECIPIENT_REQUIRED"
        ? e.message
        : "CONFIGURATION_OR_SEND_FAILURE"),
  );
  process.exitCode = 1;
});
