"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Landmark, ShieldCheck, AlertTriangle } from "lucide-react";
import type { RateResponse, RateSnapshot } from "@/lib/pricing-types";
import { dateLabel } from "@/lib/finance";
import { Button } from "./ui/button";
import { NumericInput } from "./ui/numeric-input";
export function RatePanel({
  rate,
  onChange,
}: {
  rate: RateSnapshot | null;
  onChange: (r: RateSnapshot | null) => void;
}) {
  const [status, setStatus] = useState<RateResponse>({
    rate: null,
    stale: false,
  });
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState(false);
  const [token, setToken] = useState("");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/exchange-rate", { cache: "no-store" })
      .then((r) => r.json())
      .then((r: RateResponse) => {
        if (active) {
          setStatus(r);
          onChange(r.rate);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setStatus({
            rate: null,
            stale: true,
            error: "Kur servisine erişilemedi.",
          });
          onChange(null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [onChange]);
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const r: RateResponse = await (
        await fetch("/api/exchange-rate", { cache: "no-store" })
      ).json();
      setStatus(r);
      onChange(r.rate);
    } catch {
      setStatus((s) => ({
        ...s,
        stale: true,
        error: "Kur yenilenemedi; önceki kur eski olabilir.",
      }));
    } finally {
      setLoading(false);
    }
  }
  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/exchange-rate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ value: Number(value), reason }),
      });
      const result = await response.json();
      setToken("");
      if (!response.ok)
        throw new Error(result.error || "Manuel kur kaydedilemedi.");
      onChange(result.rate);
      setStatus({ rate: result.rate, stale: false });
      setManual(false);
    } catch (e) {
      setToken("");
      setError(e instanceof Error ? e.message : "Manuel kur kaydedilemedi.");
    }
  }
  return (
    <section className="rate-panel">
      <div className="rate-title">
        <span className="icon-tile">
          <Landmark size={21} />
        </span>
        <div>
          <b>USD / TRY</b>
          <small>
            {rate?.source === "manual"
              ? "Yetkili manuel kur"
              : "TCMB · Döviz satış"}
          </small>
        </div>
        <strong>
          {rate
            ? rate.value.toLocaleString("tr-TR", { minimumFractionDigits: 4 })
            : "—"}
        </strong>
        <Button
          variant="outline"
          size="icon"
          aria-label="TCMB kurunu yenile"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "is-loading" : ""} />
        </Button>
      </div>
      {rate && (
        <div className="rate-dates">
          <span>Yayın / işlem: {dateLabel(rate.publishedAt)}</span>
          {rate.eurValue && <span>EUR/TRY: {rate.eurValue.toFixed(4)}</span>}
          <span>
            Son çekilme:{" "}
            {new Date(rate.fetchedAt).toLocaleString("tr-TR", {
              timeZone: "Europe/Istanbul",
            })}
          </span>
          {rate.source === "manual" && (
            <span>
              Yetkili: {rate.authorizedBy} · {rate.reason}
            </span>
          )}
        </div>
      )}
      <p className="help">
        Son yayımlanan TCMB gösterge kurudur; gerçek zamanlı piyasa kuru
        değildir.
      </p>
      {loading && (
        <p role="status" className="help">
          Kur sunucudan alınıyor…
        </p>
      )}
      {status.stale && (
        <p className="rate-warning" role="status">
          <AlertTriangle size={15} />
          {status.error || "Son başarılı kur eski olabilir."}
        </p>
      )}
      <button className="text-button" onClick={() => setManual(!manual)}>
        <ShieldCheck size={14} />
        Yetkili manuel kur {manual ? "kapat" : "gir"}
      </button>
      {manual && (
        <form className="manual-rate-form" onSubmit={saveManual}>
          <p className="help">
            Sunucuda PUSULA_RATE_ADMIN_TOKEN gerekir. Anahtar saklanmaz; ad ve
            gerekçe denetim kaydına yazılır.
          </p>
          <label>
            Manuel USD/TRY
            <NumericInput
              min="0.0001"
              step="0.0001"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <label>
            Gerekçe
            <input
              required
              minLength={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label>
            Yönetici anahtarı
            <input
              type="password"
              autoComplete="off"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <Button type="submit">Doğrula ve kullan</Button>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
