"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, LockKeyhole, LogOut } from "lucide-react";
export function AuthForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [factor, setFactor] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [account, setAccount] = useState("");
  const codeInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (factor) codeInput.current?.focus();
  }, [factor, recovery]);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const element = event.currentTarget;
        const form = new FormData(element);
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
            setAccount(String(form.get("email") ?? ""));
            element.reset();
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
            Hesap e-postası
            <input
              type="email"
              value={account}
              readOnly
              autoComplete="username"
            />
          </label>
          <label>
            {recovery ? "Kurtarma kodu" : "TOTP doğrulama kodu"}
            <div className="login-field">
              <LockKeyhole size={17} />
              <input
                key={recovery ? "recovery" : "totp"}
                ref={codeInput}
                name="code"
                required
                autoComplete="one-time-code"
                inputMode={recovery ? "text" : "numeric"}
                pattern={recovery ? undefined : "[0-9]{6}"}
                maxLength={recovery ? 100 : 6}
                placeholder={recovery ? "Kurtarma kodunuz" : "6 haneli kod"}
              />
            </div>
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => setRecovery(!recovery)}
          >
            {recovery ? "TOTP kullan" : "Kurtarma kodu kullan"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                const response = await fetch("/api/auth/sign-out", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                });
                if (!response.ok) throw new Error();
                setFactor(false);
                setRecovery(false);
                setAccount("");
                setError("");
              } catch {
                setError("Hesap değiştirilemedi. Yeniden deneyin.");
              } finally {
                setPending(false);
              }
            }}
          >
            Hesap değiştir
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button className="btn btn-primary login-submit" disabled={pending}>
        {pending
          ? "Doğrulanıyor…"
          : factor
            ? "Doğrula ve devam et"
            : "Giriş yap"}
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
