"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, LockKeyhole, LogOut } from "lucide-react";
export function AuthForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return <form onSubmit={async event => {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/sign-in/email", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      if (!response.ok) throw new Error();
      router.push("/app"); router.refresh();
    } catch { setError("Giriş yapılamadı. Bilgilerinizi kontrol edin veya daha sonra yeniden deneyin."); }
    finally { setPending(false); }
  }}>
    <label>Kurumsal e-posta<div className="login-field"><Mail size={17}/><input name="email" type="email" required autoComplete="username" /></div></label>
    <label>Şifre<div className="login-field"><LockKeyhole size={17}/><input name="password" type="password" required autoComplete="current-password" /></div></label>
    {error && <p role="alert">{error}</p>}
    <button className="btn btn-primary login-submit" disabled={pending}>{pending ? "Doğrulanıyor…" : "Giriş yap"}</button>
  </form>;
}
export function SignOut() {
  const router = useRouter();
  return <button className="btn" onClick={async () => {
    const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (response.ok) { router.push("/login"); router.refresh(); }
  }}><LogOut size={16}/> Oturumu kapat</button>;
}
