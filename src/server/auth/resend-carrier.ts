import "server-only";
import { Resend } from "resend";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthMail, MailCarrier } from "./mail";
export class MailFailure extends Error {
  constructor(public code: string) {
    super("Email operation unavailable");
  }
}
export function mailSettings() {
  const provider =
    process.env.AUTH_MAIL_PROVIDER ??
    (process.env.RESEND_API_KEY ? "resend" : "local");
  if (!["resend", "local"].includes(provider))
    throw new MailFailure("CONFIGURATION");
  const mode = process.env.AUTH_MAIL_MODE ?? "test";
  if (!["test", "production"].includes(mode))
    throw new MailFailure("CONFIGURATION");
  return {
    provider,
    mode,
    from:
      mode === "test"
        ? "Pusula <onboarding@resend.dev>"
        : (process.env.RESEND_FROM ?? ""),
    recipient: (process.env.RESEND_TEST_RECIPIENT ?? "").trim().toLowerCase(),
  };
}
export function validateResendMessage(message: AuthMail) {
  const config = mailSettings();
  if (!process.env.RESEND_API_KEY) throw new MailFailure("NOT_CONFIGURED");
  if (!z.email().safeParse(message.to).success)
    throw new MailFailure("RECIPIENT_NOT_ALLOWED");
  if (config.mode === "test") {
    if (process.env.NODE_ENV === "production")
      throw new MailFailure("TEST_MODE_IN_PRODUCTION");
    if (
      !config.recipient ||
      message.to.trim().toLowerCase() !== config.recipient
    )
      throw new MailFailure("RECIPIENT_NOT_ALLOWED");
  } else {
    if (
      !config.from ||
      /[\r\n]/.test(config.from) ||
      config.from.includes("resend.dev")
    )
      throw new MailFailure("SENDER_NOT_CONFIGURED");
  }
  if (message.kind === "TEST") return config;
  let url: URL, base: URL;
  try {
    url = new URL(message.url);
    base = new URL(
      process.env.AUTH_PUBLIC_URL ?? process.env.BETTER_AUTH_URL ?? "",
    );
  } catch {
    throw new MailFailure("LINK_NOT_CONFIGURED");
  }
  if (url.origin !== base.origin || url.username || url.password || url.hash)
    throw new MailFailure("LINK_NOT_ALLOWED");
  if (!(
    (message.kind === "INVITE" && url.pathname === "/invite") ||
    (message.kind === "RESET" &&
      /^\/api\/auth\/reset-password\/[A-Za-z0-9_-]+$/.test(url.pathname))
  ))
    throw new MailFailure("LINK_NOT_ALLOWED");
  const privateHost =
    /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]$)/i.test(
      url.hostname,
    ) || /\.(local|invalid|test)$/.test(url.hostname);
  if (privateHost) {
    if (
      config.mode !== "test" ||
      process.env.NODE_ENV === "production" ||
      process.env.AUTH_MAIL_ALLOW_LOCAL_LINKS !== "true"
    )
      throw new MailFailure("LOCAL_LINK_BLOCKED");
  } else if (url.protocol !== "https:") throw new MailFailure("HTTPS_REQUIRED");
  if (!["http:", "https:"].includes(url.protocol))
    throw new MailFailure("LINK_NOT_ALLOWED");
  return config;
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function resendCarrier(): MailCarrier {
  return {
    provider: "resend",
    async send(message) {
      const config = validateResendMessage(message);
      const subject =
        message.kind === "INVITE"
          ? "Pusula çalışma alanı davetiniz"
          : message.kind === "RESET"
            ? "Pusula parola sıfırlama isteğiniz"
            : "Pusula e-posta bağlantı testi";
      const action =
        message.kind === "INVITE" ? "Daveti kabul et" : "Parolayı sıfırla";
      const note =
        config.mode === "test"
          ? "Bu bir geliştirme testidir. Yerel bağlantılar yalnız geliştiricinin uygulamayı çalıştırdığı cihazda açılır."
          : "Bu isteği siz başlatmadıysanız iletiyi yok sayabilirsiniz.";
      const text =
        message.kind === "TEST"
          ? `${subject}\nResend API bağlantısı test ediliyor. Bu ileti hesap veya finansal veri içermez.`
          : `${subject}\n${action}: ${message.url}\nBağlantı süreli ve tek kullanımlıdır.\n${note}`;
      const html =
        message.kind === "TEST"
          ? undefined
          : `<div style="font-family:Arial,sans-serif;color:#14243a;max-width:560px"><h1 style="color:#0d9488">pusula</h1><h2>${subject}</h2><p>Hesap erişimi işleminizi tamamlamak için aşağıdaki bağlantıyı kullanın.</p><p><a href="${escape(message.url)}" style="background:#0d9488;color:white;padding:12px 18px;text-decoration:none;border-radius:8px">${action}</a></p><p>Bağlantı süreli ve tek kullanımlıdır.</p><p>${note}</p></div>`;
      try {
        const client = new Resend(process.env.RESEND_API_KEY, {
          baseUrl: "https://api.resend.com",
        });
        // SDK 6.34.1 logs raw API responses in development. Its version is
        // pinned; suppress only this instance's logger, never global console.
        // Regression tests exercise the real SDK against a synthetic 403.
        Object.defineProperty(client, "logError", { value: () => undefined });
        const result = await client.emails.send(
          {
            from: config.from,
            to: [message.to],
            subject,
            text,
            ...(html ? { html } : {}),
          },
          {
            idempotencyKey: `pusula/${message.deliveryId ?? randomUUID()}`,
            signal: AbortSignal.timeout(15000),
          },
        );
        if (result.error) {
          const e = result.error;
          throw new MailFailure(
            [
              "monthly_quota_exceeded",
              "daily_quota_exceeded",
              "email_above_quota",
            ].includes(e.name)
              ? "QUOTA_EXCEEDED"
              : e.statusCode == null ||
                  e.statusCode === 408 ||
                  e.statusCode >= 500
                ? "NETWORK_OR_TIMEOUT"
                : e.statusCode === 429
                  ? "RATE_LIMITED"
                  : e.statusCode === 401
                    ? "AUTHENTICATION"
                    : e.statusCode === 403
                      ? "SENDER_OR_RECIPIENT_REJECTED"
                      : "PROVIDER_REJECTED",
          );
        }
        if (!result.data?.id)
          throw new MailFailure("INVALID_PROVIDER_RESPONSE");
        return {
          provider: "resend",
          status: "ACCEPTED",
          messageId: result.data.id,
        };
      } catch (error) {
        if (error instanceof MailFailure) throw error;
        throw new MailFailure("NETWORK_OR_TIMEOUT");
      }
    },
  };
}
