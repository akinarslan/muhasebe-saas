"use client";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
export function SecurityForm({enabled}:{enabled:boolean}){
 const [uri,setUri]=useState("");const [codes,setCodes]=useState<string[]>([]);const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 async function submit(form:HTMLFormElement,operation:string){
   setBusy(true);setMessage("");const fields=new FormData(form);
   const response=await fetch(`/api/auth/${operation}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(fields))}).catch(()=>null);
   setBusy(false);
   if(!response?.ok){setMessage("Doğrulama tamamlanamadı. Bilgilerinizi kontrol edin ve yeniden deneyin.");return;}
   const result=await response.json();
   if(result.totpURI){setUri(result.totpURI);setCodes(result.backupCodes);}else{setUri("");setCodes([]);setMessage("Doğrulama başarılı. Yönetim için parola ve TOTP ile yeniden doğrulama beş dakika geçerlidir.");}
 }
 return <div><div className="prototype-notice"><ShieldCheck/><span>Master Admin için TOTP zorunludur. Kurtarma kodları yalnız oluşturulduğunda gösterilir; güvenli bir yerde saklayın.</span></div>
 {!enabled&&!uri&&<form onSubmit={e=>{e.preventDefault();void submit(e.currentTarget,"two-factor/enable");}}><label>Mevcut şifre<input name="password" type="password" autoComplete="current-password" required minLength={12}/></label><button className="btn btn-primary" disabled={busy}>TOTP kurulumunu başlat</button></form>}
 {uri&&<section aria-label="TOTP kurulumu"><QRCodeSVG value={uri} size={200}/><p>Kimlik doğrulama uygulamanızla QR kodu tarayın.</p><details><summary>Elle kurulum anahtarı</summary><code>{new URL(uri).searchParams.get("secret")}</code></details><h3>Kurtarma kodlarınız</h3><p>Bu ekran kapandığında kodlar tekrar gösterilmez.</p><pre>{codes.join("\n")}</pre><form onSubmit={e=>{e.preventDefault();void submit(e.currentTarget,"two-factor/verify-totp");}}><label>Doğrulama kodu<input name="code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}"/></label><button className="btn btn-primary" disabled={busy}>MFA kurulumunu doğrula</button></form></section>}
 {!uri&&<form onSubmit={e=>{e.preventDefault();void submit(e.currentTarget,"step-up");}}><h3>Hassas işlem doğrulaması</h3><label>Şifre<input name="password" type="password" autoComplete="current-password" required/></label><label>TOTP kodu<input name="code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}"/></label><button className="btn btn-primary" disabled={busy}>Yeniden doğrula</button></form>}
 <p role="status">{message}</p><Link href="/admin/users">Kullanıcı yönetimi</Link></div>;
}
