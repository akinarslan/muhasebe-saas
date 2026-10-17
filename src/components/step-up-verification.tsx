"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";
type Status = {
  verified: boolean;
  expiresAt: string | null;
  serverTime: number;
};
export function StepUpVerification({
  onVerified,
}: {
  onVerified?: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null),
    [clock, setClock] = useState(0),
    [offset, setOffset] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submitting = useRef(false);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth/step-up/status", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("STATUS_UNAVAILABLE");
    const result: Status = await response.json();
    setError("");
    setStatus(result);
    setOffset(result.serverTime - Date.now());
    setClock(Date.now());
    return result;
  }, []);
  useEffect(() => {
    let active = true;
    const check = () => {
      void refresh().catch(() => {
        if (active) {
          setStatus({
            verified: false,
            expiresAt: null,
            serverTime: Date.now(),
          });
          setError("Oturum doğrulanamadı. Yeniden giriş yapmanız gerekebilir.");
        }
      });
    };
    check();
    let tick = 0;
    const interval = setInterval(() => {
      setClock(Date.now());
      if (++tick % 15 === 0) check();
    }, 1000);
    window.addEventListener("focus", check);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", check);
    };
  }, [refresh]);
  const seconds = status?.expiresAt
    ? Math.max(
        0,
        Math.ceil((Date.parse(status.expiresAt) - (clock + offset)) / 1000),
      )
    : 0;
  const verified = !!status?.verified && seconds > 0;
  if (!status) return <p role="status">Güvenlik durumu doğrulanıyor…</p>;
  return (
    <section aria-label="Hassas işlem doğrulaması">
      {verified ? (
        <div className="step-up-success" role="status">
          <CheckCircle2 size={32} />
          <h3>Kimliğiniz başarıyla doğrulandı</h3>
          <p>Yönetim işlemlerine devam edebilirsiniz.</p>
          <p>
            Geçerlilik: {Math.floor(seconds / 60)}:
            {String(seconds % 60).padStart(2, "0")} · En fazla beş dakika,
            yalnız bu oturumda.
          </p>
          {onVerified ? (
            <button className="btn btn-primary" onClick={onVerified}>
              Davet formuna dön
            </button>
          ) : (
            <Link className="btn btn-primary" href="/admin/users">
              Kullanıcı yönetimine devam et
            </Link>
          )}
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting.current) return;
            submitting.current = true;
            setBusy(true);
            setError("");
            const form = e.currentTarget;
            try {
              const response = await fetch("/api/auth/step-up", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(Object.fromEntries(new FormData(form))),
                signal: AbortSignal.timeout(15000),
              });
              if (!response.ok) throw new Error();
              form.reset();
              const fresh = await refresh();
              if (!fresh.verified) throw new Error();
              onVerified?.();
            } catch {
              setError(
                "Doğrulama tamamlanamadı. Parolanızı ve güncel TOTP kodunu kontrol edin.",
              );
            } finally {
              submitting.current = false;
              setBusy(false);
            }
          }}
        >
          <h3>
            <ShieldCheck size={18} /> Hassas işlem doğrulaması
          </h3>
          <p>Parola ve TOTP ile doğrulama beş dakika geçerlidir.</p>
          <label>
            Şifre
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={busy}
            />
          </label>
          <label>
            TOTP kodu
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              disabled={busy}
            />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Doğrulanıyor…" : "Yeniden doğrula"}
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
