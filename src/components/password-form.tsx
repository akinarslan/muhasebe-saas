"use client";
import { useState } from "react";
import Link from "next/link";
export function PasswordForm({
  mode,
}: {
  mode: "request" | "reset" | "invite";
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-form-zone">
      <div className="login-form">
        <span className="badge neutral">HESAP ERİŞİMİ</span>
        <h1>
          {mode === "request"
            ? "Parolamı unuttum"
            : mode === "invite"
              ? "Davetinizi kabul edin"
              : "Yeni parolanız"}
        </h1>
        <p>
          {mode === "request"
            ? "SMTP bağlı değildir. Geliştirme mesajı şifreli yerel test taşıyıcısına kaydedilir; gerçek e-posta gönderilmez."
            : "Bağlantılar süreli ve tek kullanımlıktır. Parolanız en az 12 karakter olmalıdır."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const form = e.currentTarget,
              fields = new FormData(form),
              token = new URLSearchParams(window.location.search).get("token");
            try {
              const url =
                mode === "request"
                  ? "/api/auth/request-password-reset"
                  : mode === "reset"
                    ? "/api/auth/reset-password"
                    : "/api/cloud/invitations/accept";
              const body =
                mode === "request"
                  ? {
                      email: fields.get("email"),
                      redirectTo: "/reset-password",
                    }
                  : mode === "reset"
                    ? { token, newPassword: fields.get("password") }
                    : { token, password: fields.get("password") };
              const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              });
              if (!response.ok) throw new Error();
              setMessage(
                mode === "request"
                  ? "Hesap uygunsa geliştirme test iletisi oluşturulmuştur. Gerçek e-posta gönderilmedi."
                  : "İşlem tamamlandı. Yeni parolanızla giriş yapabilirsiniz.",
              );
              form.reset();
            } catch {
              setMessage(
                "İşlem tamamlanamadı. Bağlantı süresi dolmuş, kullanılmış veya hizmet kullanılamıyor olabilir.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "request" ? (
            <label>
              E-posta
              <input name="email" type="email" autoComplete="email" required />
            </label>
          ) : (
            <label>
              Yeni parola
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy
              ? "İşleniyor…"
              : mode === "request"
                ? "Sıfırlama isteği oluştur"
                : "Parolayı kaydet"}
          </button>
        </form>
        <p role="status">{message}</p>
        <Link href="/login">Giriş ekranına dön</Link>
      </div>
    </main>
  );
}
