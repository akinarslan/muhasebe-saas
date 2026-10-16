"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, LockKeyhole, LogOut } from "lucide-react";
export function AuthForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [factor, setFactor] = useState(false);
  const [recovery, setRecovery] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const form = new FormData(event.currentTarget);
        try {
          const endpoint = factor
            ? recovery
              ? "/two-factor/verify-backup-code"
              : "/two-factor/verify-totp"
            : "/sign-in/email";
          const response = await fetch(`/api/auth${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              factor
                ? { code: form.get("code") }
                : { email: form.get("email"), password: form.get("password") },
            ),
          });
          if (!response.ok) throw new Error();
          if ((await response.json()).twoFactorRedirect) {
            setFactor(true);
            return;
          }
          router.push("/app");
          router.refresh();
        } catch {
          setError(
            "Giriş yapılamadı. Bilgilerinizi kontrol edin veya daha sonra yeniden deneyin.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      {!factor ? (
        <>
          <label>
            Kurumsal e-posta
            <div className="login-field">
              <Mail size={17} />
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
              />
            </div>
          </label>
          <label>
            Şifre
            <div className="login-field">
              <LockKeyhole size={17} />
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
          </label>
        </>
      ) : (
        <>
          <label>
            {recovery ? "Kurtarma kodu" : "TOTP doğrulama kodu"}
            <div className="login-field">
              <LockKeyhole size={17} />
              <input name="code" required autoComplete="one-time-code" />
            </div>
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => setRecovery(!recovery)}
          >
            {recovery ? "TOTP kullan" : "Kurtarma kodu kullan"}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button className="btn btn-primary login-submit" disabled={pending}>
        {pending ? "Doğrulanıyor…" : "Giriş yap"}
      </button>
      {!factor && <Link href="/forgot-password">Parolamı unuttum</Link>}
    </form>
  );
}
export function SignOut() {
  const router = useRouter();
  return (
    <button
      className="btn"
      onClick={async () => {
        const response = await fetch("/api/auth/sign-out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (response.ok) {
          router.push("/login");
          router.refresh();
        }
      }}
    >
      <LogOut size={16} /> Oturumu kapat
    </button>
  );
}
